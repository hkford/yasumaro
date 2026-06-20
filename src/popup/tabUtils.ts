/**
 * tabUtils.ts
 * Utility for management of Chrome tabs in the popup UI.
 */

/**
 * Get the currently active tab in the current window.
 * @returns {Promise<browser.tabs.Tab|null>}
 */
export async function getCurrentTab(): Promise<browser.tabs.Tab | null> {
    if (!browser.tabs) return null;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab || null;
}

/**
 * Check if the given tab is recordable (HTTP/HTTPS).
 * @param {browser.tabs.Tab} tab 
 * @returns {boolean}
 */
export function isRecordable(tab: browser.tabs.Tab | undefined | null): boolean {
    return !!(tab?.url && tab.url.startsWith('http'));
}
