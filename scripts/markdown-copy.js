// Markdown复制功能实现
class MarkdownCopy {
  constructor() {
    this.turndownService = null;
    this.initTurndownService();
  }

  // 初始化Turndown服务
  initTurndownService() {
    if (typeof TurndownService !== 'undefined') {
      this.turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full'
      });

      // 添加自定义规则
      this.addCustomRules();
    } else {
      // 移除console.error
    }
  }

  // 添加自定义转换规则
  addCustomRules() {
    if (!this.turndownService) return;

    // 处理图片
    this.turndownService.addRule('images', {
      filter: 'img',
      replacement: function (content, node) {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        const title = node.getAttribute('title');
        const titlePart = title ? ` "${title}"` : '';
        return src ? `![${alt}](${src}${titlePart})` : '';
      }
    });

    // 处理代码块
    this.turndownService.addRule('codeBlocks', {
      filter: function (node) {
        return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
      },
      replacement: function (content, node) {
        const codeElement = node.firstChild;
        const className = codeElement.getAttribute('class') || '';
        const language = (className.match(/language-(\S+)/) || [null, ''])[1];
        const code = codeElement.textContent;
        return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      }
    });

    // 处理表格
    this.turndownService.addRule('tables', {
      filter: 'table',
      replacement: function (content, node) {
        return '\n\n' + content + '\n\n';
      }
    });

    this.turndownService.addRule('tableRows', {
      filter: 'tr',
      replacement: function (content, node) {
        return '| ' + content + ' |\n';
      }
    });

    this.turndownService.addRule('tableCells', {
      filter: ['th', 'td'],
      replacement: function (content, node) {
        return content + ' |';
      }
    });
  }

  // 创建复制Markdown按钮
  createCopyButton() {
    const copyButton = document.createElement('button');
    copyButton.className = 'markdown-copy-button';
    copyButton.setAttribute('aria-label', '复制Markdown');
    copyButton.setAttribute('title', '复制Markdown');
    copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM4 5V19H20V5H4ZM7 15.5H5V8.5H7L9 10.5L11 8.5H13V15.5H11V11.5L9 13.5L7 11.5V15.5ZM18 12.5H20L17 15.5L14 12.5H16V8.5H18V12.5Z"></path></svg>';

    // 添加点击事件
    copyButton.addEventListener('click', () => {
      this.copyMarkdown(copyButton);
    });

    return copyButton;
  }

  // 复制Markdown内容
  async copyMarkdown(button) {
    try {
      // 设置按钮为加载状态
      this.setButtonLoading(button, true);

      // 获取阅读模式的内容
      const readerContent = document.querySelector('.reader-content');
      if (!readerContent) {
        throw new Error('未找到阅读模式内容');
      }

      // 克隆内容以避免修改原始DOM
      const contentClone = readerContent.cloneNode(true);
      
      // 移除不需要的元素
      this.cleanContent(contentClone);

      // 转换为Markdown
      let markdown = '';
      if (this.turndownService) {
        markdown = this.turndownService.turndown(contentClone.innerHTML);
      } else {
        // 如果Turndown服务不可用，使用简单的文本提取
        markdown = this.simpleTextExtraction(contentClone);
      }

      // 清理Markdown格式
      markdown = this.cleanMarkdown(markdown);

      // 复制到剪贴板
      await this.copyToClipboard(markdown);

      // 显示成功提示
      this.showSuccessMessage();

    } catch (error) {
      // 移除console.error
      this.showErrorMessage(error.message);
    } finally {
      // 恢复按钮状态
      this.setButtonLoading(button, false);
    }
  }

  // 清理内容
  cleanContent(content) {
    // 移除脚本标签
    const scripts = content.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // 移除样式标签
    const styles = content.querySelectorAll('style');
    styles.forEach(style => style.remove());

    // 移除注释
    const walker = document.createTreeWalker(
      content,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );
    const comments = [];
    let node;
    while (node = walker.nextNode()) {
      comments.push(node);
    }
    comments.forEach(comment => comment.remove());
  }

  // 简单文本提取（备用方案）
  simpleTextExtraction(content) {
    let markdown = '';
    
    // 获取标题
    const title = content.querySelector('.reader-title');
    if (title) {
      markdown += `# ${title.textContent.trim()}\n\n`;
    }

    // 获取段落
    const paragraphs = content.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text) {
        markdown += `${text}\n\n`;
      }
    });

    return markdown;
  }

  // 清理Markdown格式
  cleanMarkdown(markdown) {
    return markdown
      .replace(/\n{3,}/g, '\n\n') // 移除多余的空行
      .replace(/^\s+|\s+$/g, '') // 移除首尾空白
      .replace(/\\([*_`~\[\](){}])/g, '$1'); // 移除不必要的转义
  }

  // 复制到剪贴板
  async copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      // 使用现代API
      await navigator.clipboard.writeText(text);
    } else {
      // 使用传统方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
      } catch (err) {
        throw new Error('复制失败');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  // 设置按钮加载状态
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.classList.add('loading');
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="loading-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/></circle></svg>';
    } else {
      button.classList.remove('loading');
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM4 5V19H20V5H4ZM7 15.5H5V8.5H7L9 10.5L11 8.5H13V15.5H11V11.5L9 13.5L7 11.5V15.5ZM18 12.5H20L17 15.5L14 12.5H16V8.5H18V12.5Z"></path></svg>';
    }
  }

  // 显示成功提示
  showSuccessMessage() {
    this.showToast('Markdown内容已复制到剪贴板！');
  }

  // 显示错误提示
  showErrorMessage(message) {
    this.showToast('复制失败，请重试');
  }

  // 显示提示消息
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'selection-toast';
    toast.textContent = message;
    
    document.documentElement.appendChild(toast);
    
    // 触发显示动画
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);
    
    // 2秒后自动隐藏
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2000);
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownCopy;
} else {
  window.MarkdownCopy = MarkdownCopy;
}