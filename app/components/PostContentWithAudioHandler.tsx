'use client';

import { useEffect, useRef } from 'react';
import { MDXRemote, MDXRemoteProps } from 'next-mdx-remote/rsc';
import { extractAudioMetadataFromUrl, convertToBase64Image } from '@/lib/audioMeta';
import { playMusic } from '@/app/post/[slug]/Actions';

type Props = {
  content: string;
};

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