'use client';

import React from 'react';
import PostContentWithAudioHandler from '@/app/components/PostContentWithAudioHandler';
import ArticleImageBinder from '@/app/components/ArticleImageBinder';

interface PostContentWrapperProps {
  content: string;
}

const PostContentWrapper: React.FC<PostContentWrapperProps> = ({ content }) => {
  return (
    <ArticleImageBinder>
      <PostContentWithAudioHandler content={content} />
    </ArticleImageBinder>
  );
};

export default PostContentWrapper;