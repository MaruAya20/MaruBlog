'use client';

import React from 'react';
import PostContentWithAudioHandler from '@/app/components/PostContentWithAudioHandler';

interface PostContentWrapperProps {
  content: string;
}

const PostContentWrapper: React.FC<PostContentWrapperProps> = ({ content }) => {
  return <PostContentWithAudioHandler content={content} />;
};

export default PostContentWrapper;