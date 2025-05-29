/**
 * 文本选择气泡功能
 * 在阅读模式下选中文本时显示操作气泡，提供复制和搜索功能
 */
class TextSelectionBubble {
  constructor() {
    this.bubble = null;
    this.isVisible = false;
    this.selectedText = '';
    this.isLink = false; // 添加标记，表示选中的文本是否为链接
    this.lastScrollY = 0; // 记录上次滚动位置
    this.scrollThreshold = 60; // 滚动隐藏阈值（像素），设置在40-100范围内
    this.init();
  }

  init() {
    // 创建气泡元素
    this.createBubble();
    
    // 监听文本选择事件 - 使用捕获阶段以确保我们的事件处理程序先执行
    document.addEventListener('mouseup', this.handleTextSelection.bind(this), true);
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this), true);
    
    // 点击其他区域隐藏气泡
    document.addEventListener('mousedown', (e) => {
      // 如果点击的不是气泡内的元素，则隐藏气泡
      if (this.isVisible && this.bubble && !this.bubble.contains(e.target)) {
        this.hideBubble();
      }
    }, true);
    
    // 添加键盘事件监听，支持Esc键隐藏气泡
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hideBubble();
      }
    }, true);
    
    // 添加滚动事件监听，页面滚动时自动隐藏气泡
    // 优先监听阅读模式容器的滚动事件
    const readerContainer = document.querySelector('.reader-mode');
    if (readerContainer) {
      readerContainer.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    } else {
      window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    }
  }

  createBubble() {
    // 创建气泡元素
    this.bubble = document.createElement('div');
    this.bubble.className = 'text-selection-bubble';
    this.bubble.setAttribute('role', 'dialog');
    this.bubble.setAttribute('aria-label', '文本操作');
    this.bubble.innerHTML = `
      <button class="bubble-button copy-button" title="复制">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 4V2H17V4H20.0066C20.5552 4 21 4.44495 21 4.9934V21.0066C21 21.5552 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5551 3 21.0066V4.9934C3 4.44476 3.44495 4 3.9934 4H7ZM7 6H5V20H19V6H17V8H7V6ZM9 4V6H15V4H9Z"></path>
        </svg>
      </button>
      <button class="bubble-button search-button" title="搜索">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z"></path>
        </svg>
      </button>
      <button class="bubble-button open-link-button" title="打开链接" style="display: none;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19V6.413L11.9142 13.5L10.5 12.0858L17.585 5H13V3H21Z"></path>
        </svg>
      </button>
    `;
    
    // 添加事件监听器
    const copyButton = this.bubble.querySelector('.copy-button');
    const searchButton = this.bubble.querySelector('.search-button');
    const openLinkButton = this.bubble.querySelector('.open-link-button');
    
    copyButton.addEventListener('click', this.handleCopy.bind(this));
    searchButton.addEventListener('click', this.handleSearch.bind(this));
    openLinkButton.addEventListener('click', this.handleOpenLink.bind(this));
    
    // 添加到文档中 - 使用document.documentElement而不是body，以避免某些网站的CSS干扰
    document.documentElement.appendChild(this.bubble);
  }

  handleSelectionChange() {
    // 获取当前选中的文本
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      this.selectedText = selection.toString().trim();
    } else {
      // 如果没有选中文本，隐藏气泡
      if (this.isVisible) {
        this.hideBubble();
      }
    }
  }

  handleTextSelection(e) {
    // 阻止事件冒泡，确保我们的处理程序优先执行
    e.stopPropagation();
    
    // 延迟执行，以确保选择已完成
    setTimeout(() => {
      // 获取选中的文本
      const selection = window.getSelection();
      if (!selection) return;
      
      const selectedText = selection.toString().trim();
      
      // 如果没有选中文本，隐藏气泡
      if (!selectedText) {
        if (this.isVisible) {
          this.hideBubble();
        }
        return;
      }
      
      // 保存选中的文本
      this.selectedText = selectedText;
      
      // 检查选中的文本是否为链接
      this.isLink = this.isTextLink(selectedText);
      
      // 显示或隐藏打开链接按钮
      if (this.bubble) {
        const openLinkButton = this.bubble.querySelector('.open-link-button');
        if (openLinkButton) {
          openLinkButton.style.display = this.isLink ? 'flex' : 'none';
        }
      }
      
      // 更新滚动位置记录
      const readerContainer = document.querySelector('.reader-mode');
      this.lastScrollY = readerContainer ? readerContainer.scrollTop : window.scrollY;
      
      // 始终使用鼠标位置显示气泡
      this.showBubbleAtMousePosition(e);
    }, 10); // 短暂延迟，确保选择已完成
  }

  // 在鼠标位置显示气泡
  showBubbleAtMousePosition(e) {
    if (!this.bubble || !this.selectedText) return;
    
    // 使用鼠标位置
    const mouseX = e.clientX || window.innerWidth / 2;
    const mouseY = e.clientY || window.innerHeight / 2;
    
    // 计算气泡位置
    const bubbleHeight = 40; // 气泡高度
    const bubbleWidth = 90; // 气泡宽度
    const spacing = 10; // 与鼠标的间距
    
    let left = mouseX - (bubbleWidth / 2);
    let top = mouseY - bubbleHeight - spacing;
    
    // 确保气泡不超出视口
    if (left < 10) left = 10;
    if (left + bubbleWidth > window.innerWidth - 10) {
      left = window.innerWidth - bubbleWidth - 10;
    }
    
    // 如果上方空间不足，则显示在下方
    if (top < 10) {
      top = mouseY + spacing;
    }
    
    // 设置气泡位置
    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = `${top}px`;
    
    // 显示气泡
    this.bubble.classList.add('visible');
    this.isVisible = true;
    
    // 强制重绘，解决某些网站上的显示问题
    this.bubble.offsetHeight;
  }

  // 处理页面滚动事件
  handleScroll() {
    if (!this.isVisible) return;
    
    // 获取当前滚动位置 - 优先使用阅读模式容器的滚动位置
    const readerContainer = document.querySelector('.reader-mode');
    const currentScrollY = readerContainer ? readerContainer.scrollTop : window.scrollY;
    const scrollDiff = Math.abs(currentScrollY - this.lastScrollY);
    
    // 如果滚动距离超过阈值（40-100像素），隐藏气泡
    if (scrollDiff > this.scrollThreshold) {
      this.hideBubble();
    }
  }

  hideBubble() {
    if (!this.bubble) return;
    
    // 隐藏气泡
    this.bubble.classList.remove('visible');
    this.isVisible = false;
  }

  handleCopy() {
    if (!this.selectedText) return;
    
    // 复制文本到剪贴板
    navigator.clipboard.writeText(this.selectedText)
      .then(() => {
        // 显示复制成功提示
        this.showToast('复制成功');
        // 隐藏气泡
        this.hideBubble();
      })
      .catch(err => {
        // 复制失败，显示错误提示
        this.showToast('复制失败');
      });
  }

  handleSearch() {
    if (!this.selectedText) return;
    
    // 在发送消息前检查runtime是否可用
    if (!chrome.runtime) {
      // Chrome运行时不可用
      return;
    }

    try {
      // 使用Chrome默认搜索引擎搜索选中文本
      chrome.runtime.sendMessage({
        action: 'searchText',
        text: this.selectedText
      }, (response) => {
        if (chrome.runtime.lastError) {
          // 发送消息失败
          return;
        }
      });
    } catch (error) {
      // 搜索操作失败
    }
    
    // 隐藏气泡
    this.hideBubble();
  }

  showToast(message) {
    // 创建一个临时的提示元素
    const toast = document.createElement('div');
    toast.className = 'selection-toast';
    toast.textContent = message;
    // 使用documentElement而不是body，以避免某些网站的CSS干扰
    document.documentElement.appendChild(toast);
    
    // 显示提示
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);
    
    // 2秒后移除提示
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        document.documentElement.removeChild(toast);
      }, 300);
    }, 2000);
  }

  // 判断选中的文本是否在链接元素内或者本身是URL
  isTextLink(text) {
    // 首先检查文本本身是否为URL
    const urlRegex = /^https?:\/\/[\w\-]+(\.[\w\-]+)+([\w\-.,@?^=%&:\/~+#]*[\w\-@?^=%&\/~+#])?$/;
    if (urlRegex.test(text)) {
      return true;
    }
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }
    
    try {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // 如果容器是文本节点，获取其父元素
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      
      // 检查元素本身或其祖先元素是否为链接，且链接以http或https开头
      const linkElement = element.closest('a');
      return linkElement && linkElement.href && 
             (linkElement.href.startsWith('http://') || linkElement.href.startsWith('https://'));
    } catch (error) {
      // 获取链接元素失败
      return false;
    }
  }

  // 处理打开链接
  handleOpenLink() {
    if (!this.selectedText || !this.isLink) return;
    
    // 检查文本本身是否为URL
    const urlRegex = /^https?:\/\/[\w\-]+(\.[\w\-]+)+([\w\-.,@?^=%&:\/~+#]*[\w\-@?^=%&\/~+#])?$/;
    if (urlRegex.test(this.selectedText)) {
      // 直接打开文本中的URL
      window.open(this.selectedText, '_blank');
      this.hideBubble();
      return;
    }
    
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        this.showToast('无法获取链接');
        return;
      }
      
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      const linkElement = element.closest('a');
      
      if (linkElement && linkElement.href) {
        // 在新窗口中打开链接
        window.open(linkElement.href, '_blank');
        
        // 隐藏气泡
        this.hideBubble();
      } else {
        this.showToast('无法获取链接地址');
      }
    } catch (error) {
      // 打开链接操作失败
      this.showToast('打开链接失败');
    }
  }
}

// 当页面加载完成后初始化
if (typeof window.textSelectionBubble === 'undefined') {
  window.textSelectionBubble = null;
}

// 在阅读模式启用时初始化文本选择气泡
function initTextSelectionBubble() {
  // 如果已经初始化，则不重复初始化
  if (!window.textSelectionBubble) {
    window.textSelectionBubble = new TextSelectionBubble();
    
    // 确保文本选择功能在阅读模式下正常工作
    const readerContent = document.querySelector('.reader-content');
    if (readerContent) {
      // 移除可能阻止选择的样式
      readerContent.style.userSelect = 'text';
      readerContent.style.webkitUserSelect = 'text';
      readerContent.style.MozUserSelect = 'text';
      readerContent.style.msUserSelect = 'text';
      
      // 确保所有子元素也可选择
      const allElements = readerContent.querySelectorAll('*');
      allElements.forEach(el => {
        el.style.userSelect = 'text';
        el.style.webkitUserSelect = 'text';
        el.style.MozUserSelect = 'text';
        el.style.msUserSelect = 'text';
      });
    }
  }
}

// 当阅读模式禁用时，移除文本选择气泡
function removeTextSelectionBubble() {
  if (window.textSelectionBubble) {
    // 如果气泡可见，隐藏气泡
    if (window.textSelectionBubble.isVisible) {
      window.textSelectionBubble.hideBubble();
    }
    
    // 移除气泡元素
    if (window.textSelectionBubble.bubble && window.textSelectionBubble.bubble.parentNode) {
      window.textSelectionBubble.bubble.parentNode.removeChild(window.textSelectionBubble.bubble);
    }
    
    // 重置文本选择气泡
    window.textSelectionBubble = null;
  }
}