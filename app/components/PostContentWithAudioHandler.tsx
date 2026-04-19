'use client';

import React, { useEffect } from 'react';
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

// 解析内容中的音频链接
function parseAudioLinks(content: string) {
  // 匹配 [audio:音频名称](音频URL) 格式的链接
  const regex = /\[audio:([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // 添加音频组件
    const title = match[1];
    const url = match[2];
    parts.push(<AudioCard key={`${url}-${match.index}`} src={url} title={title} />);

    lastIndex = regex.lastIndex;
  }

  // 添加最后剩余的文本
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts;
}

export default function PostContentWithAudioHandler({ content, children }: Props) {
  const parsedContent = parseAudioLinks(content);

  return (
    <ArticleImageBinder>
      <div className="article">
        {children}
        {parsedContent}
      </div>
    </ArticleImageBinder>
  );
}