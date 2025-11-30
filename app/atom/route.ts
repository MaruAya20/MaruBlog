import { NextRequest } from 'next/server'
import { getAllPosts } from '@/lib/posts'

export const dynamic = 'force-static';

export async function GET(req: NextRequest){
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  const base = `${proto}://${host}`;
  const posts = getAllPosts();
  const updated = posts[0]?.date || new Date().toISOString();
  const entries = posts.map(p => `
    <entry>
      <title><![CDATA[${p.title}]]></title>
      <link href="${base}/post/${p.slug}" />
      <id>${base}/post/${p.slug}</id>
      <updated>${new Date(p.date).toISOString()}</updated>
      <summary><![CDATA[${p.excerpt || ''}]]></summary>
    </entry>
  `).join('');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <title>我的博客 Atom</title>
    <link href="${base}/atom" rel="self"/>
    <link href="${base}"/>
    <updated>${new Date(updated).toISOString()}</updated>
    <id>${base}/</id>
    ${entries}
  </feed>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
