import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export type PostMeta = {
  slug: string;
  title: string;
  date: string; // ISO
  excerpt?: string;
  tags?: string[];
  cover?: string;
};

export type Post = PostMeta & { content: string };

// Resolve content directory robustly regardless of CWD (root or web/)
const candidates = [
  path.join(process.cwd(), 'content', 'posts'),
  path.join(process.cwd(), 'web', 'content', 'posts'),
];
const postsDir = candidates.find((p) => fs.existsSync(p)) || candidates[0];

function isPostFile(name: string){
  return name.endsWith('.md') || name.endsWith('.mdx');
}

function safeRead(file: string){
  return fs.readFileSync(file, 'utf-8');
}

function fileMtimeISO(file: string){
  try { return new Date(fs.statSync(file).mtime).toISOString(); } catch { return new Date().toISOString(); }
}

function normalizeSlug(s: string){ try { return decodeURIComponent(s); } catch { return s; } }

export function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDir)) return [];
  const files = fs.readdirSync(postsDir).filter(isPostFile);
  const slugs: string[] = [];
  for (const name of files){
    const file = path.join(postsDir, name);
    const base = name.replace(/\.(md|mdx)$/i, '');
    // Prefer frontmatter slug if present
    try{
      const { data } = matter(safeRead(file));
      const fmSlug = data?.slug ? String(data.slug) : undefined;
      slugs.push(normalizeSlug(fmSlug || base));
    }catch{
      slugs.push(normalizeSlug(base));
    }
  }
  return slugs;
}

export function getPostBySlug(input?: string | null): Post | null {
  if (!fs.existsSync(postsDir)) return null;
  const wantRaw: string = (input ?? "").toString();
  const want = wantRaw ? normalizeSlug(wantRaw.toLowerCase()) : "";
  const files = fs.readdirSync(postsDir).filter(isPostFile);

  const slugify = (s: string) => s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5\-]/g, '');

  for (const name of files){
    const file = path.join(postsDir, name);
    const base = name.replace(/\.(md|mdx)$/i, '');
    const raw = safeRead(file);
    const { data, content } = matter(raw);
    const fmSlug = data?.slug ? String(data.slug) : undefined;
    const title = data?.title ? String(data.title) : undefined;
    const candidates = [fmSlug, base, title ? slugify(title) : undefined]
      .filter(Boolean) as string[];
    // Also compare against URI-encoded variants
    const all = new Set<string>();
    for (const v of candidates){
      all.add(normalizeSlug(v.toLowerCase()));
      all.add(normalizeSlug(encodeURIComponent(v).toLowerCase()));
    }
    all.add(normalizeSlug(base.toLowerCase()));
    all.add(normalizeSlug(encodeURIComponent(base).toLowerCase()));

    if (want && (all.has(want) || all.has(wantRaw.toLowerCase()))){
      const meta: PostMeta = {
        slug: fmSlug || base,
        title: String(data?.title || (fmSlug || base)),
        date: String(data?.date || fileMtimeISO(file)),
        excerpt: data?.excerpt ? String(data.excerpt) : undefined,
        tags: Array.isArray(data?.tags) ? data.tags.map(String) : undefined,
        cover: data?.cover ? String(data.cover) : undefined,
      };
      return { ...meta, content };
    }
  }
  return null;
}

export function getAllPosts(): PostMeta[] {
  const slugs = getPostSlugs();
  const list: PostMeta[] = [];
  for (const s of slugs) {
    const p = getPostBySlug(s);
    if (p) list.push({ slug: p.slug, title: p.title, date: p.date, excerpt: p.excerpt, tags: p.tags, cover: p.cover });
  }
  return list.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getPosts(opts?: { tag?: string; page?: number; pageSize?: number }) {
  const tag = opts?.tag;
  const page = Math.max(1, opts?.page || 1);
  const pageSize = Math.max(1, Math.min(50, opts?.pageSize || 5));
  let list = getAllPosts();
  if (tag) list = list.filter((p) => (p.tags || []).includes(tag));
  const total = list.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = list.slice(start, end);
  return { items, total, page, pageSize, hasMore: end < total };
}

