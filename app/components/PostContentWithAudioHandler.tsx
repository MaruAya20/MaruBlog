'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { playMusic } from '@/app/post/[slug]/Actions';

type Props = {
  content: string;
  children?: React.ReactNode;
};

// 从音频 URL 获取元数据（如封面图、艺术家、标题等）
async function extractAudioMetadataFromUrl(audioUrl: string) {
  // 这个函数将在客户端使用 jsmediatags 来提取音频文件的元数据
  if (typeof window !== 'undefined') {
    try {
      // 动态导入 jsmediatags 库
      const { default: jsmediatags } = await import('jsmediatags');
      
      return new Promise((resolve, reject) => {
        jsmediatags.read(audioUrl, {
          onSuccess: (tags: any) => {
            resolve({
              title: tags.tags.title || '',
              artist: tags.tags.artist || '',
              album: tags.tags.album || '',
              year: tags.tags.year || '',
              genre: tags.tags.genre || '',
              picture: tags.tags.picture ? {
                data: tags.tags.picture.data,
                type: tags.tags.picture.format,
                format: `image/${tags.tags.picture.format}`
              } : null
            });
          },
          onError: (error: any) => {
            console.error("Error reading audio metadata:", error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error("Failed to load jsmediatags:", error);
      return Promise.reject(error);
    }
  }
  
  return Promise.reject(new Error("Can only extract metadata in browser environment"));
}

// 将图片数据转换为 base64 URL
function convertToBase64Image(imageData: any) {
  if (!imageData || !imageData.data) return null;
  
  const base64String = imageData.data.reduce((data: string, byte: number) => {
    return data + String.fromCharCode(byte);
  }, '');
  
  const mimeType = imageData.format || `image/${imageData.type}`;
  return `data:${mimeType};base64,${btoa(base64String)}`;
}

// 触发播放动画和实际播放
function triggerAnimationAndPlay(
  card: HTMLElement,
  audioUrl: string,
  audioName: string,
) {
  // 播放音乐
  playMusic(audioUrl, audioName, '文章音频', null);
}

// 将 Markdown 中的音频 HTML 片段转换为带样式的音频卡片
function renderAudioCards(content: string) {
  // 替换旧格式的音频标签
  let processedContent = content.replace(
    /<div[^>]*data-audio[^>]*>[\s\S]*?<audio[^>]*src="(.*?)"[^>]*><\/audio>[\s\S]*?<\/div>/g,
    (match, audioSrc) => {
      const titleMatch = match.match(/🎵 ([^<]+)/);
      const title = titleMatch ? titleMatch[1] : '未知音频';
      
      return `
      <div class="audio-card" data-audio="${audioSrc}" style="
        padding: 16px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg);
        margin: 12px 0;
        cursor: pointer;
        transition: all 0.3s ease;
      " 
      onclick="event.preventDefault(); event.stopPropagation();">
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

  // 替换新的音频链接格式 [audio:音频名称](音频URL)
  processedContent = processedContent.replace(
    /\[audio:([^\]]+)\]\(([^)]+)\)/g,
    (match, title, audioSrc) => {
      return `
      <div class="audio-card" data-audio="${audioSrc}" style="
        padding: 16px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg);
        margin: 12px 0;
        cursor: pointer;
        transition: all 0.3s ease;
      "
      onclick="event.preventDefault(); event.stopPropagation();">
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
      
      // 检查是否点击了旧的音频卡片或其子元素
      let oldAudioCard: HTMLElement | null = null;
      if (t.hasAttribute('data-audio') || t.closest('[data-audio]')) {
        oldAudioCard = t.hasAttribute('data-audio') 
          ? t as HTMLElement 
          : t.closest('[data-audio]') as HTMLElement;
      }
      
      if (oldAudioCard) {
        const audioUrl = oldAudioCard.getAttribute('data-audio');
        
        if (audioUrl) {
          e.preventDefault();
          const audioNameElement = oldAudioCard.querySelector('div[style*="font-weight:500"]');
          const audioName = audioNameElement?.textContent?.replace('🎵 ', '') || '未知音频';
          
          // 开始动画
          triggerAnimationAndPlay(oldAudioCard, audioUrl, audioName);
        }
      }
      
      // 检查是否点击了新的音频卡片
      let newAudioCard: HTMLElement | null = null;
      if (t.classList.contains('audio-card') || t.closest('.audio-card')) {
        newAudioCard = t.classList.contains('audio-card') 
          ? t as HTMLElement 
          : t.closest('.audio-card') as HTMLElement;
      }
      
      if (newAudioCard) {
        e.preventDefault();
        const audioUrl = newAudioCard.getAttribute('data-audio');
        
        if (audioUrl) {
          const audioNameElement = newAudioCard.querySelector('div[style*="font-weight:500"]');
          const audioName = audioNameElement?.textContent?.replace('🎵 ', '') || '未知音频';
          
          // 开始动画
          triggerAnimationAndPlay(newAudioCard, audioUrl, audioName);
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
