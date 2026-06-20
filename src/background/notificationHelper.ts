// src/background/notificationHelper.ts

// Notification ID prefix for privacy confirmation notifications
export const PRIVACY_CONFIRM_NOTIFICATION_PREFIX = 'privacy-confirm-';

export class NotificationHelper {
  static getIconUrl(): string {
    return browser.runtime.getURL('icons/icon48.png');
  }

  static notifySuccess(title: string, message: string): void {
    browser.notifications.create({
      type: 'basic',
      iconUrl: this.getIconUrl(),
      title,
      message
    });
  }

  static notifyError(error: unknown): void {
    const title = browser.i18n.getMessage('obsidianSyncFailed') || 'Obsidian Sync Failed';
    browser.notifications.create({
      type: 'basic',
      iconUrl: this.getIconUrl(),
      title,
      message: `Error: ${error}`
    });
  }

  /**
   * Show a privacy confirmation notification with Save / Skip buttons.
   * @param notificationId - unique ID (PRIVACY_CONFIRM_NOTIFICATION_PREFIX + encoded url)
   */
  static notifyPrivacyConfirm(notificationId: string, pageTitle: string, reason: string): void {
    const saveLabel = browser.i18n.getMessage('notifyPrivacyConfirmSave') || '保存する';
    const skipLabel = browser.i18n.getMessage('notifyPrivacyConfirmSkip') || 'スキップ';
    const title = browser.i18n.getMessage('notifyPrivacyConfirmTitle') || 'Yasumaro';
    const body = browser.i18n.getMessage('notifyPrivacyConfirmBody', [pageTitle, reason])
      || `「${pageTitle}」にプライバシー懸念があります（${reason}）。保存しますか？`;

    browser.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: this.getIconUrl(),
      title,
      message: body,
      buttons: [
        { title: saveLabel },
        { title: skipLabel }
      ],
      requireInteraction: true
    });
  }
}