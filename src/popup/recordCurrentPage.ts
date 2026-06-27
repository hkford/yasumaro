import { checkPageStatus } from './statusChecker.js';
import { getSettings, StorageKeys } from '../utils/storage.js';
import { showPreview } from './sanitizePreview.js';
import { showSpinner, hideSpinner } from './spinner.js';
import { startAutoCloseTimer } from './autoClose.js';
import { getCurrentTab, isRecordable } from './tabUtils.js';
import { showError, formatSuccessMessage } from './errorUtils.js';
import { getMessage } from './i18n.js';
import { sendMessageWithRetry } from '../utils/retryHelper.js';
import { getSavedUrlEntries } from '../utils/storageUrls.js';
import { logError, ErrorCode } from '../utils/logger.js';
import type { ContentResponse, PreviewResponse } from './mainTypes.js';
import { setCurrentPendingSave } from './privatePageDialog.js';
import { updateCleansingStatus, updateTrustStatus, initStatusPanel as _initStatusPanel } from './statusPanel.js';
import { saveSettings } from '../utils/storage.js';
import { extractDomain } from '../utils/domainUtils.js';

let _recordCurrentPageFn: ((force: boolean) => Promise<void>) | null = null;

export function setRecordCurrentPageFn(fn: (force: boolean) => Promise<void>): void {
  _recordCurrentPageFn = fn;
}

// 「それでも記録」ボタン表示中フラグ（recordCurrentPage の finally でのリセットを防ぐ）
let isAwaitingForceConfirm = false;

export async function loadCurrentTab(): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab) return;

  const faviconUrl = new URL(browser.runtime.getURL('/_favicon/'));
  if (tab.url) {
    faviconUrl.searchParams.set('pageUrl', tab.url);
  }
  faviconUrl.searchParams.set('size', '32');
  const faviconEl = document.getElementById('favicon') as HTMLImageElement;
  if (faviconEl) {
    faviconEl.src = faviconUrl.toString();
  }

  const pageTitleEl = document.getElementById('pageTitle');
  if (pageTitleEl) {
    pageTitleEl.textContent = tab.title || getMessage('noTitle');
  }
  const url = tab.url || '';
  const pageUrlEl = document.getElementById('pageUrl');
  if (pageUrlEl) {
    pageUrlEl.textContent = url.length > 50 ? url.substring(0, 50) + '...' : url;
  }

  const recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
  if (recordBtn) {
    if (!isRecordable(tab)) {
      recordBtn.disabled = true;
      recordBtn.textContent = getMessage('cannotRecordPage');
    } else {
      recordBtn.disabled = false;
      recordBtn.textContent = getMessage('recordNow') || '📝 Record Now';
    }
  }

  const blacklistBtn = document.getElementById('blacklistBtn') as HTMLButtonElement;
  if (blacklistBtn) {
    if (!isRecordable(tab)) {
      blacklistBtn.style.display = 'none';
    } else {
      const settings = await getSettings();
      const blacklist = settings[StorageKeys.DOMAIN_BLACKLIST] || [];
      const domain = extractDomain(tab.url || '');
      if (domain && blacklist.includes(domain)) {
        blacklistBtn.disabled = true;
        blacklistBtn.textContent = '🚫 Already Blacklisted';
      } else {
        blacklistBtn.style.display = 'block';
        blacklistBtn.disabled = false;
        blacklistBtn.textContent = getMessage('blacklistThisDomain') || '🚫 Blacklist Domain';
        blacklistBtn.onclick = () => void handleBlacklistDomain();
      }
    }
  }
}

export async function handleBlacklistDomain(): Promise<void> {
  const statusDiv = document.getElementById('mainStatus');
  const blacklistBtn = document.getElementById('blacklistBtn') as HTMLButtonElement | null;
  const tab = await getCurrentTab();

  if (!tab?.url || !statusDiv) return;

  const domain = extractDomain(tab.url);
  if (!domain) {
    statusDiv.textContent = getMessage('failedToExtractDomain');
    statusDiv.className = 'error';
    return;
  }

  showSpinner(getMessage('saving'));

  try {
    const settings = await getSettings();
    const blacklist = settings[StorageKeys.DOMAIN_BLACKLIST] || [];
    if (!blacklist.includes(domain)) {
      blacklist.push(domain);
      await saveSettings({ [StorageKeys.DOMAIN_BLACKLIST]: blacklist }, true);

      statusDiv.textContent = getMessage('domainAddedToBlacklist', { domain }) || `Added ${domain} to blacklist`;
      statusDiv.className = 'success';

      if (blacklistBtn) {
        blacklistBtn.disabled = true;
        blacklistBtn.textContent = '🚫 Already Blacklisted';
      }

      // Refresh UI
      await _initStatusPanel();
      await loadCurrentTab();
    }
  } catch (error) {
    logError('Failed to blacklist domain', { cause: error }, ErrorCode.STORAGE_WRITE_FAILURE);
    statusDiv.textContent = getMessage('saveError');
    statusDiv.className = 'error';
  } finally {
    hideSpinner();
  }
}

async function resetRecordButton(recordBtn: HTMLButtonElement): Promise<void> {
  recordBtn.disabled = false;
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  const status = url ? await checkPageStatus(url) : null;
  if (status && !status.domainFilter.allowed) {
    recordBtn.textContent = getMessage('forceRecordAnyway') || 'Record Anyway';
    recordBtn.onclick = () => void recordCurrentPage(true);
  } else {
    recordBtn.textContent = getMessage('recordNow');
    recordBtn.onclick = () => recordCurrentPage(false);
  }
}

function setRecordAnywayButton(
  recordBtn: HTMLButtonElement,
  tab: browser.tabs.Tab,
  content: string
): void {
  isAwaitingForceConfirm = true;
  recordBtn.disabled = false;
  recordBtn.textContent = getMessage('forceRecordAnyway') || 'Record Anyway';
  recordBtn.onclick = () => {
    isAwaitingForceConfirm = false;
    void forceRecord(recordBtn, tab, content);
  };
}

async function forceRecord(
  recordBtn: HTMLButtonElement,
  tab: browser.tabs.Tab,
  content: string
): Promise<void> {
  const startTime = performance.now();
  const statusDiv = document.getElementById('mainStatus');
  if (!statusDiv) return;

  recordBtn.disabled = true;
  recordBtn.textContent = getMessage('recording') || 'Recording...';
  statusDiv.textContent = '';
  statusDiv.className = '';
  showSpinner(getMessage('saving'));

  try {
    const settings = await getSettings();
    const usePreview = settings[StorageKeys.PII_CONFIRMATION_UI] !== false;

    let result;
    if (usePreview) {
      result = await sendMessageWithRetry({
        type: 'SAVE_RECORD',
        payload: {
          title: tab.title,
          url: tab.url,
          content: content,
          force: true
        }
      });
    } else {
      result = await sendMessageWithRetry({
        type: 'MANUAL_RECORD',
        payload: {
          title: tab.title,
          url: tab.url,
          content: content,
          force: true
        }
      });
    }

    hideSpinner();

    if (result && result.success) {
      browser.runtime.sendMessage({ type: 'ACTIVITY_UPDATE', payload: {} }).catch(() => { });

      const totalDuration = performance.now() - startTime;
      const message = formatSuccessMessage(totalDuration, result.aiDuration, result.obsidianDuration !== undefined);
      statusDiv.textContent = message;
      statusDiv.className = 'success';
      startAutoCloseTimer();
      resetRecordButtonAndClearFlag(recordBtn);
    } else {
      statusDiv.textContent = `${getMessage('saveError')}: ${result?.error || 'Unknown error'}`;
      statusDiv.className = 'error';
      resetRecordButtonAndClearFlag(recordBtn);
    }
  } catch (error: unknown) {
    hideSpinner();
    showError(statusDiv, error, () => void forceRecord(recordBtn, tab, content));
    resetRecordButtonAndClearFlag(recordBtn);
  }
}

function resetRecordButtonAndClearFlag(btn: HTMLButtonElement): void {
  isAwaitingForceConfirm = false;
  void resetRecordButton(btn);
}

function buildPrivatePageErrorMessage(reason?: string): string {
  const reasonKey = `privatePageReason_${reason?.replace('-', '') || 'cacheControl'}`;
  const reasonText = getMessage(reasonKey) || reason || 'unknown';
  return `${getMessage('errorPrefix')} PRIVATE_PAGE_DETECTED (${reasonText})`;
}

async function showTagResult(url: string): Promise<void> {
  if (!url) return;

  const panel = document.getElementById('tagResultPanel');
  if (!panel) return;

  try {
    const entries = await getSavedUrlEntries();
    const entry = entries.find(e => e.url === url);
    const tags = entry?.tags;

    if (!tags || tags.length === 0) return;

    panel.textContent = `🏷 ${getMessage('aiTagsLabel')}: ${tags.map(t => `#${t}`).join('  ')}`;
    panel.classList.remove('hidden');

    startAutoCloseTimer(4000);
  } catch {
    // タグ取得失敗はサイレントフェール
  }
}

export async function recordCurrentPage(force: boolean = false): Promise<void> {
  const startTime = performance.now();
  const statusDiv = document.getElementById('mainStatus');
  const recordBtn = document.getElementById('recordBtn') as HTMLButtonElement | null;

  if (!statusDiv) return;

  if (recordBtn) {
    recordBtn.disabled = true;
  }

  hideSpinner();
  statusDiv.textContent = '';
  statusDiv.className = '';
  const tagPanel = document.getElementById('tagResultPanel');
  if (tagPanel) { tagPanel.textContent = ''; tagPanel.classList.add('hidden'); }

  try {
    const tab = await getCurrentTab();
    if (!tab || !tab.id) throw new Error('No active tab found');

    if (!isRecordable(tab)) {
      throw new Error(getMessage('cannotRecordPage'));
    }

    const settings = await getSettings();
    const usePreview = settings[StorageKeys.PII_CONFIRMATION_UI] !== false;

    showSpinner(getMessage('fetchingContent'));
    let contentResponse: ContentResponse;
    try {
      contentResponse = await Promise.race([
        browser.tabs.sendMessage(tab.id, { type: 'GET_CONTENT' }) as Promise<ContentResponse>,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Content script response timeout')), 5000);
        })
      ]);
      if (browser.runtime.lastError) {
        throw new Error(browser.runtime.lastError.message);
      }
    } catch (e: unknown) {
      let hasPermission = false;
      try {
        hasPermission = await browser.permissions.contains({ origins: ['<all_urls>'] });
        if (!hasPermission) {
          hasPermission = await browser.permissions.request({ origins: ['<all_urls>'] });
        }
      } catch { /* パーミッション要求失敗 */ }

      if (!hasPermission) {
        throw new Error(getMessage('errorContentScriptNotAvailable'));
      }

      try {
        const results = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.body?.innerText || ''
        });
        contentResponse = { content: results?.[0]?.result || '' };
      } catch (e2: unknown) {
        if (force) {
          contentResponse = { content: '' };
        } else {
          throw new Error(getMessage('errorContentScriptNotAvailable'));
        }
      }
    }

    if (!contentResponse) {
      if (force) {
        contentResponse = { content: '' };
      } else {
        throw new Error(getMessage('errorNoContentResponse'));
      }
    }

    updateCleansingStatus(contentResponse.cleanseStats, contentResponse.cleansedReason);

    if (tab.url) {
      void updateTrustStatus(tab.url);
    }

    let result;

    if (usePreview) {
      showSpinner(getMessage('localAiProcessing'));
      const previewResponse = await sendMessageWithRetry({
        type: 'PREVIEW_RECORD',
        payload: {
          title: tab.title,
          url: tab.url,
          content: contentResponse.content,
          force: force
        }
      }) as PreviewResponse;

      if (!previewResponse) {
        const errorMsg = 'No response from background worker';
        logError('PREVIEW_RECORD failed: No response', {}, ErrorCode.CONTENT_EXTRACTION_FAILURE);
        throw new Error(errorMsg);
      }

      if (!previewResponse.success && previewResponse.error === 'PRIVATE_PAGE_DETECTED') {
        hideSpinner();
        statusDiv.textContent = buildPrivatePageErrorMessage(previewResponse.reason);
        statusDiv.className = 'error';

        if (recordBtn) {
          setRecordAnywayButton(recordBtn, tab, contentResponse.content);
        }
        return;
      }

      if (!previewResponse.success) {
        const errorMsg = previewResponse.error || 'Processing failed';
        logError('PREVIEW_RECORD failed', { response: previewResponse }, ErrorCode.CONTENT_EXTRACTION_FAILURE);
        throw new Error(errorMsg);
      }

      const shouldShowPreview = (previewResponse.maskedCount || 0) > 0;

      let finalContent = previewResponse.processedContent;

      if (shouldShowPreview) {
        hideSpinner();
        const confirmation = await showPreview(
          previewResponse.processedContent,
          previewResponse.maskedItems,
          previewResponse.maskedCount || 0,
          contentResponse.cleansedReason,
          contentResponse.cleanseStats
        );

        if (!confirmation.confirmed) {
          statusDiv.textContent = getMessage('cancelled');
          if (recordBtn) void resetRecordButton(recordBtn);
          return;
        }
        finalContent = confirmation.content || '';
      }

      showSpinner(getMessage('saving'));
      result = await sendMessageWithRetry({
        type: 'SAVE_RECORD',
        payload: {
          title: tab.title,
          url: tab.url,
          content: finalContent,
          force: force,
          maskedCount: previewResponse.maskedCount,
          aiDuration: previewResponse.aiDuration,
          pageBytes: contentResponse.byteStats?.pageBytes,
          candidateBytes: contentResponse.byteStats?.candidateBytes,
          originalBytes: contentResponse.byteStats?.originalBytes,
          cleansedBytes: contentResponse.byteStats?.cleansedBytes,
          aiSummaryOriginalBytes: contentResponse.aiSummaryCleansedStats?.aiSummaryOriginalBytes,
          aiSummaryCleansedBytes: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedBytes,
          aiSummaryCleansedElements: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedElements,
          aiSummaryCleansedReason: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedReason,
          aiSummaryCleansedReasons: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedReasons
        }
      });

    } else {
      result = await sendMessageWithRetry({
        type: 'MANUAL_RECORD',
        payload: {
          title: tab.title,
          url: tab.url,
          content: contentResponse.content,
          force: force,
          pageBytes: contentResponse.byteStats?.pageBytes,
          candidateBytes: contentResponse.byteStats?.candidateBytes,
          originalBytes: contentResponse.byteStats?.originalBytes,
          cleansedBytes: contentResponse.byteStats?.cleansedBytes,
          aiSummaryOriginalBytes: contentResponse.aiSummaryCleansedStats?.aiSummaryOriginalBytes,
          aiSummaryCleansedBytes: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedBytes,
          aiSummaryCleansedElements: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedElements,
          aiSummaryCleansedReason: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedReason,
          aiSummaryCleansedReasons: contentResponse.aiSummaryCleansedStats?.aiSummaryCleansedReasons
        }
      });
    }

    if (result && result.error === 'PRIVATE_PAGE_DETECTED') {
      hideSpinner();
      statusDiv.textContent = buildPrivatePageErrorMessage(result.reason);
      statusDiv.className = 'error';

      if (recordBtn) {
        setRecordAnywayButton(recordBtn, tab, contentResponse.content);
      }
      return;
    }

    if (result && result.success) {
      hideSpinner();

      browser.runtime.sendMessage({ type: 'ACTIVITY_UPDATE', payload: {} }).catch(() => { });

      const totalDuration = performance.now() - startTime;
      const message = formatSuccessMessage(totalDuration, result.aiDuration, result.obsidianDuration !== undefined);

      if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'success';
      }

      startAutoCloseTimer();
      await showTagResult(tab.url ?? '');
    } else {
      throw new Error(result.error || 'Save failed');
    }
  } catch (error: unknown) {
    hideSpinner();
    showError(statusDiv, error, () => recordCurrentPage(true));
  } finally {
    if (!isAwaitingForceConfirm) {
      const btn = document.getElementById('recordBtn') as HTMLButtonElement | null;
      const currentTab = await getCurrentTab();
      if (btn && currentTab && isRecordable(currentTab)) {
        await resetRecordButton(btn);
      }
    }
  }
}

export function initRecordButton(): void {
  const recordBtnInit = document.getElementById('recordBtn') as HTMLButtonElement | null;
  if (recordBtnInit) {
    recordBtnInit.onclick = () => recordCurrentPage(false);
  }
}
initRecordButton();