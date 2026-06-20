/**
 * browser.d.ts
 * Global type definitions for the 'browser' namespace.
 * Aliases 'browser' to 'chrome' types for cross-browser compatibility.
 */

declare namespace browser {
    export import runtime = chrome.runtime;
    export import tabs = chrome.tabs;
    export import storage = chrome.storage;
    export import action = chrome.action;
    export import alarms = chrome.alarms;
    export import notifications = chrome.notifications;
    export import webRequest = chrome.webRequest;
    export import offscreen = chrome.offscreen;
    export import i18n = chrome.i18n;
    export import permissions = chrome.permissions;
    export import scripting = chrome.scripting;
}

// Ensure browser is also available as a global variable with proper types
declare const browser: typeof chrome;
