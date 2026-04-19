'use client';

import React from 'react';
import ArticleImageBinder from './ArticleImageBinder';

type Props = {
  content: string;
  children?: React.ReactNode;
};

// 自定义音频卡片组件
const AudioCard: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const handlePlay = () => {
    // 触发全局音乐播放
    window.dispatchEvent(new CustomEvent('playMusic', {
      detail: { url: src, title: title, artist: '文章音频', cover: null }
    }));
  };

  return (
    <div 
      className="audio-card"
      data-audio={src}
      onClick={handlePlay}
      style={{
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        margin: '12px 0',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontWeight: 500,
        color: 'var(--text)'
      }}
    >
      <svg 
        viewBox="0 0 24 24" 
        width="20" 
        height="20" 
        style={{ flexShrink: 0 }}
      >
        <path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
      🎵 {title}
    </div>
  );
};

// 解析内容中的各种格式
function parseContent(content: string) {
  // 先处理音频格式（新格式和旧格式）
  let processedContent = content;
  
  // 处理新音频格式 [audio:title](url)
  const newAudioRegex = /\[audio:([^\]]+)\]\(([^)]+)\)/g;
  processedContent = processedContent.replace(newAudioRegex, (_, title, url) => {
    return `__AUDIO_CARD_START__${url}__|__${title}__AUDIO_CARD_END__`;
  });
  
  // 处理旧音频格式（div.audio-card）
  const oldAudioRegex = /<div\s+className=["']card["']\s+data-audio[^>]*>[\s\S]*?<audio[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/div>/g;
  processedContent = processedContent.replace(oldAudioRegex, (_, url) => {
    // 从URL中提取文件名作为标题
    const fileName = url.split('/').pop()?.replace(/\.[^/.]+$/, "") || '未知音频';
    return `__AUDIO_CARD_START__${url}__|__${fileName}__AUDIO_CARD_END__`;
  });
  
  // 按行分割文本
  const lines = processedContent.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查是否为标题行
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      
      // 根据级别动态创建标题元素
      switch(level) {
        case 1:
          elements.push(
            <h1 key={`heading-${i}`} style={{ marginTop: '1.2em', marginBottom: '.6em' }}>
              {applyInlineFormatting(headingText)}
            </h1>
          );
          break;
        case 2:
          elements.push(
            <h2 key={`heading-${i}`} style={{ marginTop: '1.2em', marginBottom: '.6em' }}>
              {applyInlineFormatting(headingText)}
            </h2>
          );
          break;
        case 3:
          elements.push(
            <h3 key={`heading-${i}`} style={{ marginTop: '1.2em', marginBottom: '.6em' }}>
              {applyInlineFormatting(headingText)}
            </h3>
          );
          break;
        case 4:
          elements.push(
            <h4 key={`heading-${i}`} style={{ marginTop: '1.2em', marginBottom: '.6em' }}>
              {applyInlineFormatting(headingText)}
            </h4>
          );
          break;
        case 5:
          elements.push(
            <h5 key={`heading-${i}`} style={{ marginTop: '1.2em', marginBottom: '.6em' }}>
              {applyInlineFormatting(headingText)}
            </h5>
          );
          break;
        case 6:
          elements.push(
            <h6 key={`heading-${i}`} style={{ marginTop: '1.2em', marginBottom: '.6em' }}>
              {applyInlineFormatting(headingText)}
            </h6>
          );
          break;
      }
      continue;
    }
    
    // 检查是否为列表项
    const listItemMatch = line.match(/^(\s*)([*+-]|\d+\.)\s+(.+)$/);
    if (listItemMatch) {
      const indentSpaces = listItemMatch[1].length;
      const indentLevel = Math.floor(indentSpaces / 2); // 每两个空格为一级缩进
      const marker = listItemMatch[2];
      const itemText = listItemMatch[3];
      
      // 判断是有序还是无序列表
      const isOrdered = /^\d+\./.test(marker);
      const listKey = `list-${i}`;
      
      // 这里简单处理，实际可能需要更复杂的嵌套逻辑
      elements.push(
        <li key={listKey} style={{ marginLeft: `${indentLevel * 20}px` }}>
          {applyInlineFormatting(itemText)}
        </li>
      );
      continue;
    }
    
    // 检查是否为分隔线
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', height: '1px', background: 'var(--border)', margin: '24px 0' }} />);
      continue;
    }

    // 处理普通行内容
    // 处理图片: ![图片](/api/uploads/...)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let lastImageIndex = 0;
    let imageMatch;
    const lineElements: React.ReactNode[] = [];

    while ((imageMatch = imageRegex.exec(line)) !== null) {
      // 添加匹配前的文本
      if (imageMatch.index > lastImageIndex) {
        const textBefore = line.substring(lastImageIndex, imageMatch.index);
        if (textBefore) {
          lineElements.push(...applyInlineFormatting(textBefore));
        }
      }

      // 添加图片组件
      const altText = imageMatch[1];
      const imageUrl = imageMatch[2];
      lineElements.push(
        <img 
          key={`img-${encodeURIComponent(imageUrl)}`} // 使用encodeURIComponent处理URL中的特殊字符
          src={imageUrl} 
          alt={altText}
          data-full-src={imageUrl}
          style={{ 
            maxWidth: '70%',     // 限制图片宽度为容器的70%
            height: 'auto',      // 高度自适应
            borderRadius: '8px', 
            cursor: 'zoom-in', 
            margin: '10px 0' 
          }}
        />
      );

      lastImageIndex = imageRegex.lastIndex;
    }

    // 添加最后剩余的文本
    if (lastImageIndex < line.length) {
      const remainingLine = line.substring(lastImageIndex);
      if (remainingLine) {
        lineElements.push(...applyInlineFormatting(remainingLine));
      }
    }

    // 检查是否有音频卡片
    const audioCardStart = '__AUDIO_CARD_START__';
    const audioCardEnd = '__AUDIO_CARD_END__';
    const audioSep = '__|__';
    
    if (line.includes(audioCardStart)) {
      // 分割行内容
      const parts = line.split(new RegExp(`(${audioCardStart}[^${audioCardEnd}]+${audioCardEnd})`));
      
      parts.forEach((part, idx) => {
        if (part.startsWith(audioCardStart) && part.endsWith(audioCardEnd)) {
          // 这是一个音频卡片
          const audioData = part
            .substring(audioCardStart.length, part.length - audioCardEnd.length)
            .split(audioSep);
          
          if (audioData.length === 2) {
            const [url, title] = audioData;
            elements.push(<AudioCard key={`audio-${idx}-${i}`} src={url} title={title} />);
          }
        } else if (part.trim()) {
          // 这是普通文本
          const subParts = part.split(new RegExp(`(${audioCardStart}[^${audioCardEnd}]+${audioCardEnd})`));
          
          subParts.forEach((subPart, subIdx) => {
            if (subPart.startsWith(audioCardStart) && subPart.endsWith(audioCardEnd)) {
              const audioData = subPart
                .substring(audioCardStart.length, subPart.length - audioCardEnd.length)
                .split(audioSep);
              
              if (audioData.length === 2) {
                const [url, title] = audioData;
                elements.push(<AudioCard key={`audio-sub-${subIdx}-${idx}-${i}`} src={url} title={title} />);
              }
            } else if (subPart.trim()) {
              elements.push(...applyInlineFormatting(subPart));
            }
          });
        }
      });
    } else {
      // 添加行元素
      if (lineElements.length > 0) {
        elements.push(
          <React.Fragment key={`line-${i}`}>
            {lineElements}
            {i < lines.length - 1 && <br />} {/* 添加换行 */}
          </React.Fragment>
        );
      }
    }
  }

  return elements;
}

// 应用内联格式化（粗体、斜体、链接等）
function applyInlineFormatting(text: string) {
  // 处理链接: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastLinkIndex = 0;
  let linkMatch;
  const elements: React.ReactNode[] = [];

  while ((linkMatch = linkRegex.exec(text)) !== null) {
    // 添加匹配前的文本
    if (linkMatch.index > lastLinkIndex) {
      const textBefore = text.substring(lastLinkIndex, linkMatch.index);
      if (textBefore) {
        elements.push(...processSimpleFormatting(textBefore));
      }
    }

    // 添加链接
    const linkText = linkMatch[1];
    const linkUrl = linkMatch[2];
    elements.push(
      <a 
        key={`link-${linkMatch.index}`} 
        href={linkUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ color: 'var(--brand)', textDecoration: 'underline' }}
      >
        {linkText}
      </a>
    );

    lastLinkIndex = linkRegex.lastIndex;
  }

  // 添加最后剩余的文本
  if (lastLinkIndex < text.length) {
    const remainingText = text.substring(lastLinkIndex);
    if (remainingText) {
      elements.push(...processSimpleFormatting(remainingText));
    }
  }

  return elements;
}

// 处理简单的文本格式化（粗体、斜体、删除线、行内代码）
function processSimpleFormatting(text: string) {
  // 处理粗体: **text**
  let formattedElements: React.ReactNode[] = [text];

  // 先处理粗体
  formattedElements = processFormatPattern(formattedElements, /\*\*(.*?)\*\*/g, (content) => (
    <strong key={`bold-${Date.now()}-${Math.random()}`}>{content}</strong>
  ));

  // 再处理斜体
  formattedElements = processFormatPattern(formattedElements, /\*([^*]+)\*/g, (content) => (
    <em key={`em-${Date.now()}-${Math.random()}`}>{content}</em>
  ));

  // 处理删除线
  formattedElements = processFormatPattern(formattedElements, /~~(.*?)~~/g, (content) => (
    <del key={`del-${Date.now()}-${Math.random()}`}>{content}</del>
  ));

  // 处理行内代码
  formattedElements = processFormatPattern(formattedElements, /`(.*?)`/g, (content) => (
    <code key={`code-${Date.now()}-${Math.random()}`}>{content}</code>
  ));

  return formattedElements;
}

// 通用格式处理函数
function processFormatPattern(elements: React.ReactNode[], regex: RegExp, wrapper: (content: React.ReactNode) => React.ReactNode) {
  const newElements: React.ReactNode[] = [];

  elements.forEach(element => {
    if (typeof element === 'string') {
      const matches = Array.from(element.matchAll(regex));
      
      if (matches.length === 0) {
        newElements.push(element);
        return;
      }

      let lastIndex = 0;
      const subElements: React.ReactNode[] = [];

      for (const match of matches) {
        // 添加匹配前的内容
        if (match.index !== undefined && match.index > lastIndex) {
          subElements.push(element.substring(lastIndex, match.index));
        }

        // 添加格式化后的内容
        const content = match[1]; // 第一个捕获组
        subElements.push(wrapper(applyInlineFormatting(content)));

        lastIndex = match.index + match[0].length; // 更新索引到最后匹配的位置
      }

      // 添加最后剩余的内容
      if (lastIndex < element.length) {
        subElements.push(element.substring(lastIndex));
      }

      // 递归处理子元素
      subElements.forEach(subEl => newElements.push(subEl));
    } else {
      newElements.push(element);
    }
  });

  return newElements;
}

export default function PostContentWithAudioHandler({ content, children }: Props) {
  const parsedContent = parseContent(content);

  return (
    <ArticleImageBinder>
      <div className="article">
        {children}
        {parsedContent}
      </div>
    </ArticleImageBinder>
  );
}