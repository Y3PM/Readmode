/**
 * 图片加载优化模块
 * 用于解决阅读模式下图片加载慢或无法显示的问题
 */
class ImageLoader {
  constructor() {
    this.isScrolling = false;
    this.scrollSpeed = 800; // 默认滚动速度(px/s)
    this.autoScrollEnabled = false;
    this.imageLoadTimeout = 10000; // 图片加载超时时间(ms)
    this.retryCount = 3; // 重试次数
    this.imageObserver = null;
    this.loadingImages = new Map(); // 存储正在加载的图片信息
  }

  /**
   * 初始化图片加载优化
   * @param {HTMLElement} container - 阅读模式容器
   */
  init(container) {
    if (!container) return;
    
    this.container = container;
    this.setupImageObserver();
    this.createControls();
    
    // 在初始化时自动触发一次滚动预加载
    this.preloadImagesWithScroll();
  }

  /**
   * 预加载图片的自动滚动功能
   */
  preloadImagesWithScroll() {
    // 记录原始滚动位置
    const originalScrollPosition = window.scrollY;
    
    // 启动自动滚动
    this.autoScrollEnabled = true;
    this.startAutoScroll();
    
    // 监听滚动结束
    const checkScrollEnd = setInterval(() => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        // 停止自动滚动
        this.stopAutoScroll();
        // 恢复原始滚动位置
        window.scrollTo(0, originalScrollPosition);
        clearInterval(checkScrollEnd);
      }
    }, 100);
  }

  /**
   * 设置图片观察器，使用IntersectionObserver实现图片懒加载
   */
  setupImageObserver() {
    // 如果浏览器支持IntersectionObserver，使用它来实现懒加载
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            this.imageObserver.unobserve(img); // 加载后停止观察
          }
        });
      }, {
        rootMargin: '200px 0px', // 提前200px开始加载
        threshold: 0.01 // 只要有1%进入视口就开始加载
      });

      // 观察所有图片
      const images = this.container.querySelectorAll('img');
      images.forEach(img => {
        // 为每个图片添加加载状态指示器
        this.addLoadingIndicator(img);
        
        // 保存原始src到data-src属性
        if (img.src && !img.dataset.src) {
          img.dataset.src = img.src;
          img.removeAttribute('src'); // 移除src以防止立即加载
        }
        
        // 开始观察图片
        this.imageObserver.observe(img);
      });
    } else {
      // 如果不支持IntersectionObserver，直接加载所有图片
      this.loadAllImages();
    }
  }

  /**
   * 为图片添加加载状态指示器
   * @param {HTMLImageElement} img - 图片元素
   */
  addLoadingIndicator(img) {
    // 创建包装容器
    const wrapper = document.createElement('div');
    wrapper.className = 'image-loading-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.minHeight = '150px';
    
    // 创建加载指示器
    const indicator = document.createElement('div');
    indicator.className = 'image-loading-indicator';
    indicator.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">图片加载中...</div>
    `;
    
    // 添加重试按钮
    const retryButton = document.createElement('button');
    retryButton.className = 'image-retry-button';
    retryButton.textContent = '重新加载';
    retryButton.style.display = 'none'; // 初始隐藏
    
    retryButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.retryLoadImage(img);
    });
    
    indicator.appendChild(retryButton);
    
    // 替换图片为包装容器
    if (img.parentNode) {
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      wrapper.appendChild(indicator);
      
      // 设置图片加载事件
      img.addEventListener('load', () => {
        indicator.style.display = 'none';
        wrapper.style.minHeight = 'auto';
      });
      
      img.addEventListener('error', () => {
        indicator.querySelector('.loading-spinner').style.display = 'none';
        indicator.querySelector('.loading-text').textContent = '图片加载失败';
        retryButton.style.display = 'block';
      });
    }
  }

  /**
   * 加载单个图片
   * @param {HTMLImageElement} img - 图片元素
   */
  loadImage(img) {
    if (!img || !img.dataset.src) return;
    
    // 设置加载超时
    const timeoutId = setTimeout(() => {
      if (this.loadingImages.has(img)) {
        // 加载超时，显示重试按钮
        const wrapper = img.closest('.image-loading-wrapper');
        if (wrapper) {
          const indicator = wrapper.querySelector('.image-loading-indicator');
          if (indicator) {
            indicator.querySelector('.loading-spinner').style.display = 'none';
            indicator.querySelector('.loading-text').textContent = '图片加载超时';
            indicator.querySelector('.image-retry-button').style.display = 'block';
          }
        }
        this.loadingImages.delete(img);
      }
    }, this.imageLoadTimeout);
    
    // 记录加载状态
    this.loadingImages.set(img, {
      timeoutId,
      retries: 0
    });
    
    // 设置src开始加载
    img.src = img.dataset.src;
  }

  /**
   * 重试加载图片
   * @param {HTMLImageElement} img - 图片元素
   */
  retryLoadImage(img) {
    if (!img || !img.dataset.src) return;
    
    const loadInfo = this.loadingImages.get(img) || { retries: 0 };
    
    // 检查重试次数
    if (loadInfo.retries >= this.retryCount) {
      // 超过最大重试次数，显示最终失败
      const wrapper = img.closest('.image-loading-wrapper');
      if (wrapper) {
        const indicator = wrapper.querySelector('.image-loading-indicator');
        if (indicator) {
          indicator.querySelector('.loading-text').textContent = '图片无法加载';
        }
      }
      return;
    }
    
    // 更新重试信息
    this.loadingImages.set(img, {
      timeoutId: setTimeout(() => {
        // 超时处理同上
        if (this.loadingImages.has(img)) {
          const wrapper = img.closest('.image-loading-wrapper');
          if (wrapper) {
            const indicator = wrapper.querySelector('.image-loading-indicator');
            if (indicator) {
              indicator.querySelector('.loading-spinner').style.display = 'none';
              indicator.querySelector('.loading-text').textContent = '图片加载超时';
              indicator.querySelector('.image-retry-button').style.display = 'block';
            }
          }
          this.loadingImages.delete(img);
        }
      }, this.imageLoadTimeout),
      retries: loadInfo.retries + 1
    });
    
    // 重置加载状态
    const wrapper = img.closest('.image-loading-wrapper');
    if (wrapper) {
      const indicator = wrapper.querySelector('.image-loading-indicator');
      if (indicator) {
        indicator.querySelector('.loading-spinner').style.display = 'block';
        indicator.querySelector('.loading-text').textContent = `图片加载中...(${loadInfo.retries + 1}/${this.retryCount + 1})`;
        indicator.querySelector('.image-retry-button').style.display = 'none';
      }
    }
    
    // 重新加载图片
    img.src = img.dataset.src + (img.dataset.src.includes('?') ? '&' : '?') + 'retry=' + new Date().getTime();
  }

  /**
   * 加载所有图片（不使用懒加载时的备选方案）
   */
  loadAllImages() {
    const images = this.container.querySelectorAll('img');
    images.forEach(img => {
      this.addLoadingIndicator(img);
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
  }

  /**
   * 创建自动滚动控制按钮
   */
  createControls() {
    // 创建自动滚动按钮
    const autoScrollButton = document.createElement('button');
    autoScrollButton.className = 'auto-scroll-button';
    autoScrollButton.setAttribute('aria-label', '自动滚动页面');
    autoScrollButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 16.1716L19.0711 10.1005L20.4853 11.5147L12 20L3.51472 11.5147L4.92893 10.1005L11 16.1716V2H13V16.1716Z"></path>
      </svg>
    `;
    
    // 添加点击事件
    autoScrollButton.addEventListener('click', () => {
      this.toggleAutoScroll();
    });
    
    // 添加到阅读模式容器
    this.container.appendChild(autoScrollButton);
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .auto-scroll-button {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: var(--reader-bg-color, #FAF9F7);
        color: var(--reader-text-color, #2c3e50);
        border: 1px solid var(--reader-border-color, #e0e0e0);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9999;
        transition: all 0.3s ease;
      }
      
      .auto-scroll-button:hover {
        transform: scale(1.1);
      }
      
      .auto-scroll-button svg {
        width: 24px;
        height: 24px;
      }
      
      .auto-scroll-button.active {
        background-color: var(--reader-link-color, #2980b9);
        color: white;
      }
      
      .image-loading-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 16px;
        border-radius: 8px;
        z-index: 2;
      }
      
      .loading-spinner {
        width: 30px;
        height: 30px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
        margin-bottom: 8px;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .loading-text {
        font-size: 14px;
        text-align: center;
      }
      
      .image-retry-button {
        margin-top: 8px;
        padding: 6px 12px;
        background-color: var(--reader-link-color, #2980b9);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .image-retry-button:hover {
        background-color: #3498db;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * 切换自动滚动状态
   */
  toggleAutoScroll() {
    this.autoScrollEnabled = !this.autoScrollEnabled;
    
    const button = this.container.querySelector('.auto-scroll-button');
    if (button) {
      if (this.autoScrollEnabled) {
        button.classList.add('active');
        button.setAttribute('aria-label', '停止自动滚动');
        this.startAutoScroll();
      } else {
        button.classList.remove('active');
        button.setAttribute('aria-label', '自动滚动页面');
        this.stopAutoScroll();
      }
    }
  }

  /**
   * 开始自动滚动
   */
  startAutoScroll() {
    if (this.isScrolling) return;
    
    this.isScrolling = true;
    
    // 计算滚动步长（每帧滚动的像素数）
    const scrollStep = this.scrollSpeed / 60; // 假设60fps
    
    // 滚动动画
    const scroll = () => {
      if (!this.isScrolling || !this.autoScrollEnabled) return;
      
      // 检查是否已经滚动到底部
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        // 已经接近底部，停止滚动
        this.stopAutoScroll();
        const button = this.container.querySelector('.auto-scroll-button');
        if (button) {
          button.classList.remove('active');
          button.setAttribute('aria-label', '自动滚动页面');
        }
        return;
      }
      
      // 滚动一步
      window.scrollBy(0, scrollStep);
      
      // 继续下一帧滚动
      requestAnimationFrame(scroll);
    };
    
    // 开始滚动动画
    requestAnimationFrame(scroll);
  }

  /**
   * 停止自动滚动
   */
  stopAutoScroll() {
    this.isScrolling = false;
    this.autoScrollEnabled = false;
  }
}