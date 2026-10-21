(() => {
  'use strict';

  const enabledInput = document.getElementById('enabled');
  const statusText = document.getElementById('status');
  const refreshButton = document.getElementById('refresh');

  function show(message) {
    statusText.textContent = message;
  }

  function refresh() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (chrome.runtime.lastError || !tabs || !tabs[0]) {
        show('Откройте страницу chatgpt.com для проверки.');
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GCO_STATUS' }, response => {
        if (chrome.runtime.lastError || !response) {
          show('На этой вкладке расширение не работает. Откройте chatgpt.com и обновите страницу.');
          return;
        }
        if (response.failed) {
          show('Оптимизация отключена из-за ошибки совместимости. Обновите страницу.');
        } else if (!response.supported) {
          show('Этот браузер не поддерживает нужную CSS-оптимизацию.');
        } else if (response.active) {
          show(`Активно · сообщений: ${response.messageCount}.`);
        } else if (response.enabled) {
          show(`Ожидание: ${response.messageCount} из ${response.minMessages} сообщений.`);
        } else {
          show('Выключено · интерфейс ChatGPT не изменяется.');
        }
      });
    });
  }

  enabledInput.addEventListener('change', async () => {
    enabledInput.disabled = true;
    try {
      await chrome.storage.local.set({ enabled: enabledInput.checked });
      refresh();
    } catch (error) {
      enabledInput.checked = !enabledInput.checked;
      show('Не удалось сохранить настройку.');
      console.warn('[GPT Chat Optimization] Failed to save preference.', error);
    } finally {
      enabledInput.disabled = false;
    }
  });

  refreshButton.addEventListener('click', refresh);
  chrome.storage.local.get({ enabled: false }).then(settings => {
    enabledInput.checked = settings.enabled === true;
    refresh();
  }).catch(() => show('Не удалось прочитать настройку.'));
})();
