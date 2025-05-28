class ReaderMode {
  constructor() {
    // 默认设置
    this.defaultSettings = {
      fontSize: 18,
      lineHeight: 1.75,
      paragraphSpacing: 1.6,
      width: 800,
      isDarkMode: false,
      showImages: true, // 添加图片显示设置
      darkModeColors: {
        background: '#222',
        text: '#E4E4E4',
        border: '#444',
        link: '#7CB4F5',
        heading: '#FFFFFF',
        quote: '#B4B4B4'
      },
      lightModeColors: {
        background: '#FAF9F7',
        text: '#2c3e50',
        link: '#2980b9',
        border: '#e0e0e0',
        heading: '#1a1a1a',
        quote: '#666666'
      }
    };

    this.settings = { ...this.defaultSettings };
    this.isEnabled = false;
    this.readerContainer = null;
    this.originalContent = null;

    // 创建 loading 元素
    this.loadingElement = document.createElement('div');
    this.loadingElement.className = 'reader-loading';
    this.loadingElement.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">正在准备阅读模式...</div>
    `;
    
    // 创建图片加载优化器实例
    this.imageLoader = null;
    
    // 先加载设置，再初始化
    this.loadSettings().then(() => {
      this.init();
    });
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggle') {
        this.toggle();
      }
    });
  }

  async toggle() {
    try {
      if (this.isProcessing) {
        // 移除console.log
        return;
      }

      this.isProcessing = true;

      if (this.isEnabled) {
        this.disable();
        return;
      }
      
      // 每次启用阅读模式时，重置图片显示状态为默认值（显示图片）
      this.settings.showImages = this.defaultSettings.showImages;

      // 保存原始内容
      this.originalContent = document.body.innerHTML;
      
      // 显示loading
      this.showLoading();

      try {
        // 解析文章内容
        const article = await this.parseContent();
        if (!article || !article.content) {
          throw new Error('当前页面无法进入阅读模式');
        }

        // 创建阅读模式
        this.createReaderMode(article);
        
        // 初始化图片加载优化器
        if (!this.imageLoader) {
          this.imageLoader = new ImageLoader();
          this.imageLoader.init(this.readerContainer);
          
          // 添加延迟，确保自动滚动预加载有足够时间完成
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // 设置状态
        this.isEnabled = true;
        
        // 初始化滚动处理
        this.initScrollHandler();
        
        // 发送状态更新，添加错误处理
        chrome.runtime.sendMessage({ action: 'readerModeStateChanged', isActive: true }, response => {
          if (chrome.runtime.lastError) {
            // 移除console.log
            // 错误已处理，不需要进一步操作
          }
        });
      } catch (error) {
        // 移除console.error
        // 恢复原始内容
        if (this.originalContent) {
          document.body.innerHTML = this.originalContent;
          this.originalContent = null;
        }
        // 移除loading
        this.hideLoading();
        // 显示错误提示
        this.showErrorMessage(error.message || '无法进入阅读模式');
        throw error;
      }
    } catch (error) {
      // 移除console.error
      // 确保状态被重置
      this.isEnabled = false;
      this.isProcessing = false;
      this.readerContainer = null;
      
      // 移除滚动监听器
      window.removeEventListener('scroll', this.handleScroll);
      
      // 发送状态更新，添加错误处理
      chrome.runtime.sendMessage({ action: 'readerModeStateChanged', isActive: false }, response => {
        if (chrome.runtime.lastError) {
          // 移除console.log
          // 错误已处理，不需要进一步操作
        }
      });
      
      // 确保body的overflow样式被重置
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    } finally {
      this.isProcessing = false;
    }
  }

  showLoading() {
    // 移除可能存在的loading界面
    const existingLoading = document.querySelectorAll('.reader-loading');
    existingLoading.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    // 创建新的loading界面
    this.loadingElement = document.createElement('div');
    this.loadingElement.className = 'reader-loading';
    this.loadingElement.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">正在准备阅读模式...</div>
    `;
    
    // 添加到页面
    document.body.appendChild(this.loadingElement);
  }

  hideLoading() {
    // 移除loading界面
    if (this.loadingElement && this.loadingElement.parentNode) {
      this.loadingElement.parentNode.removeChild(this.loadingElement);
    }
    
    // 移除所有可能存在的loading界面
    const loadingElements = document.querySelectorAll('.reader-loading');
    loadingElements.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  }

  // 检查页面是否适合阅读模式
  isPageSuitableForReading() {
    // 检查是否是特殊页面类型
    const url = window.location.href;
    const hostname = window.location.hostname;
    
    // 排除不适合的页面类型
    const excludePatterns = [
      /\/search\?/,  // 搜索结果页
      /\/login/,     // 登录页
      /\/register/,  // 注册页
      /\/checkout/,  // 结账页
      /\/cart/,     // 购物车页
      /\/admin/,    // 管理页面
      /\/api\//,    // API接口
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i  // 文档文件
    ];
    
    if (excludePatterns.some(pattern => pattern.test(url))) {
      return false;
    }
    
    // 检查页面内容
    const textContent = document.body.textContent || '';
    const cleanText = textContent.replace(/\s+/g, ' ').trim();
    
    // 内容太少
    if (cleanText.length < 200) {
      return false;
    }
    
    // 检查是否有足够的段落内容
    const paragraphs = document.querySelectorAll('p, div, article, section');
    let meaningfulParagraphs = 0;
    
    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      if (text.length > 50) {
        meaningfulParagraphs++;
      }
    });
    
    // 至少需要3个有意义的段落
    if (meaningfulParagraphs < 3) {
      return false;
    }
    
    return true;
  }

  // 显示错误提示
  showErrorMessage(message) {
    // 移除可能存在的错误提示
    const existingError = document.querySelectorAll('.reader-error-message');
    existingError.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    // 创建错误提示元素
    const errorElement = document.createElement('div');
    errorElement.className = 'reader-error-message';
    errorElement.innerHTML = `
      <div class="error-content">
        <div class="error-icon">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
           </svg>
         </div>
        <div class="error-text">
          <div class="error-title">无法进入阅读模式</div>
          <div class="error-description">${message}</div>
          <div class="error-suggestions">
            <p>建议尝试：</p>
            <ul>
              <li>确保页面已完全加载</li>
              <li>尝试在包含文章内容的页面使用</li>
              <li>避免在搜索页面、登录页面等使用</li>
            </ul>
          </div>
        </div>
        <button class="error-close-btn" onclick="this.parentElement.parentElement.remove()">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    `;
    
    // 添加到页面
    document.body.appendChild(errorElement);
    
    // 3秒后自动消失
    setTimeout(() => {
      if (errorElement && errorElement.parentNode) {
        errorElement.style.opacity = '0';
        setTimeout(() => {
          if (errorElement && errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
          }
        }, 300);
      }
    }, 5000);
  }

  async parseContent() {
    try {
      // 检查页面是否适合阅读模式
      if (!this.isPageSuitableForReading()) {
        throw new Error('当前页面不适合阅读模式，请尝试访问包含文章内容的页面');
      }
      
      // 创建一个副本以避免修改原始DOM
      const documentClone = document.cloneNode(true);
      
      // 使用 Readability 解析内容
      const article = new Readability(documentClone).parse();
      
      if (!article) {
        throw new Error('当前页面无法解析为阅读模式，可能不包含足够的文章内容');
      }
      
      // 检查解析出的内容是否足够
      if (!article.content || article.content.trim().length < 100) {
        throw new Error('页面内容过少，无法进入阅读模式');
      }
      
      return article;
    } catch (error) {
      // 移除console.error
      this.hideLoading();
      throw error;
    }
  }

  cleanContent(element) {
    // 如果是文本节点，清理空格和缩进
    if (element.nodeType === Node.TEXT_NODE) {
      // 清理各种空白字符，包括中英文场景
      element.textContent = element.textContent
        .replace(/^[\s\u3000\u2000-\u200A\uFEFF\t\n\r]+|[\s\u3000\u2000-\u200A\uFEFF\t\n\r]+$/g, '') // 移除首尾的所有类型空白字符
        .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2') // 移除中文字符之间的空格
        // 优化中文与英文/数字之间的空格处理
        .replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2') // 在中文和英文/数字之间添加空格
        .replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2') // 在英文/数字和中文之间添加空格
        // 处理中文标点与英文/数字之间的空格
        .replace(/([，。！？；："'）】》])/g, '$1 ') // 在中文标点后添加空格
        .replace(/([（【《])/g, ' $1') // 在中文左括号前添加空格
    }

    // 如果是元素节点
    if (element.nodeType === Node.ELEMENT_NODE) {
      // 获取所有子节点的数组副本（因为我们会修改节点列表）
      const children = Array.from(element.childNodes);
      
      // 递归处理每个子节点
      children.forEach(child => this.cleanContent(child));

      // 检查元素是否为空或只包含空白字符
      const isEmpty = !element.textContent.trim() && 
                     !element.querySelector('img,br,hr,iframe,video,audio');

      // 如果是空元素且不是特殊标签，则移除
      if (isEmpty && !['IMG', 'BR', 'HR', 'IFRAME', 'VIDEO', 'AUDIO'].includes(element.tagName)) {
        element.parentNode?.removeChild(element);
        return;
      }

      // 移除多余的空格，并确保段落开头没有空白
      if (element.tagName === 'P') {
        // 特别处理段落开头的全角空格和其他空白字符
        element.innerHTML = element.innerHTML
          .replace(/^[\s\u3000\u2000-\u200A\uFEFF\t\n\r]+/g, '') // 移除开头的空白字符
          .replace(/(>[\s\u3000\u2000-\u200A\uFEFF\t\n\r]+)/g, '>') // 移除标签后的空白字符
          .replace(/([\s\u3000\u2000-\u200A\uFEFF\t\n\r]+)<\//g, '</') // 移除标签前的空白字符
          .trim();
        
        // 处理段落内的文本节点
        const textNodes = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        textNodes.forEach(node => {
          if (node.textContent) {
            node.textContent = node.textContent
              .replace(/^[\s\u3000\u2000-\u200A\uFEFF\t\n\r]+|[\s\u3000\u2000-\u200A\uFEFF\t\n\r]+$/g, '') // 移除首尾空白
              .replace(/[\s\u3000\u2000-\u200A\uFEFF\t\n\r]+/g, ' '); // 多个空白替换为一个
          }
        });
      } else {
        element.innerHTML = element.innerHTML
          .replace(/[\s\u00A0]+/g, ' ')
          .trim();
      }
    }
  }

  async createReaderMode(article) {
    // 确保设置已加载
    await this.loadSettings();
    
    // 创建阅读模式容器
    this.readerContainer = document.createElement('div');
    this.readerContainer.className = 'reader-mode';
    
    // 始终设置data-show-images属性，确保每次都使用当前设置
    this.readerContainer.setAttribute('data-show-images', this.settings.showImages.toString());
    
    // 清理原始内容中的class和id
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content;
    
    // 递归移除所有元素的class、id和style，并清理空段落
    const cleanElement = (element) => {
      // 如果元素是空的或只包含空白字符，且不是特殊元素，则移除该元素
      if (element.nodeType === 1 && 
          !['IMG', 'BR', 'HR', 'IFRAME', 'VIDEO', 'AUDIO'].includes(element.tagName) && 
          !element.textContent.trim() && 
          !element.querySelector('img,br,hr,iframe,video,audio')) {
        element.parentNode?.removeChild(element);
        return;
      }

      // 移除所有属性，除了一些必要的属性
      if (element.attributes) {
        const attrs = Array.from(element.attributes);
        attrs.forEach(attr => {
          const name = attr.name;
          if (!['src', 'href', 'alt', 'target', 'rel'].includes(name)) {
            element.removeAttribute(name);
          }
        });
      }
      
      // 递归处理子元素
      if (element.children) {
        Array.from(element.children).forEach(cleanElement);
      }
    };
    
    // 先进行内容清理
    this.cleanContent(tempDiv);
    // 再进行属性清理
    cleanElement(tempDiv);
    
    // 处理图片链接，确保链接到自身图片的情况下不会跳转
    const imgLinks = tempDiv.querySelectorAll('a');
    imgLinks.forEach(link => {
      const img = link.querySelector('img');
      if (img && link.href) {
        // 保留链接的href属性，但确保它有target和rel属性
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
    
    article.content = tempDiv.innerHTML;
    

    

    
    // 添加点击空白区域关闭设置面板的事件
    this.readerContainer.addEventListener('click', (e) => {
      if (!this.readerContainer) return;
      
      const settingsPanel = this.readerContainer.querySelector('.settings-panel');
      const settingsButton = this.readerContainer.querySelector('.settings-button');
      
      if (!settingsPanel || !settingsButton) return;

      // 如果点击的不是设置面板内部元素且不是设置按钮，则关闭设置面板
      if (settingsPanel && !settingsPanel.contains(e.target) && e.target !== settingsButton) {
        settingsPanel.classList.add('collapsed');
      }
    });
    
    // 创建内容容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'reader-content';

    // 创建图片预览遮罩层
    const imageOverlay = document.createElement('div');
    imageOverlay.className = 'image-overlay';
    this.readerContainer.appendChild(imageOverlay);
    


    // 添加标题
    if (article.title) {
      const titleElement = document.createElement('h1');
      titleElement.className = 'reader-title';
      titleElement.textContent = article.title;
      contentContainer.appendChild(titleElement);
    }
    
    // 添加主要内容
    const mainContent = document.createElement('div');
    mainContent.innerHTML = article.content;
    contentContainer.appendChild(mainContent);

    // 为所有图片添加点击事件
    const images = mainContent.getElementsByTagName('img');
    const overlay = this.readerContainer.querySelector('.image-overlay');
    
    // 创建图片控制按钮容器
    const imageControls = document.createElement('div');
    imageControls.className = 'image-controls';
    imageControls.innerHTML = `
      <button class="image-control prev-image" aria-label="上一张图片">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path></svg>
      </button>
      <button class="image-control next-image" aria-label="下一张图片">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path></svg>
      </button>
    `;
    overlay.appendChild(imageControls);
    
    // 处理图片尺寸显示：小图片原尺寸，大图片满宽显示
    Array.from(images).forEach(img => {
      // 图片加载完成后检查尺寸
      if (img.complete) {
        this.handleImageSize(img);
      } else {
        img.onload = () => this.handleImageSize(img);
      }
    });

    let currentImageIndex = 0;
    const imageArray = Array.from(images);

    // 图片点击事件处理
    imageArray.forEach((img, index) => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault(); // 阻止默认行为，防止链接跳转
        
        // 检查图片是否在链接内
        const parentLink = img.closest('a');
        if (parentLink && parentLink.href) {
          // 不管链接指向哪里，都进入读图模式，不再跳转外部链接
          currentImageIndex = index;
          showImage(currentImageIndex);
          overlay.style.display = 'flex';
        } else {
          // 图片不在链接内，正常进入读图模式
          currentImageIndex = index;
          showImage(currentImageIndex);
          overlay.style.display = 'flex';
        }
      });
    });

    // 创建缩放信息显示元素
    const zoomInfo = document.createElement('div');
    zoomInfo.className = 'zoom-info';
    zoomInfo.innerHTML = '缩放: 100% (滚轮缩放 / 双击切换)';
    zoomInfo.style.display = 'none';
    overlay.appendChild(zoomInfo);
    
    // 更新缩放信息的函数
    const updateZoomInfo = (scale) => {
      const percentage = Math.round(scale * 100);
      zoomInfo.innerHTML = `缩放: ${percentage}% (滚轮缩放 / 双击切换)`;
      zoomInfo.style.display = 'block';
      
      // 3秒后隐藏缩放信息
      clearTimeout(zoomInfo.timer);
      zoomInfo.timer = setTimeout(() => {
        zoomInfo.style.display = 'none';
      }, 3000);
    };
    
    // 显示指定索引的图片
    const showImage = (index) => {
      const img = imageArray[index];
      overlay.querySelector('img')?.remove();
      const newImg = document.createElement('img');
      newImg.src = img.src;
      newImg.alt = img.alt || '';
      newImg.dataset.originalWidth = img.naturalWidth;
      newImg.dataset.originalHeight = img.naturalHeight;
      newImg.dataset.scale = 1;
      overlay.insertBefore(newImg, imageControls);
      
      // 重置缩放和位置
      translateX = 0;
      translateY = 0;
      
      // 更新按钮状态
      overlay.querySelector('.prev-image').disabled = index === 0;
      overlay.querySelector('.next-image').disabled = index === imageArray.length - 1;
      
      // 显示初始缩放信息
      updateZoomInfo(1);
    };
    
    // 声明缩放变量
    let translateX = 0, translateY = 0;

    // 添加控制按钮事件
    overlay.querySelector('.prev-image').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentImageIndex > 0) {
        currentImageIndex--;
        showImage(currentImageIndex);
      }
    });

    overlay.querySelector('.next-image').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentImageIndex < imageArray.length - 1) {
        currentImageIndex++;
        showImage(currentImageIndex);
      }
    });
    
    // 添加键盘左右键切换图片功能
    const handleKeyDown = (e) => {
      if (overlay.style.display === 'flex') {
        if (e.key === 'ArrowLeft' || e.key === 'Left') {
          if (currentImageIndex > 0) {
            currentImageIndex--;
            showImage(currentImageIndex);
          }
        } else if (e.key === 'ArrowRight' || e.key === 'Right') {
          if (currentImageIndex < imageArray.length - 1) {
            currentImageIndex++;
            showImage(currentImageIndex);
          }
        }
        // ESC键处理已移至全局阅读模式ESC键处理器中
      }
    };
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleKeyDown);
    
    // 在overlay关闭时移除键盘事件监听
    const removeKeyListener = () => {
      if (overlay.style.display === 'none') {
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    overlay.addEventListener('transitionend', removeKeyListener);


    
    // 遮罩层点击事件处理
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
    
    // 添加图片缩放功能
    overlay.addEventListener('wheel', (e) => {
      e.preventDefault();
      const img = overlay.querySelector('img');
      if (!img) return;
      
      // 获取当前缩放比例
      let scale = parseFloat(img.dataset.scale || 1);
      
      // 根据滚轮方向调整缩放比例
      if (e.deltaY < 0) {
        // 向上滚动，放大
        scale = Math.min(scale + 0.1, 3); // 最大放大到3倍
      } else {
        // 向下滚动，缩小
        scale = Math.max(scale - 0.1, 0.5); // 最小缩小到0.5倍
      }
      
      // 更新缩放比例
      img.style.transform = `scale(${scale})`;
      img.dataset.scale = scale;
      
      // 更新缩放提示
      updateZoomInfo(scale);
    });
    
    // 移除图片拖动功能，仅保留缩放功能
    // 图片拖动相关变量
    let isDragging = false;
    let startX, startY;
    
    // 注意：已移除图片拖动相关的事件监听器，根据需求去掉移动图片相关的功能
    
    
    // 添加双击切换缩放比例功能
    overlay.addEventListener('dblclick', (e) => {
      const img = overlay.querySelector('img');
      if (!img || e.target === overlay) return;
      
      // 获取当前缩放比例
      let scale = parseFloat(img.dataset.scale || 1);
      
      // 在1倍和适合屏幕大小之间切换
      if (Math.abs(scale - 1) < 0.1) {
        // 当前接近1倍，切换到适合屏幕大小
        const viewportWidth = window.innerWidth * 0.9;
        const viewportHeight = window.innerHeight * 0.9;
        const imgWidth = parseFloat(img.dataset.originalWidth);
        const imgHeight = parseFloat(img.dataset.originalHeight);
        
        // 计算适合屏幕的缩放比例
        const widthRatio = viewportWidth / imgWidth;
        const heightRatio = viewportHeight / imgHeight;
        scale = Math.min(widthRatio, heightRatio);
      } else {
        // 当前不是1倍，切换回1倍
        scale = 1;
        // 重置位置
        translateX = 0;
        translateY = 0;
      }
      
      // 更新缩放比例
      if (translateX === 0 && translateY === 0) {
        img.style.transform = `scale(${scale})`;
      } else {
        img.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
      }
      img.dataset.scale = scale;
      
      // 更新缩放提示
      updateZoomInfo(scale);
    });
    
    
    // 创建左侧按钮组（大纲按钮）
    const leftButtonGroup = document.createElement('div');
    leftButtonGroup.className = 'reader-button-group left';

    // 创建右侧按钮组
    const rightButtonGroup = document.createElement('div');
    rightButtonGroup.className = 'reader-button-group right';

    // 创建大纲切换按钮
    const outlineToggleButton = document.createElement('button');
    outlineToggleButton.className = 'reader-button outline-toggle-button';
    outlineToggleButton.setAttribute('aria-label', '切换大纲显示');
    outlineToggleButton.setAttribute('title', '切换大纲显示');
    outlineToggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 22H4C3.44772 22 3 21.5523 3 21V3C3 2.44772 3.44772 2 4 2H20C20.5523 2 21 2.44772 21 3V21C21 21.5523 20.5523 22 20 22ZM19 20V4H5V20H19ZM8 7H16V9H8V7ZM8 11H16V13H8V11ZM8 15H13V17H8V15Z"></path></svg>';
    
    // 添加大纲切换按钮点击事件
    outlineToggleButton.addEventListener('click', () => {
      // 获取大纲容器
      const outlineContainer = document.querySelector('.article-outline');
      if (outlineContainer) {
        // 切换大纲显示/隐藏
        if (outlineContainer.classList.contains('collapsed')) {
          outlineContainer.classList.remove('collapsed');
        } else {
          outlineContainer.classList.add('collapsed');
        }
      }
    });

    // 创建设置按钮
    const settingsButton = document.createElement('button');
    settingsButton.className = 'reader-button settings-button';
    settingsButton.setAttribute('aria-label', '设置');
    settingsButton.setAttribute('title', '设置');
    settingsButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l9.5 5.5v11L12 23l-9.5-5.5v-11L12 1zm0 2.311L4.5 7.653v8.694l7.5 4.342 7.5-4.342V7.653L12 3.311zM12 16a4 4 0 110-8 4 4 0 010 8zm0-2a2 2 0 100-4 2 2 0 000 4z"></path></svg>';

    // 添加设置按钮点击事件
    settingsButton.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      const settingsPanel = this.readerContainer.querySelector('.settings-panel');
      if (settingsPanel) {
        settingsPanel.classList.toggle('collapsed');
      }
    });

    // 创建图片显示/隐藏按钮
    const imageToggleButton = document.createElement('button');
    imageToggleButton.className = 'reader-button image-toggle-button';
    imageToggleButton.setAttribute('aria-label', this.settings.showImages ? '隐藏图片' : '显示图片');
    imageToggleButton.setAttribute('title', this.settings.showImages ? '隐藏图片' : '显示图片');
    imageToggleButton.innerHTML = this.settings.showImages ? 
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15ZM20 17.8284L14 11.8284L6.82843 19H20V17.8284ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z"></path></svg>' : 
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.7134 8.12811L20.4668 8.69379C20.2864 9.10792 19.7136 9.10792 19.5331 8.69379L19.2866 8.12811C18.8471 7.11947 18.0555 6.31641 17.0677 5.87708L16.308 5.53922C15.8973 5.35653 15.8973 4.75881 16.308 4.57612L17.0252 4.25714C18.0384 3.80651 18.8442 2.97373 19.2761 1.93083L19.5293 1.31953C19.7058 0.893489 20.2942 0.893489 20.4706 1.31953L20.7238 1.93083C21.1558 2.97373 21.9616 3.80651 22.9748 4.25714L23.6919 4.57612C24.1027 4.75881 24.1027 5.35653 23.6919 5.53922L22.9323 5.87708C21.9445 6.31641 21.1529 7.11947 20.7134 8.12811ZM2.9918 3H14V5H4V19L13.2923 9.70649C13.6828 9.31595 14.3159 9.31591 14.7065 9.70641L20 15.0104V11H22V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z"></path></svg>';

    // 添加图片切换按钮点击事件
    imageToggleButton.addEventListener('click', () => {
      this.toggleImages();
    });

    // 创建复制Markdown按钮
    const markdownCopy = new MarkdownCopy();
    const markdownCopyButton = markdownCopy.createCopyButton();
    markdownCopyButton.className = 'reader-button markdown-copy-button';

    // 创建AI摘要按钮
    const aiSummary = new AISummary();
    window.aiSummaryInstance = aiSummary; // 保存实例以便在设置面板中访问
    const aiSummaryButton = aiSummary.createSummaryButton();
    aiSummaryButton.className = 'reader-button ai-summary-button';

    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.className = 'reader-button close-button';
    closeButton.setAttribute('aria-label', '关闭阅读模式');
    closeButton.setAttribute('title', '关闭阅读模式');
    closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.5859 12L2.79297 4.20706L4.20718 2.79285L12.0001 10.5857L19.793 2.79285L21.2072 4.20706L13.4143 12L21.2072 19.7928L19.793 21.2071L12.0001 13.4142L4.20718 21.2071L2.79297 19.7928L10.5859 12Z"></path></svg>';
    closeButton.addEventListener('click', () => {
      this.disable();
    });

    // 将按钮添加到对应的按钮组
    leftButtonGroup.appendChild(outlineToggleButton);
    
    rightButtonGroup.appendChild(aiSummaryButton);
    rightButtonGroup.appendChild(markdownCopyButton);
    rightButtonGroup.appendChild(imageToggleButton);
    rightButtonGroup.appendChild(settingsButton);
    rightButtonGroup.appendChild(closeButton);

    // 添加配置控制
    const controls = this.createControls();
    this.readerContainer.appendChild(leftButtonGroup);
    this.readerContainer.appendChild(rightButtonGroup);
    this.readerContainer.appendChild(contentContainer);
    this.readerContainer.appendChild(controls);
    
    // 应用主题和样式
    this.applyTheme();
    this.updateStyles();
    
    // 移除 loading
    if (this.loadingElement.parentNode) {
      this.loadingElement.remove();
    }
    
    // 替换页面内容
    document.body.innerHTML = '';
    document.body.appendChild(this.readerContainer);

    // 添加ESC键盘事件监听器
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        // 检查是否有读图模式的overlay正在显示
        const imageOverlay = document.querySelector('.image-overlay');
        if (imageOverlay && imageOverlay.style.display === 'flex') {
          // 如果读图模式正在显示，先退出读图模式
          imageOverlay.style.display = 'none';
        } else {
          // 如果没有读图模式，则退出阅读模式
          this.disable();
        }
      }
    });
    
    // 初始化文本选择气泡功能
    if (typeof initTextSelectionBubble === 'function') {
      initTextSelectionBubble();
    }
    
    // 初始化文章大纲功能
    if (typeof ArticleOutline === 'function') {
      const outline = new ArticleOutline();
      outline.init(this.readerContainer, contentContainer);
    }
    
    // 初始化阅读进度条功能
    if (typeof ReadingProgress === 'function') {
      const progress = new ReadingProgress();
      progress.init(this.readerContainer);
    }
  }

  initScrollHandler() {
    // 移除之前的监听器（如果有）
    window.removeEventListener('scroll', this.handleScroll);
    
    // 添加新的滚动监听器
    window.addEventListener('scroll', this.handleScroll);
    
    // 初始化防抖定时器
    this.scrollTimer = null;
    this.scrollTimeout = null;
  }

  handleScroll = () => {
    // 清除之前的定时器
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    
    // 获取设置面板
    const settingsPanel = this.readerContainer.querySelector('.settings-panel');
    if (!settingsPanel) return;
    
    // 滚动时隐藏设置面板
    settingsPanel.classList.add('collapsed');
  }

  disable() {
    if (!this.isEnabled) return;
    
    try {
      // 移除loading界面
      const loadingElements = document.querySelectorAll('.reader-loading');
      loadingElements.forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      
      // 恢复原始内容
      if (this.originalContent) {
        document.body.innerHTML = this.originalContent;
        this.originalContent = null;
      }
      
      // 重置状态
      this.isEnabled = false;
      this.isProcessing = false;
      this.readerContainer = null;
      
      // 移除滚动监听器
      window.removeEventListener('scroll', this.handleScroll);
      
      // 发送状态更新，添加错误处理
      chrome.runtime.sendMessage({ action: 'readerModeStateChanged', isActive: false }, response => {
        if (chrome.runtime.lastError) {
          // 移除console.log
          // 错误已处理，不需要进一步操作
        }
      });
      
      // 确保body的overflow样式被重置
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    } catch (error) {
      // 禁用阅读模式时出错
      // 确保即使出错也重置状态
      this.isEnabled = false;
      this.isProcessing = false;
      
      // 确保loading界面被移除
      const loadingElements = document.querySelectorAll('.reader-loading');
      loadingElements.forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }
  }

  createControls() {
    const controls = document.createElement('div');
    controls.className = 'settings-panel collapsed';  // 默认隐藏
    
    // 创建设置内容容器
    const settingsContent = document.createElement('div');
    settingsContent.className = 'settings-content';
    controls.appendChild(settingsContent);
    
    // 创建图片切换按钮
    const imageToggleButton = document.createElement('button');
    imageToggleButton.className = 'image-toggle-button';
    imageToggleButton.setAttribute('aria-label', this.settings.showImages ? '隐藏图片' : '显示图片');
    imageToggleButton.setAttribute('title', this.settings.showImages ? '隐藏图片' : '显示图片');
    imageToggleButton.innerHTML = this.settings.showImages ? 
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15ZM20 17.8284L14 11.8284L6.82843 19H20V17.8284ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z"></path></svg>' : 
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.7134 8.12811L20.4668 8.69379C20.2864 9.10792 19.7136 9.10792 19.5331 8.69379L19.2866 8.12811C18.8471 7.11947 18.0555 6.31641 17.0677 5.87708L16.308 5.53922C15.8973 5.35653 15.8973 4.75881 16.308 4.57612L17.0252 4.25714C18.0384 3.80651 18.8442 2.97373 19.2761 1.93083L19.5293 1.31953C19.7058 0.893489 20.2942 0.893489 20.4706 1.31953L20.7238 1.93083C21.1558 2.97373 21.9616 3.80651 22.9748 4.25714L23.6919 4.57612C24.1027 4.75881 24.1027 5.35653 23.6919 5.53922L22.9323 5.87708C21.9445 6.31641 21.1529 7.11947 20.7134 8.12811ZM2.9918 3H14V5H4V19L13.2923 9.70649C13.6828 9.31595 14.3159 9.31591 14.7065 9.70641L20 15.0104V11H22V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z"></path></svg>'

    // 添加事件委托
    settingsContent.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      // 处理颜色选项点击
      if (button.classList.contains('color-option')) {
        const color = button.dataset.color;
        if (!color) return;

        // 更新激活状态
        const colorOptions = button.closest('.color-options');
        if (colorOptions) {
          colorOptions.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('active');
          });
          button.classList.add('active');

          // 更新颜色设置
          if (this.settings.isDarkMode) {
            this.settings.darkModeColors.background = color;
          } else {
            this.settings.lightModeColors.background = color;
          }

          this.applyTheme();
          this.saveSettings();
        }
        return;
      }

      // 处理其他按钮动作
      const action = button.dataset.action;
      if (!action) return;

      switch (action) {
        case 'toggle-theme':
          this.toggleDarkMode();
          break;
        case 'decrease-font':
          this.settings.fontSize = Math.max(14, this.settings.fontSize - 2);
          this.updateStyles();
          break;
        case 'increase-font':
          this.settings.fontSize = Math.min(24, this.settings.fontSize + 2);
          this.updateStyles();
          break;
        case 'decrease-line-height':
          this.settings.lineHeight = Math.max(1.5, this.settings.lineHeight - 0.25);
          this.updateStyles();
          break;
        case 'increase-line-height':
          this.settings.lineHeight = Math.min(2.25, this.settings.lineHeight + 0.25);
          this.updateStyles();
          break;
        case 'decrease-spacing':
          this.settings.paragraphSpacing = Math.max(1.2, this.settings.paragraphSpacing - 0.2);
          this.updateStyles();
          break;
        case 'increase-spacing':
          this.settings.paragraphSpacing = Math.min(2.4, this.settings.paragraphSpacing + 0.2);
          this.updateStyles();
          break;
        case 'decrease-width':
          this.settings.width = Math.max(640, this.settings.width - 80);
          this.updateStyles();
          break;
        case 'increase-width':
          this.settings.width = Math.min(1200, this.settings.width + 80);
          this.updateStyles();
          break;
      }
    });
    
    // 添加控制组件到设置内容容器
    const themeControls = this.createThemeControls();
    const textControls = this.createTextControls();
    const layoutControls = this.createLayoutControls();
    const apiControls = this.createApiControls();
    
    settingsContent.appendChild(themeControls);
    settingsContent.appendChild(textControls);
    settingsContent.appendChild(layoutControls);
    settingsContent.appendChild(apiControls);

    return controls;
  }

  createThemeControls() {
    const group = document.createElement('div');
    group.className = 'control-group theme-controls';
    
    // 主题切换按钮
    const themeToggle = document.createElement('button');
    themeToggle.className = 'control-button theme-toggle';
    themeToggle.setAttribute('data-action', 'toggle-theme');
    themeToggle.innerHTML = `
      <svg class="theme-icon light" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9s9-4.03 9-9c0-.46-.04-.92-.1-1.36c-.98 1.37-2.58 2.26-4.4 2.26c-3.03 0-5.5-2.47-5.5-5.5c0-1.82.89-3.42 2.26-4.4c-.44-.06-.9-.1-1.36-.1z"/>
      </svg>
      <svg class="theme-icon dark" viewBox="0 0 24 24" style="display: none">
        <path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0c-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0c-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0c.39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
      </svg>
    `;

    // 背景色选择器
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker';
    // colorPicker.innerHTML = '<span class="control-label">背景色</span>';
    
    const colorOptions = document.createElement('div');
    colorOptions.className = 'color-options';
    
    const colors = this.settings.isDarkMode ? 
      ['#1a1a1a', '#242424', '#2d2d2d', '#333333', '#404040'] : 
      ['#FFFFFF', '#FDFBF7', '#FAF9F7', '#F8F6F0', '#F4F1E8'];
    
    colors.forEach(color => {
      const option = document.createElement('button');
      option.className = 'color-option';
      option.style.backgroundColor = color;
      option.setAttribute('data-color', color);
      option.setAttribute('aria-label', `设置背景色为 ${color}`);
      if (this.settings.isDarkMode ? 
          color === this.settings.darkModeColors.background : 
          color === this.settings.lightModeColors.background) {
        option.classList.add('active');
      }
      colorOptions.appendChild(option);
    });

    colorPicker.appendChild(colorOptions);
    
    group.appendChild(colorPicker);
    group.appendChild(themeToggle);

    return group;
  }

  createTextControls() {
    const group = document.createElement('div');
    group.className = 'control-group text-controls';

    // 字体大小控制
    const fontSizeControl = document.createElement('div');
    fontSizeControl.className = 'size-control';
    fontSizeControl.innerHTML = `
      <span class="control-label">字体大小</span>
      <div class="button-group">
        <button class="control-button" data-action="decrease-font">-</button>
        <button class="control-button" data-action="increase-font">+</button>
      </div>
    `;

    // 行高控制
    const lineHeightControl = document.createElement('div');
    lineHeightControl.className = 'size-control';
    lineHeightControl.innerHTML = `
      <span class="control-label">行间距</span>
      <div class="button-group">
        <button class="control-button" data-action="decrease-line-height">-</button>
        <button class="control-button" data-action="increase-line-height">+</button>
      </div>
    `;

    group.appendChild(fontSizeControl);
    group.appendChild(lineHeightControl);

    return group;
  }

  createLayoutControls() {
    const group = document.createElement('div');
    group.className = 'control-group layout-controls';

    // 段落间距控制
    const spacingControl = document.createElement('div');
    spacingControl.className = 'size-control';
    spacingControl.innerHTML = `
      <span class="control-label">段落间距</span>
      <div class="button-group">
        <button class="control-button" data-action="decrease-spacing">-</button>
        <button class="control-button" data-action="increase-spacing">+</button>
      </div>
    `;

    // 内容宽度控制
    const widthControl = document.createElement('div');
    widthControl.className = 'size-control';
    widthControl.innerHTML = `
      <span class="control-label">内容宽度</span>
      <div class="button-group">
        <button class="control-button" data-action="decrease-width">-</button>
        <button class="control-button" data-action="increase-width">+</button>
      </div>
    `;

    group.appendChild(spacingControl);
    group.appendChild(widthControl);

    return group;
  }
  
  createApiControls() {
    const group = document.createElement('div');
    group.className = 'control-group api-controls';
    
    // API Key设置控制
    const apiKeyControl = document.createElement('div');
    apiKeyControl.className = 'size-control api-key-control';
    apiKeyControl.innerHTML = `
      <span class="control-label">DeepSeek API Key</span>
      <input type="password" class="ai-api-key-input" placeholder="输入 DeepSeek API Key" />
      <button class="control-button ai-save-key-button">保存</button>
    `;

    // 添加API Key保存事件
    const apiKeyInput = apiKeyControl.querySelector('.ai-api-key-input');
    const saveKeyButton = apiKeyControl.querySelector('.ai-save-key-button');

    // 加载已保存的API Key
    chrome.storage.sync.get('deepseekApiKey', (data) => {
      if (data && data.deepseekApiKey) {
        apiKeyInput.value = data.deepseekApiKey;
      }
    });

    // 保存API Key
    const saveApiKey = () => {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.sync.set({ deepseekApiKey: apiKey });
        // 如果页面上有AISummary实例，更新它的apiKey
        if (window.aiSummaryInstance) {
          window.aiSummaryInstance.apiKey = apiKey;
        }
        // 显示保存成功提示
        this.showToast('API Key 保存成功');
      } else {
        // 显示错误提示
        this.showToast('请输入有效的 API Key');
      }
    };

    // 添加保存按钮事件
    saveKeyButton.addEventListener('click', saveApiKey);

    // 添加回车键支持
    apiKeyInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveApiKey();
      }
    });

    group.appendChild(apiKeyControl);
    
    return group;
  }

  updateStyles() {
    if (!this.readerContainer) return;

    const content = this.readerContainer.querySelector('.reader-content');
    if (!content) return;

    content.style.fontSize = `${this.settings.fontSize}px`;
    content.style.lineHeight = this.settings.lineHeight;
    content.style.maxWidth = `${this.settings.width}px`;

    // 更新段落间距
    const paragraphs = content.querySelectorAll('p');
    paragraphs.forEach(p => {
      p.style.marginBottom = `${this.settings.paragraphSpacing}em`;
    });

    // 更新section间距
    const sections = content.querySelectorAll('section');
    sections.forEach(section => {
      section.style.marginBottom = `${this.settings.paragraphSpacing}em`;
    });
    
    // 更新图片尺寸样式
    const images = content.querySelectorAll('img');
    images.forEach(img => {
      // 如果图片已加载，重新应用尺寸处理
      if (img.complete) {
        this.handleImageSize(img);
      }
    });
    
    // 更新表格容器宽度
    const tableWrappers = content.querySelectorAll('.table-wrapper');
    tableWrappers.forEach(wrapper => {
      const table = wrapper.querySelector('table');
      if (table) {
        // 检查表格是否需要水平滚动
        if (table.offsetWidth > this.settings.width) {
          wrapper.classList.add('scrollable');
        } else {
          wrapper.classList.remove('scrollable');
        }
      }
    });

    // 保存设置
    this.saveSettings();
  }

  applyTheme() {
    if (!this.readerContainer) return;

    const colors = this.settings.isDarkMode ? 
      this.settings.darkModeColors : 
      this.settings.lightModeColors;

    // 设置主题属性
    this.readerContainer.setAttribute('data-theme', this.settings.isDarkMode ? 'dark' : 'light');

    // 设置CSS变量
    this.readerContainer.style.setProperty('--reader-bg-color', colors.background);
    this.readerContainer.style.setProperty('--reader-text-color', colors.text);
    this.readerContainer.style.setProperty('--reader-link-color', colors.link);
    this.readerContainer.style.setProperty('--reader-border-color', colors.border);
    this.readerContainer.style.setProperty('--reader-heading-color', colors.heading);
    this.readerContainer.style.setProperty('--reader-quote-color', colors.quote);

    // 保存设置
    this.saveSettings();
  }

  toggleDarkMode() {
    this.settings.isDarkMode = !this.settings.isDarkMode;
    this.applyTheme();
    
    // 更新主题图标显示状态
    const lightIcon = this.readerContainer.querySelector('.theme-icon.light');
    const darkIcon = this.readerContainer.querySelector('.theme-icon.dark');
    if (this.settings.isDarkMode) {
      lightIcon.style.display = 'none';
      darkIcon.style.display = 'block';
    } else {
      lightIcon.style.display = 'block';
      darkIcon.style.display = 'none';
    }
    
    // 更新颜色选项
    const colorOptions = this.readerContainer.querySelector('.color-options');
    if (colorOptions) {
      colorOptions.innerHTML = '';
      
      const colors = this.settings.isDarkMode ? 
        ['#333333', '#2d2d2d', '#2b2b2b', '#242424', '#1a1a1a'] : 
        ['#FAF9F7', '#FFFFFF', '#F5F5F5', '#F8F6F0', '#F5F2EB'];
      
      colors.forEach(color => {
        const option = document.createElement('button');
        option.className = 'color-option';
        option.style.backgroundColor = color;
        option.setAttribute('data-color', color);
        option.setAttribute('aria-label', `设置背景色为 ${color}`);
        if (this.settings.isDarkMode ? 
            color === this.settings.darkModeColors.background : 
            color === this.settings.lightModeColors.background) {
          option.classList.add('active');
        }
        colorOptions.appendChild(option);
      });
    }
  }

  toggleImages() {
    // 切换图片显示状态
    this.settings.showImages = !this.settings.showImages;
    
    // 更新图片显示/隐藏
    if (this.readerContainer) {
      // 更新data-show-images属性
      this.readerContainer.setAttribute('data-show-images', this.settings.showImages.toString());
      
      // 更新按钮图标和提示文本
      const imageToggleButton = this.readerContainer.querySelector('.image-toggle-button');
      if (imageToggleButton) {
        imageToggleButton.setAttribute('aria-label', this.settings.showImages ? '隐藏图片' : '显示图片');
        imageToggleButton.setAttribute('title', this.settings.showImages ? '隐藏图片' : '显示图片');
        imageToggleButton.innerHTML = this.settings.showImages ? 
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15ZM20 17.8284L14 11.8284L6.82843 19H20V17.8284ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z"></path></svg>' : 
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.7134 8.12811L20.4668 8.69379C20.2864 9.10792 19.7136 9.10792 19.5331 8.69379L19.2866 8.12811C18.8471 7.11947 18.0555 6.31641 17.0677 5.87708L16.308 5.53922C15.8973 5.35653 15.8973 4.75881 16.308 4.57612L17.0252 4.25714C18.0384 3.80651 18.8442 2.97373 19.2761 1.93083L19.5293 1.31953C19.7058 0.893489 20.2942 0.893489 20.4706 1.31953L20.7238 1.93083C21.1558 2.97373 21.9616 3.80651 22.9748 4.25714L23.6919 4.57612C24.1027 4.75881 24.1027 5.35653 23.6919 5.53922L22.9323 5.87708C21.9445 6.31641 21.1529 7.11947 20.7134 8.12811ZM2.9918 3H14V5H4V19L13.2923 9.70649C13.6828 9.31595 14.3159 9.31591 14.7065 9.70641L20 15.0104V11H22V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z"></path></svg>';
      }
      
      // 删除对.image-toggle-icon的引用，因为我们只使用.image-toggle-button
    }
    
    // 保存设置
    this.saveSettings();
  }
  
  // 处理图片尺寸显示：小图片原尺寸，大图片满宽显示
  handleImageSize(img) {
    // 获取内容区域宽度
    const contentWidth = this.settings.width;
    
    // 获取图片原始宽度
    const imgNaturalWidth = img.naturalWidth;
    
    // 如果图片宽度小于内容区域宽度，则保持原尺寸显示
    if (imgNaturalWidth < contentWidth) {
      img.classList.add('small-image');
      img.style.width = 'auto';
      img.style.maxWidth = '100%';
    } else {
      // 大图片满宽显示
      img.classList.add('large-image');
      img.style.width = '100%';
    }
  }
  
  // 优化表格展示
  optimizeTable(table) {
    // 检查表格是否有过多的列或内容过宽
    const columnCount = table.querySelectorAll('tr:first-child > *').length;
    const hasWideContent = Array.from(table.querySelectorAll('td, th')).some(cell => {
      // 检查单元格是否包含长文本或宽内容
      const text = cell.textContent;
      return text.length > 50 || cell.querySelector('img, table, pre');
    });
    
    // 如果列数过多或有宽内容，添加可滚动类
    if (columnCount > 5 || hasWideContent) {
      table.classList.add('scrollable');
    }
    
    // 处理表格单元格宽度分布
    const headerCells = table.querySelectorAll('th');
    if (headerCells.length > 0) {
      // 计算每列的平均宽度百分比
      const avgWidth = 100 / columnCount;
      
      // 为每个单元格设置宽度
      headerCells.forEach(cell => {
        // 检查单元格内容长度
        const textLength = cell.textContent.trim().length;
        // 根据内容长度调整宽度
        if (textLength < 10) {
          // 短内容列设置较窄宽度
          cell.style.width = `${Math.max(avgWidth * 0.7, 10)}%`;
        } else if (textLength > 30) {
          // 长内容列设置较宽宽度
          cell.style.width = `${Math.min(avgWidth * 1.3, 30)}%`;
        }
      });
    }
    
    // 处理合并单元格
    const cellsWithRowspan = table.querySelectorAll('[rowspan]');
    const cellsWithColspan = table.querySelectorAll('[colspan]');
    
    // 如果有合并单元格，确保表格使用固定布局
    if (cellsWithRowspan.length > 0 || cellsWithColspan.length > 0) {
      table.style.tableLayout = 'fixed';
    }
    
    // 确保所有单元格的文本能够适当换行
    const allCells = table.querySelectorAll('td, th');
    allCells.forEach(cell => {
      cell.style.wordWrap = 'break-word';
      cell.style.overflowWrap = 'break-word';
      
      // 检查单元格内容是否为纯数字或短文本
      const text = cell.textContent.trim();
      const isNumeric = /^\d+(\.\d+)?$/.test(text);
      const isShortText = text.length < 10;
      
      // 为数字或短文本设置不同的对齐方式
      if (isNumeric) {
        cell.style.textAlign = 'right';
      } else if (isShortText) {
        cell.style.textAlign = 'center';
      }
    });
  }
  
  saveSettings() {
    try {
      const settingsToSave = {
        fontSize: this.settings.fontSize,
        lineHeight: this.settings.lineHeight,
        paragraphSpacing: this.settings.paragraphSpacing,
        width: this.settings.width,
        isDarkMode: this.settings.isDarkMode,
        // 不保存图片显示设置，确保每次都使用默认值
        darkModeColors: { ...this.settings.darkModeColors },
        lightModeColors: { ...this.settings.lightModeColors }
      };
      chrome.storage.sync.set({ readerModeSettings: settingsToSave });
    } catch (e) {
      // 设置保存失败
    }
  }

  loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get('readerModeSettings', (result) => {
          if (result.readerModeSettings) {
            // 合并默认设置和保存的设置，确保所有必要的属性都存在
            // 但不加载图片显示状态，每次都使用默认值（显示图片）
            const { showImages, ...otherSettings } = result.readerModeSettings;
            this.settings = {
              ...this.defaultSettings,
              ...otherSettings,
              lightModeColors: {
                ...this.defaultSettings.lightModeColors,
                ...(result.readerModeSettings.lightModeColors || {})
              },
              darkModeColors: {
                ...this.defaultSettings.darkModeColors,
                ...(result.readerModeSettings.darkModeColors || {})
              }
            };
          } else {
            this.settings = { ...this.defaultSettings };
          }
          resolve();
        });
      } catch (e) {
        // 设置加载失败，使用默认设置
        this.settings = { ...this.defaultSettings };
        resolve();
      }
    });
  }

  cleanContent(content) {
    const container = document.createElement('div');
    container.innerHTML = content;
    
    // 清理微信文章的图片
    if (window.location.hostname === 'mp.weixin.qq.com') {
      // 处理所有图片，排除SVG图标
      container.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        const dataSrc = img.getAttribute('data-src') || '';
        
        // 跳过SVG图标和小图片
        if (src.includes('svg') || dataSrc.includes('svg')) {
          return;
        }
        
        // 跳过小图标（通常是装饰性的）
        const width = parseInt(img.getAttribute('width') || img.style.width || '0');
        if (width > 0 && width < 50) {
          return;
        }
        
        // 设置图片源
        if (dataSrc && !dataSrc.startsWith('data:')) {
          img.src = dataSrc;
        } else if (src && !src.startsWith('data:')) {
          img.src = src;
        }
        
        // 移除可能影响显示的属性
        ['data-type', 'data-ratio', 'data-w', 'data-fail'].forEach(attr => {
          img.removeAttribute(attr);
        });
        
        // 设置基本样式
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.margin = '1em auto';
        img.style.display = 'block';
      });
    }

    // 处理所有链接
    container.querySelectorAll('a').forEach(link => {
      // 保留带SVG的链接原始样式
      const hasSvg = link.querySelector('svg');
      if (!hasSvg) {
        link.removeAttribute('class');
        link.removeAttribute('style');
      }
      
      if (link.href) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });

    // 保留SVG图标
    container.querySelectorAll('svg').forEach(svg => {
      // 保留必要的属性
      const preserveAttrs = ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'];
      const attrs = svg.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        if (!preserveAttrs.includes(attr.name)) {
          svg.removeAttribute(attr.name);
        }
      }
    });

    // 清理不需要的属性，但保留内容结构
    const cleanup = (element) => {
      if (element.nodeType === Node.ELEMENT_NODE) {
        // 保留SVG、图片和链接的必要属性
        if (!['SVG', 'IMG', 'A'].includes(element.tagName.toUpperCase())) {
          // 移除可能影响显示的属性
          ['style', 'class', 'id'].forEach(attr => {
            element.removeAttribute(attr);
          });
        }
        
        // 移除事件处理器
        ['onclick', 'onload', 'onerror'].forEach(attr => {
          element.removeAttribute(attr);
        });
        
        // 如果是空的 span 或 div，且不包含图片或SVG，则移除
        if ((element.tagName === 'SPAN' || element.tagName === 'DIV') && 
            !element.textContent.trim() && 
            !element.querySelector('img, svg')) {
          element.remove();
          return;
        }
        
        // 递归处理子元素
        Array.from(element.children).forEach(cleanup);
      }
    };
    
    cleanup(container);
    
    return container.innerHTML;
  }

  async processImage(img) {
    const triedUrls = new Set();
    
    return new Promise((resolve) => {
      const tryLoadImage = (src) => {
        if (triedUrls.has(src)) {
          resolve();
          return;
        }
        
        triedUrls.add(src);
        img.src = src;
      };

      const prepareWeixinImageUrl = (url) => {
        if (!url || url.startsWith('data:')) return null;
        
        // 确保使用HTTPS
        let src = url.replace(/^http:/, 'https:');
        
        // 如果没有参数，添加完整的微信参数
        if (!src.includes('?')) {
          src = `${src}?wx_fmt=jpeg&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1`;
        }
        
        return src;
      };

      const handleImage = () => {
        try {
          if (window.location.hostname === 'mp.weixin.qq.com') {
            // 移除可能影响显示的属性
            ['data-type', 'data-ratio', 'data-w', 'data-fail'].forEach(attr => {
              img.removeAttribute(attr);
            });
            
            // 优先使用带完整参数的 src
            const originalSrc = img.getAttribute('src');
            if (originalSrc && !originalSrc.startsWith('data:')) {
              const src = prepareWeixinImageUrl(originalSrc);
              if (src) {
                tryLoadImage(src);
                return;
              }
            }
            
            // 如果 src 不可用，尝试 data-src
            const dataSrc = img.getAttribute('data-src');
            if (dataSrc) {
              const src = prepareWeixinImageUrl(dataSrc);
              if (src) {
                tryLoadImage(src);
                return;
              }
            }
            
            // 最后尝试其他属性
            ['data-original', 'data-url'].some(attr => {
              const value = img.getAttribute(attr);
              if (value) {
                const src = prepareWeixinImageUrl(value);
                if (src) {
                  tryLoadImage(src);
                  return true;
                }
              }
              return false;
            });
          } else {
            // 处理非微信图片
            if (img.dataset.src) {
              tryLoadImage(img.dataset.src);
            } else if (img.getAttribute('data-original')) {
              tryLoadImage(img.getAttribute('data-original'));
            }
          }
        } catch (error) {
          // 处理图片时出错
        }
      };

      // 设置错误处理器
      img.addEventListener('error', () => {
        // 如果是HTTP协议，尝试转换为HTTPS
        if (img.src.startsWith('http:')) {
          const httpsUrl = img.src.replace('http:', 'https:');
          if (!triedUrls.has(httpsUrl)) {
            tryLoadImage(httpsUrl);
            return;
          }
        }
        // 如果是微信图片且URL包含格式参数，尝试其他格式
        if (window.location.hostname === 'mp.weixin.qq.com' && img.src.includes('wx_fmt=')) {
          ['jpeg', 'png', 'gif', 'webp'].some(format => {
            const newSrc = img.src.replace(/wx_fmt=\w+/, `wx_fmt=${format}`);
            if (!triedUrls.has(newSrc)) {
              tryLoadImage(newSrc);
              return true;
            }
            return false;
          });
        } else {
          // 图片加载失败
          if (img.parentNode) {
            img.parentNode.removeChild(img);
          }
          resolve();
        }
      }, { once: true });

      // 设置加载成功处理器
      img.addEventListener('load', () => {
        resolve();
      }, { once: true });
      
      // 开始处理图片
      handleImage();
    });
  }

  setImageAttributes(img) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'block';
    wrapper.style.margin = this.settings.imageMargin + ' 0';
    wrapper.style.textAlign = 'center';
    
    // 设置图片样式
    Object.assign(img.style, {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: this.settings.imageBorderRadius,
      boxShadow: this.settings.imageShadow,
      cursor: 'zoom-in',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      width: 'auto',  // 防止微信的固定宽度
      maxHeight: 'none'  // 防止微信的固定高度
    });
    
    // 保存原始尺寸
    if (img.naturalWidth && img.naturalHeight) {
      img.setAttribute('data-original-width', img.naturalWidth);
      img.setAttribute('data-original-height', img.naturalHeight);
    }
    
    // 确保图片在其原始容器中
    const parent = img.parentNode;
    if (parent && parent !== wrapper) {
      parent.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }
  }

  setupImageZoom() {
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';
    document.body.appendChild(overlay);

    const images = document.getElementsByTagName('img');
    Array.from(images).forEach(img => {
      img.addEventListener('click', () => {
        const clone = img.cloneNode(true);
        clone.style.maxHeight = '90vh';
        clone.style.maxWidth = '90vw';
        clone.style.width = 'auto';
        clone.style.height = 'auto';
        clone.style.margin = 'auto';
        clone.style.cursor = 'zoom-out';
        clone.style.boxShadow = 'none';
        
        overlay.innerHTML = '';
        overlay.appendChild(clone);
        overlay.style.display = 'flex';
        
        document.body.style.overflow = 'hidden';
      });
    });

    overlay.addEventListener('click', () => {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    });
  }

  // 显示提示消息
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
}

// 初始化阅读模式实例
const reader = new ReaderMode();

// 暴露到全局作用域，以便background.js可以访问
window.reader = reader;

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle') {
    reader.toggle();
  }
});
