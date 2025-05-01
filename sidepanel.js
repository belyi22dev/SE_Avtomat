console.log('sidepanel.js');

// Global state
let isAutomationRunning = false;
let currentCommandIndex = 0;
let videoTitle = ''; // Для хранения заголовка видео

// Helper: отправка ошибок в service worker
function reportError(commandName, error) {
    const msg = error && error.message ? error.message : String(error);
    console.error(`Error in ${commandName}:`, msg);
    chrome.runtime.sendMessage({
        type: 'automationError',
        command: commandName,
        message: msg
    });
}

// Command queue
const commands = [
    {
        name: 'Open SurfEarner Partner',
        execute: async () => {
            try {
                await chrome.tabs.create({ url: 'https://surfearner.com/partner' });
                await new Promise(resolve => setTimeout(resolve, 3000));
                return true;
            } catch (error) {
                reportError('Open SurfEarner Partner', error);
                return false;
            }
        }
    },
    {
        name: 'Click CPA Link',
        execute: async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => {
                        return new Promise(resolve => {
                            const findAndClickLink = () => {
                                const cpaLink = document.querySelector('a[href="/cpa"][data-ajaxe="false"].icon-puzzle-piece-solid');
                                if (cpaLink) {
                                    cpaLink.click();
                                    resolve(true);
                                } else {
                                    setTimeout(findAndClickLink, 500);
                                }
                            };
                            findAndClickLink();
                        });
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
                return true;
            } catch (error) {
                reportError('Click CPA Link', error);
                return false;
            }
        }
    },
    {
        name: 'Click Best YouTube Task',
        execute: async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: async () => {
                        function waitForSelector(selector, timeout = 30000) {
                            return new Promise((resolve, reject) => {
                                const el = document.querySelector(selector);
                                if (el) return resolve(el);
                                const obs = new MutationObserver(() => {
                                    const found = document.querySelector(selector);
                                    if (found) {
                                        obs.disconnect();
                                        resolve(found);
                                    }
                                });
                                obs.observe(document.documentElement, { childList: true, subtree: true });
                                setTimeout(() => {
                                    obs.disconnect();
                                    reject(new Error(`Timeout waiting for selector: ${selector}`));
                                }, timeout);
                            });
                        }
                        await waitForSelector('div.item.dynamic-border');
                        const items = Array.from(document.querySelectorAll('div.item.dynamic-border'));
                        const filtered = items.filter(item => {
                            const desc = item.querySelector('.row-2')?.textContent || '';
                            const hasYoutubeIcon = !!item.querySelector('.icon-youtube-brands');
                            return desc.includes('Переход + Просмотр видео на YouTube') && hasYoutubeIcon;
                        });
                        if (!filtered.length) throw new Error('No matching YouTube tasks');
                        const withPrices = filtered.map(item => {
                            const priceText = item.querySelector('.col-3 .row-2 i')?.textContent || '';
                            const num = parseFloat(priceText.replace(/[^\d,\.]/g, '').replace(',', '.'));
                            return { item, price: isNaN(num) ? 0 : num };
                        });
                        const maxPrice = Math.max(...withPrices.map(o => o.price));
                        const target = withPrices.find(o => o.price === maxPrice)?.item;
                        if (!target) throw new Error('Cannot find task with max price');
                        const performLink = target.querySelector('.row-3 .left a');
                        if (!performLink) throw new Error('"Выполнить задание" link missing');
                        performLink.click();
                        console.log('Clicked best YouTube task with price:', maxPrice);
                        return true;
                    }
                });
                return true;
            } catch (error) {
                reportError('Click Best YouTube Task', error);
                return false;
            }
        }
    },
    {
        name: 'Click Start Execution',
        execute: async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: async () => {
                        function waitForButton(timeout = 30000) {
                            return new Promise((resolve, reject) => {
                                const check = () => {
                                    const btn = Array.from(document.querySelectorAll('i.btn.blue')).find(el =>
                                        el.textContent.trim() === 'Начать выполнение' &&
                                        el.getAttribute('onclick')?.includes('open_cpa_yt_scenariy')
                                    );
                                    if (btn) return resolve(btn);
                                    if (timeout <= 0) return reject(new Error('Start button not found in time'));
                                    timeout -= 500;
                                    setTimeout(check, 500);
                                };
                                check();
                            });
                        }
                        const button = await waitForButton();
                        const titleEl = document.querySelector('div.title.noselect');
                        if (!titleEl) throw new Error('Title element missing before start');
                        window.videoTitle = titleEl.textContent.trim();
                        button.click();
                        console.log('Start Execution clicked');
                        return true;
                    }
                });
                // retrieve videoTitle from page context
                const [{ result: title }] = await chrome.scripting.executeScript({
                    target: { tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id },
                    function: () => window.videoTitle
                });
                videoTitle = title;
                console.log('videoTitle extracted:', videoTitle);
                return true;
            } catch (error) {
                reportError('Click Start Execution', error);
                return false;
            }
        }
    },
    {
        name: 'Copy Video Title',
        execute: async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const [{ result }] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => {
                        const titleEl = document.querySelector('div.title.noselect');
                        if (titleEl) return titleEl.textContent.trim();
                        throw new Error('Не найден заголовок видео');
                    }
                });
                videoTitle = result;
                console.log('Скопированный заголовок видео:', videoTitle);
                return true;
            } catch (error) {
                reportError('Copy Video Title', error);
                return false;
            }
        }
    },
    {
        name: 'Click "Перейти на канал"',
        execute: async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => {
                        const link = document.querySelector('a.btn.blue[onclick^="return cpa_check_available"]');
                        if (link) {
                            link.click();
                            return true;
                        }
                        throw new Error('Кнопка "Перейти на канал" не найдена');
                    }
                });
                return true;
            } catch (error) {
                reportError('Click "Перейти на канал"', error);
                return false;
            }
        }
    },
    {
        name: 'Find and Navigate to Video on YouTube Channel',
        execute: async () => {
            try {
                // 1. Получаем активную вкладку (это YouTube-канал)
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                // 2. Ищем URL нужного видео в контексте страницы
                const [{ result: videoUrl }] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async (searchTitle) => {
                        function waitForSelector(selector, timeout = 15000) {
                            return new Promise((resolve, reject) => {
                                const start = Date.now();
                                const check = () => {
                                    const el = document.querySelector(selector);
                                    if (el) return resolve(el);
                                    if (Date.now() - start > timeout) return reject('Видео не появились');
                                    setTimeout(check, 500);
                                };
                                check();
                            });
                        }
                        function normalize(str) {
                            return str.toLowerCase()
                                      .normalize('NFD')
                                      .replace(/[\u0300-\u036f]/g, '')
                                      .replace(/[^a-z0-9а-яё]/g, '');
                        }
                        await waitForSelector('a#video-title');
                        const links = Array.from(document.querySelectorAll('a#video-title'));
                        const normSearch = normalize(searchTitle);
                        for (const a of links) {
                            const full = (a.getAttribute('title') || a.textContent).trim();
                            const normFull = normalize(full);
                            if (normFull.includes(normSearch) || normSearch.includes(normFull)) {
                                return a.href;
                            }
                        }
                        throw new Error('Нужное видео не найдено');
                    },
                    args: [videoTitle]
                });
                if (!videoUrl) throw new Error('URL видео не получен');
                // 3. Переходим по найденному URL
                await chrome.tabs.update(tab.id, { url: videoUrl });
                console.log('Перешли на видео:', videoUrl);
                return true;
            } catch (error) {
                reportError('Find and Navigate to Video on YouTube Channel', error);
                return false;
            }
        }
    }
];

// Power button control
document.getElementById('power-button').addEventListener('change', async (event) => {
    isAutomationRunning = event.target.checked;
    if (isAutomationRunning) {
        console.log('Automation started');
        await startAutomation();
    } else {
        console.log('Automation stopped');
        currentCommandIndex = 0;
    }
});

// Automation control
async function startAutomation() {
    if (!isAutomationRunning) return;
    try {
        const command = commands[currentCommandIndex];
        const success = await command.execute();
        if (!success) {
            stopAutomation();
            return;
        }
        currentCommandIndex++;
        if (currentCommandIndex >= commands.length) {
            console.log('All commands completed');
            stopAutomation();
            return;
        }
        await startAutomation();
    } catch (error) {
        reportError('startAutomation', error);
        stopAutomation();
    }
}

function stopAutomation() {
    isAutomationRunning = false;
    document.getElementById('power-button').checked = false;
    currentCommandIndex = 0;
}

// Global error handling
window.onerror = function(message, source, lineno, colno, error) {
    reportError('Global', error || message);
    stopAutomation();
    return false;
};
