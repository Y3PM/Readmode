// 存储标签页的阅读模式状态
let readerModeStates = new Map();

// 更新图标状态
function updateIcon(tabId, isActive) {
  // 检查标签页是否存在
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      // 标签页不存在，忽略错误
      console.log(`标签页 ${tabId} 不存在，无法更新图标`);
      return;
    }
    
    const iconPath = {
      16: chrome.runtime.getURL(`icons/icon16${isActive ? '-active' : ''}.png`),
      48: chrome.runtime.getURL(`icons/icon48${isActive ? '-active' : ''}.png`),
      128: chrome.runtime.getURL(`icons/icon128${isActive ? '-active' : ''}.png`)
    };
    chrome.action.setIcon({ tabId, path: iconPath });
  });
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    // 先检查标签页是否存在，再更新图标
    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError) {
        updateIcon(tabId, false);
        readerModeStates.delete(tabId);
      }
    });
  }
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
  readerModeStates.delete(tabId);
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'readerModeStateChanged' && sender.tab) {
    const tabId = sender.tab.id;
    // 先检查标签页是否存在
    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError) {
        readerModeStates.set(tabId, message.isActive);
        updateIcon(tabId, message.isActive);
      }
    });
  }
  // 确保消息处理完成
  return false;
});

chrome.action.onClicked.addListener((tab) => {
  // 首先尝试直接调用toggle
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      if (typeof window.reader !== 'undefined') {
        window.reader.toggle();
      }
    }
  }).catch(() => {
    // 如果直接调用失败，则通过消息通信
    // 检查标签页是否存在
    chrome.tabs.get(tab.id, (tabInfo) => {
      if (chrome.runtime.lastError) {
        // 标签页不存在，忽略错误
        console.log(`标签页 ${tab.id} 不存在，无法发送消息`);
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
    });
  });
});

// 处理文本搜索请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchText' && request.text) {
    // 使用新标签页打开搜索结果，而不是使用chrome.search.query
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(request.text)}`;
    chrome.tabs.create({ url: searchUrl });
    // 发送响应，避免出现"Message sending failed"
    sendResponse({success: true});
    return true; // 表示会异步发送响应
  }
  return false;
});
