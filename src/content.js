/* GPT Chat Optimization v0.1 — no remote code, network requests, or message-content reads. */
(() => {
  'use strict';

  const SETTINGS_KEY = 'enabled';
  const STYLE_ID = 'gco-safe-style-v01';
  const MESSAGE_SELECTOR = '[data-message-author-role]';
  const MIN_MESSAGES = 40;
  const SCAN_INTERVAL_MS = 5000;
  const OPTIMIZATION_CSS = `
    /* No display:none, node removal, positioning, or input-field changes. */
    [data-message-author-role] {
      content-visibility: auto;
      contain-intrinsic-size: auto 420px;
    }
  `;

  let desired = false;
  let active = false;
  let messageCount = 0;
  let failed = false;
  let changedWhileLoading = false;

  function supported() {
    return typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('content-visibility', 'auto') &&
      CSS.supports('contain-intrinsic-size', 'auto 420px');
  }

  function removeOwnStyle() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    active = false;
  }

  function installOwnStyle() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = OPTIMIZATION_CSS;
      (document.head || document.documentElement).appendChild(style);
    }
    active = true;
  }

  function reconcile() {
    if (failed) return;
    try {
      // Only count nodes; never read, copy, edit or retain user message content.
      messageCount = document.querySelectorAll(MESSAGE_SELECTOR).length;
      if (desired && !failed && supported() && messageCount >= MIN_MESSAGES) {
        installOwnStyle();
      } else {
        removeOwnStyle();
      }
    } catch (error) {
      // Fail closed for this page session; the next reload can retry.
      failed = true;
      try { removeOwnStyle(); } catch (_) { active = false; }
      console.warn('[GPT Chat Optimization] Disabled after a page compatibility error.', error);
    }
  }

  function status() {
    return {
      enabled: desired,
      active,
      messageCount,
      minMessages: MIN_MESSAGES,
      supported: supported(),
      failed
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'GCO_STATUS') {
      reconcile();
      sendResponse(status());
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, SETTINGS_KEY)) return;
    changedWhileLoading = true;
    desired = changes[SETTINGS_KEY].newValue === true;
    reconcile();
  });

  // Avoid observers on the entire React DOM; a low-frequency scan is sufficient.
  setInterval(reconcile, SCAN_INTERVAL_MS);
  chrome.storage.local.get({ [SETTINGS_KEY]: false })
    .then(settings => {
      if (!changedWhileLoading) desired = settings[SETTINGS_KEY] === true;
      reconcile();
    })
    .catch(error => {
      desired = false;
      failed = true;
      removeOwnStyle();
      console.warn('[GPT Chat Optimization] Could not read local settings.', error);
    });
})();
