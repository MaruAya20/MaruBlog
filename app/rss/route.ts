import { NextRequest } from 'next/server'
import { getAllPosts } from '@/lib/posts'

export const dynamic = 'force-static';

const feedHeader = (title: string, link: string, desc: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>${title}</title>\n  <link>${link}</link>\n  <description>${desc}</description>`;
const feedFooter = `\n</channel>\n</rss>`;

export async function GET(req: NextRequest){
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  const base = `${proto}://${host}`;
  const posts = getAllPosts();
  const items = posts.map(p => `\n  <item>\n    <title><![CDATA[${p.title}]]></title>\n    <link>${base}/post/${p.slug}</link>\n    <guid>${base}/post/${p.slug}</guid>\n    <pubDate>${new Date(p.date).toUTCString()}</pubDate>\n    <description><![CDATA[${p.excerpt || ''}]]></description>\n  </item>`).join('');
  const xml = feedHeader('我的博客 RSS', base, 'RSS Feed') + items + feedFooter;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
