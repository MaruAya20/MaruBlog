'use client';

import { useEffect, useRef } from 'react';
import { MDXRemote, MDXRemoteProps } from 'next-mdx-remote/rsc';
import { playMusic } from '@/app/post/[slug]/Actions';

type Props = {
  content: string;
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

export default function PostContentWithAudioHandler({ content }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 检查是否点击了音频元素
      if (target.tagName === 'AUDIO') {
        const audio = target as HTMLAudioElement;
        const src = audio.src || audio.getAttribute('src');
        
        if (src) {
          // 获取音频文件名
          const fileName = src.split('/').pop()?.split('?')[0] || '未知音频';
          const cleanFileName = fileName.replace(/\.[^/.]+$/, ""); // 去掉扩展名
          
          // 提取音频元数据（如果有jsmediatags可用）
          extractAudioMetadataFromUrl(src)
            .then((metadata: any) => {
              const cover = metadata?.picture ? convertToBase64Image(metadata.picture) : null;
              const title = metadata?.title || cleanFileName || '未知音频';
              const artist = metadata?.artist || '未知艺术家';
              
              playMusic(src, title, artist, cover || null);
            })
            .catch(() => {
              // 如果无法提取元数据，使用默认值
              playMusic(src, cleanFileName, '文章音频', null);
            });
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div ref={containerRef}>
      <MDXRemote
        source={content}
        options={{
          mdxOptions: {
            remarkPlugins: [],
            rehypePlugins: [],
          },
        }}
      />
    </div>
  );
}