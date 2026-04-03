'use client';

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
    <PostContentWithAudioHandler content={post.content} />
  );
}