/**
 * 文章大纲和阅读进度条功能
 * 提供文章大纲生成和阅读进度跟踪功能
 */

class ArticleOutline {
  constructor() {
    this.outlineContainer = null;
    this.headings = [];
    this.isVisible = true;
    this.hasOutline = false; // 初始化时默认没有大纲
  }

  /**
   * 初始化大纲功能
   * @param {HTMLElement} readerContainer - 阅读模式容器
   * @param {HTMLElement} contentContainer - 内容容器
   */
  init(readerContainer, contentContainer) {
    if (!readerContainer || !contentContainer) return;
    
    // 查找所有标题元素
    this.headings = Array.from(contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    
    // 如果没有标题，则不创建大纲，但设置标志表示没有大纲
    if (this.headings.length === 0) {
      this.hasOutline = false;
      return;
    }
    
    // 设置标志表示有大纲
    this.hasOutline = true;
    
    // 创建大纲容器
    this.createOutlineContainer(readerContainer);
    
    // 生成大纲内容
    this.generateOutline();
    
    // 添加滚动监听，高亮当前阅读的标题
    this.addScrollListener();
  }

  /**
   * 创建大纲容器
   * @param {HTMLElement} readerContainer - 阅读模式容器
   */
  createOutlineContainer(readerContainer) {
    // 创建大纲容器
    this.outlineContainer = document.createElement('div');
    this.outlineContainer.className = 'article-outline';
    
    // 创建大纲内容容器
    const outlineContent = document.createElement('div');
    outlineContent.className = 'outline-content';
    
    // 组装大纲容器
    this.outlineContainer.appendChild(outlineContent);
    
    // 添加到阅读模式容器
    readerContainer.appendChild(this.outlineContainer);
  }

  /**
   * 生成大纲内容
   */
  generateOutline() {
    if (!this.outlineContainer) return;
    
    const outlineContent = this.outlineContainer.querySelector('.outline-content');
    if (!outlineContent) return;
    
    // 清空大纲内容
    outlineContent.innerHTML = '';
    
    // 创建大纲列表
    const outlineList = document.createElement('ul');
    outlineList.className = 'outline-list';
    
    // 过滤掉文章标题（通常是第一个h1标签）
    const filteredHeadings = this.headings.filter((heading, index) => {
      // 如果是第一个标题且是h1，则认为是文章标题，不显示在大纲中
      return !(index === 0 && heading.tagName.toLowerCase() === 'h1');
    });
    
    // 为每个标题创建大纲项
    filteredHeadings.forEach((heading, index) => {
      // 获取标题级别
      const level = parseInt(heading.tagName.substring(1));
      
      // 创建大纲项
      const outlineItem = document.createElement('li');
      outlineItem.className = `outline-item level-${level}`;
      outlineItem.dataset.index = index;
      // 增加缩进量，使层级更明显
      outlineItem.style.paddingLeft = `${(level - 1) * 16}px`;
      
      // 创建大纲项链接
      const outlineLink = document.createElement('a');
      outlineLink.className = 'outline-link';
      outlineLink.textContent = heading.textContent;
      
      // 确保标题有ID，如果没有则创建一个
      if (!heading.id) {
        heading.id = `heading-${index}`;
      }
      
      // 添加点击事件，点击跳转到对应标题
      outlineLink.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth' });
      });
      
      // 组装大纲项
      outlineItem.appendChild(outlineLink);
      outlineList.appendChild(outlineItem);
    });
    
    // 添加大纲列表到大纲内容容器
    outlineContent.appendChild(outlineList);
  }

  /**
   * 添加滚动监听，高亮当前阅读的标题
   */
  addScrollListener() {
    if (this.headings.length === 0) return;
    
    // 使用节流函数代替防抖，确保滚动时更平滑地更新
    const throttle = (func, limit) => {
      let inThrottle;
      return function() {
        const context = this;
        const args = arguments;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    };
    
    // 获取阅读模式容器
    const readerContainer = document.querySelector('.reader-mode');
    
    // 滚动处理函数
    const handleScroll = throttle(() => {
      // 获取当前可视区域的位置信息 - 优先使用阅读模式容器的滚动位置
      const scrollContainer = readerContainer || document.documentElement;
      const scrollTop = readerContainer ? readerContainer.scrollTop : (window.scrollY || document.documentElement.scrollTop);
      const containerHeight = readerContainer ? readerContainer.clientHeight : window.innerHeight;
      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + containerHeight;
      const viewportThreshold = scrollTop + (containerHeight * 0.1); // 使用视口上方10%位置作为参考点
      
      // 找到当前在视口中的标题
      let currentHeadingIndex = -1;
      let closestDistance = Infinity;
      
      for (let i = 0; i < this.headings.length; i++) {
        const headingRect = this.headings[i].getBoundingClientRect();
        // 计算标题相对于滚动容器的位置
        const headingTop = readerContainer ? headingRect.top + scrollContainer.scrollTop : headingRect.top + window.scrollY;
        const headingBottom = headingTop + headingRect.height;
        
        // 标题在视口上方阈值位置或以上时选中
        if (headingTop <= viewportThreshold) {
          // 选择最接近阈值位置且在阈值以上的标题
          const distance = Math.abs(headingTop - viewportThreshold);
          if (distance < closestDistance) {
            closestDistance = distance;
            currentHeadingIndex = i;
          }
        }
      }
      
      // 如果没有找到当前标题，则选择第一个标题
      if (currentHeadingIndex === -1 && this.headings.length > 0) {
        currentHeadingIndex = 0;
      }
      
      // 更新大纲高亮
      this.updateOutlineHighlight(currentHeadingIndex);
      
      // 移除调试信息
      // 原console.log('Outline update:', {...})
    }, 50); // 减少节流时间，使更新更平滑
    
    // 添加滚动监听 - 优先监听阅读模式容器的滚动
    if (readerContainer) {
      readerContainer.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    // 添加窗口大小变化监听，重新计算高亮
    window.addEventListener('resize', throttle(() => {
      handleScroll();
    }, 100));
    
    // 初始触发一次，确保页面加载时就有高亮
    setTimeout(handleScroll, 300);
    // 再次触发，确保在页面完全加载后更新高亮
    setTimeout(handleScroll, 1000);
  }

  /**
   * 更新大纲高亮
   * @param {number} activeIndex - 当前活跃的标题索引
   */
  updateOutlineHighlight(activeIndex) {
    if (!this.outlineContainer) return;
    
    // 获取所有大纲项
    const outlineItems = this.outlineContainer.querySelectorAll('.outline-item');
    if (outlineItems.length === 0) return;
    
    // 移除所有高亮
    outlineItems.forEach(item => {
      item.classList.remove('active');
    });
    
    // 添加当前高亮
    if (activeIndex >= 0 && activeIndex < this.headings.length) {
      // 过滤掉文章标题（通常是第一个h1标签）
      const isFirstH1Filtered = this.headings.length > 0 && this.headings[0].tagName.toLowerCase() === 'h1';
      
      // 计算在大纲中的实际索引
      let outlineIndex = isFirstH1Filtered ? activeIndex - 1 : activeIndex;
      
      // 确保索引在有效范围内
      if (outlineIndex >= 0 && outlineIndex < outlineItems.length) {
        // 添加高亮类
        outlineItems[outlineIndex].classList.add('active');
        
        // 确保当前高亮项在可视区域内
        const outlineContent = this.outlineContainer.querySelector('.outline-content');
        if (outlineContent) {
          outlineItems[outlineIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }

  /**
   * 切换大纲显示/隐藏
   */
  toggleOutline() {
    // 如果没有大纲，显示提示信息
    if (!this.hasOutline) {
      // 创建一个临时提示元素
      const toast = document.createElement('div');
      toast.className = 'outline-toast';
      toast.textContent = '当前页面没有检测到标题，无法生成大纲';
      toast.style.position = 'fixed';
      toast.style.top = '72px';
      toast.style.left = '16px';
      toast.style.padding = '8px 12px';
      toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      toast.style.color = '#fff';
      toast.style.borderRadius = '4px';
      toast.style.zIndex = '10002';
      toast.style.fontSize = '14px';
      toast.style.transition = 'opacity 0.3s ease';
      
      // 为深色模式添加适配
      const readerMode = document.querySelector('.reader-mode');
      if (readerMode && readerMode.getAttribute('data-theme') === 'dark') {
        toast.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        toast.style.color = '#000';
      }
      
      // 添加到页面
      document.body.appendChild(toast);
      
      // 3秒后自动消失
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, 3000);
      
      return;
    }
    
    if (!this.outlineContainer) return;
    
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      this.outlineContainer.classList.remove('collapsed');
    } else {
      this.outlineContainer.classList.add('collapsed');
    }
  }
}

class ReadingProgress {
  constructor() {
    this.progressBar = null;
    this.progressContainer = null;
  }

  /**
   * 初始化阅读进度条
   * @param {HTMLElement} readerContainer - 阅读模式容器
   */
  init(readerContainer) {
    if (!readerContainer) return;
    
    // 创建进度条容器
    this.createProgressBar(readerContainer);
    
    // 添加滚动监听，更新进度条
    this.addScrollListener();
  }

  /**
   * 创建进度条
   * @param {HTMLElement} readerContainer - 阅读模式容器
   */
  createProgressBar(readerContainer) {
    // 创建进度条容器
    this.progressContainer = document.createElement('div');
    this.progressContainer.className = 'reading-progress-container';
    
    // 创建进度条
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'reading-progress-bar';
    
    // 组装进度条
    this.progressContainer.appendChild(this.progressBar);
    
    // 添加到阅读模式容器
    readerContainer.appendChild(this.progressContainer);
  }

  /**
   * 添加滚动监听，更新进度条
   */
  addScrollListener() {
    // 节流函数 - 使用节流而不是防抖，确保滚动时进度条平滑更新
    const throttle = (func, limit) => {
      let lastFunc;
      let lastRan;
      return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
          func.apply(context, args);
          lastRan = Date.now();
        } else {
          clearTimeout(lastFunc);
          lastFunc = setTimeout(function() {
            if ((Date.now() - lastRan) >= limit) {
              func.apply(context, args);
              lastRan = Date.now();
            }
          }, limit - (Date.now() - lastRan));
        }
      };
    };
    
    // 滚动处理函数 - 使用较小的时间间隔以获得更平滑的效果
    const handleScroll = throttle(() => {
      this.updateProgress();
    }, 10); // 提高更新频率，使进度条更平滑
    
    // 添加滚动监听
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 添加窗口大小变化监听，重新计算进度
    window.addEventListener('resize', throttle(() => {
      this.updateProgress();
    }, 100));
    
    // 添加内容变化监听，重新计算进度
    const observer = new MutationObserver(throttle(() => {
      this.updateProgress();
    }, 100));
    
    // 观察文档变化
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    // 初始触发一次，确保页面加载时就有进度
    setTimeout(() => this.updateProgress(), 100);
    // 再次触发，确保在页面完全加载后更新进度
    setTimeout(() => this.updateProgress(), 1000);
  }

  /**
   * 更新阅读进度
   */
  updateProgress() {
    if (!this.progressBar || !this.progressContainer) return;
    
    // 确保进度条容器可见
    this.progressContainer.style.display = 'block';
    
    // 获取阅读模式容器
    const readerContainer = document.querySelector('.reader-mode');
    
    // 计算阅读进度 - 优先使用阅读模式容器的滚动位置
    const containerHeight = readerContainer ? readerContainer.clientHeight : window.innerHeight;
    const contentHeight = readerContainer ? readerContainer.scrollHeight : document.documentElement.scrollHeight;
    const scrollTop = readerContainer ? readerContainer.scrollTop : (window.scrollY || document.documentElement.scrollTop);
    
    // 计算百分比 - 确保分母不为0
    const denominator = contentHeight - containerHeight;
    const scrollPercent = denominator > 0 ? (scrollTop / denominator) * 100 : 0;
    
    // 更新进度条宽度 - 使用直接设置style.width而不是使用CSS变量
    const widthValue = Math.min(Math.max(scrollPercent, 0), 100);
    this.progressBar.style.width = `${widthValue}%`;
    
    // 强制重绘以确保进度条显示正确
    void this.progressBar.offsetHeight;
    
    // 确保z-index足够高
    this.progressContainer.style.zIndex = '10002';
    
    // 调试信息已隐藏
    // console.log('Progress update:', {
    //   containerHeight,
    //   contentHeight,
    //   scrollTop,
    //   scrollPercent: scrollPercent.toFixed(2) + '%'
    // });
  }
}

// 导出模块
window.ArticleOutline = ArticleOutline;
window.ReadingProgress = ReadingProgress;