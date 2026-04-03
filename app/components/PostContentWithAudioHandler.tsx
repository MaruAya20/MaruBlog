'use client';

import React, { useEffect, useRef } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

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
async function triggerAnimationAndPlay(
  card: HTMLElement,
  audioUrl: string,
  audioName: string,
) {
  try {
    // 获取音频元数据
    const metadata: any = await extractAudioMetadataFromUrl(audioUrl);
    
    // 提取元数据
    const title = metadata.title || audioName;
    const artist = metadata.artist || '未知艺术家';
    const cover = metadata.picture ? convertToBase64Image(metadata.picture) : null;
    
    // 通过自定义事件触发全局音乐播放
    window.dispatchEvent(new CustomEvent('playMusic', {
      detail: { url: audioUrl, title, artist, cover }
    }));
  } catch (error) {
    console.error("Failed to extract audio metadata, playing with default values:", error);
    // 如果获取元数据失败，使用默认值播放
    window.dispatchEvent(new CustomEvent('playMusic', {
      detail: { url: audioUrl, title: audioName, artist: '文章音频', cover: null }
    }));
  }
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
          
          // 开始动画
          await triggerAnimationAndPlay(audioCard, audioUrl, audioName);
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