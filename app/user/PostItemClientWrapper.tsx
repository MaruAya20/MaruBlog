'use client';

import { useState, useEffect } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import ArticleImageBinder from '@/app/components/ArticleImageBinder';
import PostContentWithAudioHandler from '@/app/components/PostContentWithAudioHandler';

type PostLike = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  tags?: string[];
  cover?: string;
  content: string;
};

export default function PostItemClientWrapper({ post }: { post: PostLike }) {
  return (
    <PostContentWithAudioHandler content={post.content}>
      <MDXRemote
        source={post.content}
        options={{
          mdxOptions: {
            remarkPlugins: [],
            rehypePlugins: [],
          },
        }}
      />
    </PostContentWithAudioHandler>
  );
}