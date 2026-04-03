'use client';

import React from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import PostContentWithAudioHandler from '@/app/components/PostContentWithAudioHandler';

interface PostContentWrapperProps {
  content: string;
}

const PostContentWrapper: React.FC<PostContentWrapperProps> = ({ content }) => {
  return <PostContentWithAudioHandler content={content} />;
};

export default PostContentWrapper;