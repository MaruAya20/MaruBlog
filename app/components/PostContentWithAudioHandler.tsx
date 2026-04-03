'use client';

import React, { useEffect, useRef } from 'react';

type Props = {
  content: string;
  children?: React.ReactNode;
};

// 将 Markdown 中的音频链接格式转换为 HTML 片段
function renderAudioCards(content: string) {
  // 替换新的音频链接格式 [audio:音频名称](音频URL)
  let processedContent = content.replace(
    /\[audio:([^\]]+)\]\(([^)]+)\)/g,
    (match, title, audioSrc) => {
      return `<div class="audio-card" data-audio="${audioSrc}" style="
        padding: 16px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg);
        margin: 12px 0;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 500;
        color: var(--text);
      ">
        <svg viewBox="0 0 24 24" width="20" height="20" style="margin-right: 8px;">
          <path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        🎵 ${title}
      </div>`;
    },
  );

  // 替换 Markdown 语法为 HTML
  processedContent = processedContent
    // 替换标题
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 替换粗体
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // 替换斜体
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // 替换删除线
    .replace(/~~(.*?)~~/gim, '<del>$1</del>')
    // 替换行内代码
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    // 替换链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>')
    // 替换图片
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img alt="$1" src="$2" />')
    // 替换换行
    .replace(/\n/gim, '<br />');

  return processedContent;
}

export default function PostContentWithAudioHandler({ content, children }: Props) {
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // 音频处理功能
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    
    const onClick = async (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      
      // 检查是否点击了音频卡片或其子元素
      let audioCard: HTMLElement | null = null;
      if (t.classList.contains('audio-card') || t.closest('.audio-card')) {
        audioCard = t.classList.contains('audio-card') 
          ? t as HTMLElement 
          : t.closest('.audio-card') as HTMLElement;
      }
      
      if (audioCard) {
        e.preventDefault();
        const audioUrl = audioCard.getAttribute('data-audio');
        if (audioUrl) {
          const audioNameElement = audioCard.querySelector('div[style*="font-weight:500"]');
          const audioName = audioNameElement?.textContent?.replace('🎵 ', '') || '未知音频';
          
          // 通过自定义事件触发全局音乐播放
          window.dispatchEvent(new CustomEvent('playMusic', {
            detail: { url: audioUrl, title: audioName, artist: '文章音频', cover: null }
          }));
        }
      }
    };

    const container = wrapRef.current;
    if (container) {
      container.addEventListener('click', onClick);
    }

    return () => {
      if (container) {
        container.removeEventListener('click', onClick);
      }
    };
  }, []);

  // 渲染处理过的MDX内容
  const processedContent = renderAudioCards(content);

  return (
    <div ref={wrapRef} className="article">
      {children}
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
}