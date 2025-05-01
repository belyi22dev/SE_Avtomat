// Настройка при установке/обновлении расширения
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Обработчик сообщений для ошибок автоматизации
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'automationError') {
    console.error(`[Automation Error] ${msg.command}: ${msg.message}`);
    // Можно добавить дополнительную обработку ошибок, например:
    // - Отправку в аналитику
    // - Показ уведомления пользователю
    // - Сохранение в хранилище расширения
  }
});
