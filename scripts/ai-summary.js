// AI总结功能实现
class AISummary {
  constructor() {
    this.apiKey = null;
    this.isGenerating = false;
    this.summaryContainer = null;
    this.summaryCache = {}; // 添加缓存对象
    
    // 加载保存的API Key
    this.loadApiKey();
  }

  // 加载API Key
  async loadApiKey() {
    try {
      const result = await new Promise(resolve => {
        chrome.storage.sync.get('deepseekApiKey', (data) => {
          resolve(data);
        });
      });
      
      if (result && result.deepseekApiKey) {
        this.apiKey = result.deepseekApiKey;
      }
    } catch (error) {
      // 移除console.error
    }
  }

  // 保存API Key
  saveApiKey(apiKey) {
    this.apiKey = apiKey;
    chrome.storage.sync.set({ deepseekApiKey: apiKey });
  }

  // 创建AI总结按钮
  createSummaryButton() {
    const summaryButton = document.createElement('button');
    summaryButton.className = 'ai-summary-button';
    summaryButton.setAttribute('aria-label', 'AI总结');
    summaryButton.setAttribute('title', 'AI总结');
    summaryButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="ai-summary-icon"><path d="M14 4.4375C15.3462 4.4375 16.4375 3.34619 16.4375 2H17.5625C17.5625 3.34619 18.6538 4.4375 20 4.4375V5.5625C18.6538 5.5625 17.5625 6.65381 17.5625 8H16.4375C16.4375 6.65381 15.3462 5.5625 14 5.5625V4.4375ZM1 11C4.31371 11 7 8.31371 7 5H9C9 8.31371 11.6863 11 15 11V13C11.6863 13 9 15.6863 9 19H7C7 15.6863 4.31371 13 1 13V11ZM4.87601 12C6.18717 12.7276 7.27243 13.8128 8 15.124 8.72757 13.8128 9.81283 12.7276 11.124 12 9.81283 11.2724 8.72757 10.1872 8 8.87601 7.27243 10.1872 6.18717 11.2724 4.87601 12ZM17.25 14C17.25 15.7949 15.7949 17.25 14 17.25V18.75C15.7949 18.75 17.25 20.2051 17.25 22H18.75C18.75 20.2051 20.2051 18.75 22 18.75V17.25C20.2051 17.25 18.75 15.7949 18.75 14H17.25Z"></path></svg>';
    
    // 添加点击事件
    summaryButton.addEventListener('click', () => {
      // 如果按钮已经处于加载状态，则不执行操作
      if (summaryButton.classList.contains('loading')) {
        return;
      }
      
      // 设置按钮为加载状态
      this.setButtonLoading(summaryButton, true);
      
      // 切换总结面板
      this.toggleSummaryPanel(summaryButton);
    });
    
    return summaryButton;
  }
  
  // 设置按钮加载状态
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.classList.add('loading');
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="ai-loading-icon"><style>.spinner_SoJz{transform-origin:center;animation:spinner_YGAN 1.5s linear infinite}@keyframes spinner_YGAN{100%{transform:rotate(360deg)}}.segment1{fill:#FF6B6B}.segment2{fill:#FFD93D}.segment3{fill:#6BCB77}.segment4{fill:#4D96FF}.segment5{fill:#9B72AA}.segment6{fill:#FF6E31}.segment7{fill:#46C2CB}.segment8{fill:#7AA874}</style><path class="spinner_SoJz segment1" d="M20.27,4.74a4.93,4.93,0,0,1,1.52,4.61,5.32,5.32,0,0,1-4.1,4.51,5.12,5.12,0,0,1-5.2-1.5,5.53,5.53,0,0,0,6.13-1.48A5.66,5.66,0,0,0,20.27,4.74Z"/><path class="spinner_SoJz segment2" d="M12.32,11.53a5.49,5.49,0,0,0-1.47-6.2A5.57,5.57,0,0,0,4.71,3.72,5.17,5.17,0,0,1,9.53,2.2,5.52,5.52,0,0,1,13.9,6.45,5.28,5.28,0,0,1,12.32,11.53Z"/><path class="spinner_SoJz segment3" d="M19.2,20.29a4.92,4.92,0,0,1-4.72,1.49,5.32,5.32,0,0,1-4.34-4.05A5.2,5.2,0,0,1,11.6,12.5a5.6,5.6,0,0,0,1.51,6.13A5.63,5.63,0,0,0,19.2,20.29Z"/><path class="spinner_SoJz segment4" d="M3.79,19.38A5.18,5.18,0,0,1,2.32,14a5.3,5.3,0,0,1,4.59-4,5,5,0,0,1,4.58,1.61,5.55,5.55,0,0,0-6.32,1.69A5.46,5.46,0,0,0,3.79,19.38Z"/><path class="spinner_SoJz segment5" d="M12.23,12a5.11,5.11,0,0,0,3.66-5,5.75,5.75,0,0,0-3.18-6,5,5,0,0,1,4.42,2.3,5.21,5.21,0,0,1,.24,5.92A5.4,5.4,0,0,1,12.23,12Z"/><path class="spinner_SoJz segment6" d="M11.76,12a5.18,5.18,0,0,0-3.68,5.09,5.58,5.58,0,0,0,3.19,5.79c-1,.35-2.9-.46-4-1.68A5.51,5.51,0,0,1,11.76,12Z"/><path class="spinner_SoJz segment7" d="M23,12.63a5.07,5.07,0,0,1-2.35,4.52,5.23,5.23,0,0,1-5.91.2,5.24,5.24,0,0,1-2.67-4.77,5.51,5.51,0,0,0,5.45,3.33A5.52,5.52,0,0,0,23,12.63Z"/><path class="spinner_SoJz segment8" d="M1,11.23a5,5,0,0,1,2.49-4.5,5.23,5.23,0,0,1,5.81-.06,5.3,5.3,0,0,1,2.61,4.74A5.56,5.56,0,0,0,6.56,8.06,5.71,5.71,0,0,0,1,11.23Z"/></svg>';
    } else {
      button.classList.remove('loading');
      // 恢复原始SVG
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="ai-summary-icon"><path d="M14 4.4375C15.3462 4.4375 16.4375 3.34619 16.4375 2H17.5625C17.5625 3.34619 18.6538 4.4375 20 4.4375V5.5625C18.6538 5.5625 17.5625 6.65381 17.5625 8H16.4375C16.4375 6.65381 15.3462 5.5625 14 5.5625V4.4375ZM1 11C4.31371 11 7 8.31371 7 5H9C9 8.31371 11.6863 11 15 11V13C11.6863 13 9 15.6863 9 19H7C7 15.6863 4.31371 13 1 13V11ZM4.87601 12C6.18717 12.7276 7.27243 13.8128 8 15.124 8.72757 13.8128 9.81283 12.7276 11.124 12 9.81283 11.2724 8.72757 10.1872 8 8.87601 7.27243 10.1872 6.18717 11.2724 4.87601 12ZM17.25 14C17.25 15.7949 15.7949 17.25 14 17.25V18.75C15.7949 18.75 17.25 20.2051 17.25 22H18.75C18.75 20.2051 20.2051 18.75 22 18.75V17.25C20.2051 17.25 18.75 15.7949 18.75 14H17.25Z"></path></svg>';
    }
  }

  // API Key设置已移至设置面板，此方法保留但不再使用
  createApiKeyPanel() {
    return null;
  }

  // 创建总结面板
  createSummaryPanel() {
    const panel = document.createElement('div');
    panel.className = 'ai-summary-panel rainbow-border';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <button class="ai-regenerate-button" aria-label="重新生成"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5.46257 4.43262C7.21556 2.91688 9.5007 2 12 2C17.5228 2 22 6.47715 22 12C22 14.1361 21.3302 16.1158 20.1892 17.7406L17 12H20C20 7.58172 16.4183 4 12 4C9.84982 4 7.89777 4.84827 6.46023 6.22842L5.46257 4.43262ZM18.5374 19.5674C16.7844 21.0831 14.4993 22 12 22C6.47715 22 2 17.5228 2 12C2 9.86386 2.66979 7.88416 3.8108 6.25944L7 12H4C4 16.4183 7.58172 20 12 20C14.1502 20 16.1022 19.1517 17.5398 17.7716L18.5374 19.5674Z"></path></svg></button>
        <button class="ai-panel-close"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.5859 12L2.79297 4.20706L4.20718 2.79285L12.0001 10.5857L19.793 2.79285L21.2072 4.20706L13.4143 12L21.2072 19.7928L19.793 21.2071L12.0001 13.4142L4.20718 21.2071L2.79297 19.7928L10.5859 12Z"></path></svg></button>
      </div>
      <div class="ai-panel-content">
        <div class="ai-summary-content"></div>
      </div>
    `;

    // 添加彩色渐变旋转边框的样式
    const style = document.createElement('style');
    style.textContent = `
      .rainbow-border {
        border-radius: 17px;
        z-index: 10005;
        overflow: hidden;
      }
      
      .rainbow-border::before {
        content: '';
        position: absolute;
        z-index: -2;
        left: -200%;
        top: -200%;
        width: 500%;
        height: 500%;
        background-color: transparent;
        background-repeat: no-repeat;
        background-size: 100%;
        background-image: conic-gradient(
          #FF0000, #FF4500, #FF8C00, #FFD700, 
          #32CD32, #00BFFF, #0000FF, #8A2BE2, 
          #FF1493, #FF0000
        );
        animation: rotate 8s linear infinite;
        opacity: 1;
        filter: blur(1px);
      }
      
      .rainbow-border::after {
        content: '';
        position: absolute;
        z-index: -1;
        left: 1px;
        top: 1px;
        width: calc(100% - 2px);
        height: calc(100% - 2px);
        background: var(--reader-panel-bg, #ffffff);
        border-radius: 16px;
        filter: blur(2px);
      }
      
      @keyframes rotate {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `;
    document.head.appendChild(style);
    
    // 添加关闭按钮事件
    panel.querySelector('.ai-panel-close').addEventListener('click', () => {
      panel.remove();
      this.summaryContainer = null;
    });
    
    // 添加重新生成按钮事件
    panel.querySelector('.ai-regenerate-button').addEventListener('click', () => {
      this.generateSummary(true); // 传入true表示强制重新生成
    });
    
    this.summaryContainer = panel.querySelector('.ai-summary-content');
    
    return panel;
  }

  // 切换总结面板显示
  toggleSummaryPanel(button) {
    // 检查是否已经存在总结面板
    const existingPanel = document.querySelector('.ai-summary-panel');
    if (existingPanel) {
      existingPanel.remove();
      this.summaryContainer = null;
      // 如果传入了按钮，恢复按钮状态
      if (button) {
        this.setButtonLoading(button, false);
      }
      return;
    }
    
    // 如果没有API Key，提示用户在设置面板中设置
    if (!this.apiKey) {
      alert('请先在设置面板中设置 DeepSeek API Key');
      // 如果传入了按钮，恢复按钮状态
      if (button) {
        this.setButtonLoading(button, false);
      }
      return;
    }
    
    // 创建总结面板但不立即显示
    const summaryPanel = this.createSummaryPanel();
    this.summaryContainer = summaryPanel.querySelector('.ai-summary-content');
    
    // 先生成总结
    this.generateSummary()
      .then(() => {
        // 总结生成完成后，再显示面板
        document.body.appendChild(summaryPanel);
        // 恢复按钮状态
        if (button) {
          this.setButtonLoading(button, false);
        }
      })
      .catch((error) => {
        // 发生错误时也恢复按钮状态
        if (button) {
          this.setButtonLoading(button, false);
        }
        // 清除summaryContainer，防止后续操作出错
        this.summaryContainer = null;
        // 显示错误信息
        alert('生成总结失败: ' + (error.message || '未知错误'));
      });
  }

  // 生成文章总结
  async generateSummary(forceRegenerate = false) {
    if (!this.apiKey || !this.summaryContainer) return;
    if (this.isGenerating) return;
    
    // 获取文章内容
    const article = document.querySelector('.reader-content');
    if (!article) {
      this.summaryContainer.innerHTML = `<div class="ai-summary-error">无法获取文章内容</div>`;
      return;
    }
    
    // 获取文章标题和正文
    const title = article.querySelector('.reader-title')?.textContent || document.title;
    const content = this.extractArticleContent(article);
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(title, content);
    
    // 检查缓存
    if (!forceRegenerate && this.summaryCache[cacheKey]) {
      this.displaySummary(this.summaryCache[cacheKey]);
      return;
    }
    
    this.isGenerating = true;
    
    // 显示加载状态
    this.summaryContainer.innerHTML = '<div class="ai-summary-loading">正在生成总结...</div>';
    
    try {
      // 调用DeepSeek API
      const summary = await this.callDeepSeekAPI(title, content);
      
      // 保存到缓存
      this.summaryCache[cacheKey] = summary;
      
      // 显示总结结果
      this.displaySummary(summary);
    } catch (error) {
      // 移除console.error
      // 处理网络错误，提供更友好的错误信息
      let errorMessage = error.message;
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = '网络连接失败，请检查您的网络连接或稍后再试';
      }
      this.summaryContainer.innerHTML = `<div class="ai-summary-error">生成总结失败: ${errorMessage}</div>`;
    } finally {
      this.isGenerating = false;
    }
  }

  // 提取文章内容
  extractArticleContent(article) {
    // 获取所有段落和标题
    const elements = article.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
    let content = '';
    
    elements.forEach(el => {
      // 跳过空段落
      if (!el.textContent.trim()) return;
      
      // 添加标题或段落内容
      content += el.textContent.trim() + '\n\n';
    });
    
    return content;
  }

  // 调用DeepSeek API
  async callDeepSeekAPI(title, content) {
    // 系统提示词，用于指导AI如何总结文章
    const systemPrompt = `
      你是一个专业的文章总结助手。请对用户提供的文章进行全面且精炼的总结，注意避免内容重复，包括以下几个方面：
      1. 文章的主要观点和核心内容：对文章内容进行整体概括，高度概括文章主旨
      2. 文章的标签：阅读文章内容后给文章打上标签，标签通常是领域、学科或专有名词
      3. 文章的主要观点：挖掘文章中的主要观点以支撑观点的具体事例、数据等
      4. 文章的结论或建议：文章最终得出的总结性观点、结论或提出的实际建议
      5. 其他视角下的反思性总结：从不同角度对文章观点进行深入思考、洞察与延伸，不要简单重复文章内容
      
      请以JSON格式输出，包含以下字段：
      - summary: 120字以内的总体摘要，高度概括文章主旨
      - tags: 文章的标签，多个标签之间以“、”分隔
      - key_points: 文章的主要观点列表（多条），详细说明每条主要观点的具体内容
      - conclusion: 文章的结论或建议，提炼出最具指导性的内容
      - reflection: 对文章主要观点的反思性总结，提出新的思考角度或延伸
      
      确保你的总结客观、准确，不要添加原文中没有的信息。反思性总结部分除外。
      确保你的总结易于理解和阅读，将专业术语或晦涩难懂的内容简单化。
    `;
    
    // 用户提示词，包含文章标题和内容
    const userPrompt = `标题：${title}\n\n内容：${content}`;
    
    try {
      // 创建请求，添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      // 显示初始加载状态
      if (this.summaryContainer) {
        this.summaryContainer.innerHTML = '<div class="ai-summary-loading">正在生成总结...</div>';
      }
      
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: {
            type: 'json_object'
          },
          stream: true // 启用流式输出
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // 清除超时
      
      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API错误 (${response.status}): ${errorData.error?.message || '未知错误'}`);
      }
      
      // 准备接收流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let summaryText = '';
      
      // 创建临时显示容器
      if (this.summaryContainer) {
        this.summaryContainer.innerHTML = '<div class="ai-summary-streaming">正在接收内容...</div>';
      }
      
      // 读取流式响应
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解码新接收的数据
        const chunk = decoder.decode(value, { stream: true });
        
        // 处理数据块，DeepSeek API的流式响应格式为：data: {json}
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                summaryText += data.choices[0].delta.content;
                
                // 尝试实时更新UI，即使JSON尚未完整
                if (this.summaryContainer) {
                  this.summaryContainer.innerHTML = `<div class="ai-summary-streaming">${summaryText}</div>`;
                }
              }
            } catch (e) {
              // 忽略解析错误，继续接收数据
            }
          }
        }
      }
      
      // 解析JSON响应
      try {
        return JSON.parse(summaryText);
      } catch (e) {
        // 如果无法解析为JSON，则直接返回文本
        return { summary: summaryText };
      }
    } catch (error) {
      // 移除console.error
      
      // 处理不同类型的错误
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请稍后再试');
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('网络连接失败，请检查您的网络连接或API服务是否可用');
      } else if (error.message.includes('NetworkError') || error.message.includes('CORS')) {
        throw new Error('网络错误或跨域请求被阻止，请检查浏览器设置或扩展权限');
      }
      
      throw error;
    }
  }

  // 显示总结结果
  displaySummary(summary) {
    if (!this.summaryContainer) return;
    
    let html = '';
    
    // 显示总体摘要
    if (summary.summary) {
      html += `<div class="ai-summary-section">
        <h4>概述</h4>
        <p>${summary.summary}</p>
      </div>`;
    }

    // 显示标签
    if (summary.tags) {
      // 将标签字符串按顿号分割成数组
      const tagsArray = summary.tags.split('、').filter(tag => tag.trim() !== '');
      
      html += `<div class="ai-summary-section">
        <h4>标签</h4>
        <div class="ai-tags-container">`;
      
      // 为每个标签创建带样式的span元素
      tagsArray.forEach(tag => {
        html += `<span class="ai-tag">${tag.trim()}</span>`;
      });
      
      html += `</div>
      </div>`;
    }
    
    // 显示关键点
    if (summary.key_points && Array.isArray(summary.key_points) && summary.key_points.length > 0) {
      html += `<div class="ai-summary-section">
        <h4>主要观点</h4>
        <ul>`;
      
      summary.key_points.forEach(point => {
        html += `<li>${point}</li>`;
      });
      
      html += `</ul>
      </div>`;
    }
    
    // 显示结论
    if (summary.conclusion) {
      html += `<div class="ai-summary-section">
        <h4>主要结论</h4>
        <p>${summary.conclusion}</p>
      </div>`;
    }

    // 显示反思性总结
    if (summary.reflection) {
      html += `<div class="ai-summary-section">
        <p class="reflection">${summary.reflection}</p>
      </div>`;
    }
    
    // 如果没有任何内容，显示错误信息
    if (!html) {
      html = '<div class="ai-summary-error">无法生成有效的总结</div>';
    }
    
    this.summaryContainer.innerHTML = html;
  }

  // 生成缓存键
  generateCacheKey(title, content) {
    // 简单的缓存键生成方法，使用标题和内容的前100个字符
    const titlePart = title.slice(0, 50);
    const contentPart = content.slice(0, 100);
    return `${titlePart}|${contentPart}`;
  }
}

// 导出AISummary类
window.AISummary = AISummary;