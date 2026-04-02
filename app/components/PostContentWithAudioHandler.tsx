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
      
      // 检查是否点击了旧的音频卡片或其子元素
      let oldAudioCard: HTMLElement | null = null;
      if (target.hasAttribute('data-audio') || target.closest('[data-audio]')) {
        oldAudioCard = target.hasAttribute('data-audio') 
          ? target as HTMLElement 
          : target.closest('[data-audio]') as HTMLElement;
      }
      
      if (oldAudioCard) {
        const audioElement = oldAudioCard.querySelector('audio');
        if (audioElement) {
          e.preventDefault();
          const src = audioElement.src || audioElement.getAttribute('src');
          
          if (src) {
            // 获取音频文件名
            const fileName = src.split('/').pop()?.split('?')[0] || '未知音频';
            const cleanFileName = fileName.replace(/\.[^/.]+$/, ""); // 去掉扩展名
            
            // 开始动画
            triggerAnimationAndPlay(oldAudioCard, src, cleanFileName);
          }
        }
      }
      
      // 检查是否点击了新的音频卡片
      let newAudioCard: HTMLElement | null = null;
      if (target.classList.contains('audio-card') || target.closest('.audio-card')) {
        newAudioCard = target.classList.contains('audio-card') 
          ? target as HTMLElement 
          : target.closest('.audio-card') as HTMLElement;
      }
      
      if (newAudioCard) {
        e.preventDefault();
        const audioUrl = newAudioCard.getAttribute('data-audio');
        
        if (audioUrl) {
          const audioNameElement = newAudioCard.querySelector('div[style*="font-weight:500"]');
          const audioName = audioNameElement?.textContent || '未知音频';
          
          // 开始动画
          triggerAnimationAndPlay(newAudioCard, audioUrl, audioName);
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, []);

  // 触发动画并将音频发送到全局播放器
  const triggerAnimationAndPlay = async (audioCard: HTMLElement, src: string, cleanFileName: string) => {
    // 查找音频名称元素
    const audioTitleElement = audioCard.querySelector('div')?.firstChild?.textContent?.replace('🎵 ', '') || cleanFileName;
    
    // 创建临时图像元素用于动画
    const tempImg = document.createElement('div');
    tempImg.innerHTML = '♪'; // 使用音符符号作为默认图像
    tempImg.style.position = 'fixed';
    tempImg.style.zIndex = '9999';
    tempImg.style.fontSize = '24px';
    tempImg.style.width = '40px';
    tempImg.style.height = '40px';
    tempImg.style.display = 'flex';
    tempImg.style.alignItems = 'center';
    tempImg.style.justifyContent = 'center';
    tempImg.style.background = 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)';
    tempImg.style.borderRadius = '8px';
    tempImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    tempImg.style.left = `${audioCard.getBoundingClientRect().left}px`;
    tempImg.style.top = `${audioCard.getBoundingClientRect().top}px`;
    tempImg.style.color = 'white';
    
    // 尝试获取专辑封面
    extractAudioMetadataFromUrl(src)
      .then((metadata: any) => {
        if (metadata?.picture) {
          const cover = convertToBase64Image(metadata.picture);
          if (cover) {
            tempImg.innerHTML = '';
            const img = document.createElement('img');
            img.src = cover;
            img.alt = '音频封面';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.borderRadius = '8px';
            img.style.objectFit = 'cover';
            tempImg.appendChild(img);
          }
        }
      })
      .catch(() => {
        // 如果无法获取封面，继续使用默认图标
      })
      .finally(() => {
        document.body.appendChild(tempImg);
        
        // 获取目标位置（全局播放器位置）
        const musicPlayer = document.querySelector('.music-player');
        if (musicPlayer) {
          const targetRect = musicPlayer.getBoundingClientRect();
          
          // 执行动画
          tempImg.animate([
            { 
              transform: `translate(0, 0) scale(1)`,
              opacity: 1
            },
            { 
              transform: `translate(${targetRect.left - audioCard.getBoundingClientRect().left}px, ${targetRect.top - audioCard.getBoundingClientRect().top}px) scale(0.3)`,
              opacity: 0.5
            },
            { 
              transform: `translate(${targetRect.left - audioCard.getBoundingClientRect().left}px, ${targetRect.top - audioCard.getBoundingClientRect().top}px) scale(0)`,
              opacity: 0
            }
          ], {
            duration: 600,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
          }).onfinish = () => {
            document.body.removeChild(tempImg);
            // 动画完成后播放音乐
            playMusic(src, audioTitleElement, '文章音频', null);
          };
        } else {
          // 如果找不到播放器，直接播放音乐
          setTimeout(() => {
            document.body.removeChild(tempImg);
            playMusic(src, audioTitleElement, '文章音频', null);
          }, 300);
        }
      });
  };

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