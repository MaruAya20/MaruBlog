'use client';

import React, { useEffect, useRef } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { playMusic } from '@/app/post/[slug]/Actions';

type Props = {
  content: string;
  children?: React.ReactNode;
};

// 触发播放动画和实际播放
function triggerAnimationAndPlay(
  card: HTMLElement,
  audioUrl: string,
  audioName: string,
) {
  // 播放音乐
  playMusic(audioUrl, audioName, '文章音频', null);
}

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
      ">
        <div style="
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
        </div>
      </div>`;
    },
  );

  return processedContent;
}

export default function PostContentWithAudioHandler({ content, children }: Props) {
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // 音频处理功能
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    
    const onClick = (e: MouseEvent) => {
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
          
          // 开始动画
          triggerAnimationAndPlay(audioCard, audioUrl, audioName);
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
      <MDXRemote
        source={processedContent}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
            ],
          },
        }}
      />
    </div>
  );
}
