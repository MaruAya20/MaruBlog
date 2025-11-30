import fs from "node:fs";
import path from "node:path";

export type Role = 'ADMIN' | 'AUTHOR' | 'GUEST';
export type User = {
  id: number;
  email?: string;
  name?: string;
  role: Role;
  createdAt: string;
  avatar?: string;
  signature?: string;
  xp?: number;
  stats?: { date: string; postsToday?: number; xpToday?: number };
};
export type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  tags?: string[];
  publishedAt: string;
  authorId: number;
  status?: 'draft' | 'published';
  scheduledAt?: string;
};
export type Comment = {
  id: number;
  postSlug: string;
  content: string;
  createdAt: string;
  userId?: number;
  guestName?: string;
};
export type Pref = {
  userId: number;
  wallpaper?: string;
  opacity?: number;
  theme?: string;
  fontSize?: string;
};

export type Like = {
  id: number;
  postSlug: string;
  userId: number;
  createdAt: string;
};
export type Favorite = {
  id: number;
  postSlug: string;
  userId: number;
  createdAt: string;
};
export type Upload = {
  id: number;
  userId?: number;
  kind: 'avatar' | 'wallpaper' | 'other';
  filename: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  originalName?: string;
  mime: string;
  size: number;
};
export type Rate = { ip: string; date: string; count: number };
export type Code = { email: string; code: string; at: string };

// 后台安全：管理员提升状态与操作日志
export type AdminSession = { userId: number; until: string };
export type AdminLog = {
  id: number;
  adminId: number;
  action: string;
  targetType?: string;
  targetId?: string | number;
  detail?: string;
  createdAt: string;
  ip?: string;
  ua?: string;
};
export type CommentBan = {
  id: number;
  userId?: number;
  ip?: string;
  until: string;
  reason?: string;
  createdAt: string;
};
export type UserBan = {
  id: number;
  userId: number;
  until: string;
  reason?: string;
  createdAt: string;
  permanent?: boolean;
};

// 站点级别设置（标题、副标题、SEO、公告、功能开关等）
export type SiteSettings = {
  title: string;
  subtitle?: string;
  seoDescription?: string;
  announcement?: string;
  // 是否允许未登录访客发表评论
  allowGuestComment: boolean;
  // 是否开放注册（邮箱注册等）
  allowRegistration: boolean;
};

// 页面访问记录，用于后台仪表盘统计
export type PageView = {
  id: number;
  slug?: string;      // 文章 slug（如果是文章详情页）
  route: string;      // 访问路径
  at: string;         // 访问时间（ISO）
  userId?: number;    // 已登录用户 ID
  ip?: string;        // 访客 IP（简化版）
};

export type TagDef = {
  id: number;
  name: string;
  color?: string;
  bg?: string;
  border?: string;
  hidden?: boolean;
};

export type DB = {
  users: User[];
  posts: Post[];
  comments: Comment[];
  likes: Like[];
  favorites: Favorite[];
  prefs: Pref[];
  uploads: Upload[];
  rates?: Rate[];
  codes?: Code[];
  adminSessions?: AdminSession[];
  adminLogs?: AdminLog[];
  commentBans?: CommentBan[];
  userBans?: UserBan[];
  tagDefs?: TagDef[];
  settings?: SiteSettings;
  pageViews?: PageView[];
};

const dbCandidates = [
  path.join(process.cwd(), "data", "db.json"),
  path.join(process.cwd(), "web", "data", "db.json"),
];
const dbPath = dbCandidates.find(p=>fs.existsSync(p)) || dbCandidates[0];

function ensure(){
  if(!fs.existsSync(dbPath)){
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: [],
          posts: [],
          comments: [],
          likes: [],
          favorites: [],
          prefs: [],
          uploads: [],
          rates: [],
          codes: [],
          adminSessions: [],
          adminLogs: [],
        },
        null,
        2,
      ),
      'utf-8',
    );
  }
}

// JSON 读写仅用于迁移脚本 / 开发调试，运行时不再依赖 db.json。
export function readDB(): DB{
  ensure();
  try{
    const raw = fs.readFileSync(dbPath, "utf-8");
    const data = JSON.parse(raw);
    if(!("uploads" in data)) (data as any).uploads = [];
    if(!("likes" in data)) (data as any).likes = [];
    if(!("favorites" in data)) (data as any).favorites = [];
    if(!("comments" in data)) (data as any).comments = [];
    if(!("users" in data)) (data as any).users = [];
    if(!("posts" in data)) (data as any).posts = [];
    if(!("prefs" in data)) (data as any).prefs = [];
    if(!("rates" in data)) (data as any).rates = [];
    if(!("codes" in data)) (data as any).codes = [];
    if(!("adminSessions" in data)) (data as any).adminSessions = [];
    if(!("adminLogs" in data)) (data as any).adminLogs = [];
    if(!("commentBans" in data)) (data as any).commentBans = [];
    if(!("userBans" in data)) (data as any).userBans = [];
    if(!("tagDefs" in data)) (data as any).tagDefs = [];
    if(!("pageViews" in data)) (data as any).pageViews = [];
    return data as DB;
  }catch(e){
    // Fallback on parse error: return empty DB to avoid 500s
    return {
      users: [],
      posts: [],
      comments: [],
      likes: [],
      favorites: [],
      prefs: [],
      uploads: [],
      rates: [],
      codes: [],
      adminSessions: [],
      adminLogs: [],
      commentBans: [],
      tagDefs: [],
      settings: undefined,
      pageViews: [],
    } as DB;
  }
}


// 仅用于离线迁移 / 开发工具：运行中的应用不再调用 writeDB 写入 JSON。
export function writeDB(db: DB){
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

// 站点设置读取助手（仅在服务端环境调用）
export function getSiteSettings(): SiteSettings {
  const db = readDB();
  const raw = (db as any).settings as SiteSettings | undefined;
  return {
    title: "MaruBlog",
    subtitle: "",
    seoDescription: "",
    announcement: "",
    allowGuestComment: true,
    allowRegistration: true,
    ...(raw || {}),
  };
}

function nextId(arr: {id:number}[]): number { return arr.length ? Math.max(...arr.map(x=>x.id))+1 : 1; }

export const Store = {
  getUserByEmail(email: string){ const db = readDB(); return db.users.find(u=>u.email===email); },
  getUserByName(name: string){ const db = readDB(); return db.users.find(u=>(u.name||'')===name); },
  getUserById(id: number){ const db = readDB(); return db.users.find(u=>u.id===id); },
  createUser(data: Partial<User> & { role?: Role }): User{ const db = readDB(); const now = new Date().toISOString(); const u: User = { id: nextId(db.users), role: data.role || 'AUTHOR', createdAt: now, email: data.email, name: data.name, avatar: (data as any).avatar, signature: (data as any).signature }; db.users.push(u); writeDB(db); return u; },
  listUserPosts(userId: number){ const db = readDB(); const now = Date.now(); const isDue = (s?: string)=>{ if(!s) return false; const t = Date.parse(String(s)); return Number.isFinite(t) && t <= now; }; const effAt = (p:any)=>{ const t = isDue(p.scheduledAt) ? Date.parse(String(p.scheduledAt)) : Date.parse(String(p.publishedAt)); return Number.isFinite(t) ? t : 0; }; return db.posts.filter(p=> p.authorId===userId && (((p.status||"published")==="published") || isDue(p.scheduledAt as any))).sort((a,b)=> effAt(b)-effAt(a)); },
  getPostBySlug(slug: string){ const db = readDB(); return db.posts.find(p=>p.slug===slug); },
  deleteUser(userId: number){
    const db = readDB();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx < 0) return false;
    const user = db.users[idx];
    // 管理员账号不允许被删除
    if (user.role === 'ADMIN') return false;

    // 收集该用户的文章 slug 以及正文中的媒体 URL
    const postSlugs = new Set<string>();
    const mediaUrls = new Set<string>();
    for (const p of db.posts) {
      if (p.authorId !== userId) continue;
      postSlugs.add(p.slug);
      const content = String(p.content || "");
      const re = /\((\/uploads\/[^)]+)\)|src=\"(\/uploads\/[^\"]+)\"/g;
      for (const m of content.matchAll(re)) {
        const url = (m[1] || m[2] || "").trim();
        if (url) mediaUrls.add(url);
      }
    }

    // 收集头像、壁纸等资源 URL
    const urlsToDelete = new Set<string>();
    const pushUrl = (url?: string) => {
      if (!url) return;
      if (!url.startsWith("/uploads/")) return;
      urlsToDelete.add(url);
    };
    pushUrl((user as any).avatar);
    (db as any).prefs = (db as any).prefs || [];
    for (const pref of (db as any).prefs as any[]) {
      if (pref.userId === userId && pref.wallpaper) {
        pushUrl(pref.wallpaper);
      }
    }
    for (const url of mediaUrls) urlsToDelete.add(url);

    // 删除文章本身
    db.posts = db.posts.filter(p => p.authorId !== userId);

    // 删除评论（该用户写的 + 该用户文章下的所有评论）
    db.comments = db.comments.filter(
      (c) => c.userId !== userId && !postSlugs.has(c.postSlug),
    );

    // 删除点赞/收藏
    db.likes = db.likes.filter(
      (l) => l.userId !== userId && !postSlugs.has(l.postSlug),
    );
    (db as any).favorites = ((db as any).favorites || []).filter(
      (f: any) => f.userId !== userId && !postSlugs.has(f.postSlug),
    );

    // 从其他用户的 likedAward 中移除这些文章
    if (postSlugs.size) {
      for (const u of db.users) {
        const arr: string[] = ((u as any).likedAward || []) as string[];
        if (Array.isArray(arr) && arr.length) {
          (u as any).likedAward = arr.filter((s) => !postSlugs.has(s));
        }
      }
    }

    // 用户偏好
    db.prefs = db.prefs.filter((p) => p.userId !== userId);

    // 评论封禁 / 登录封禁记录
    (db as any).commentBans = ((db as any).commentBans || []).filter(
      (b: any) => b.userId !== userId,
    );
    (db as any).userBans = ((db as any).userBans || []).filter(
      (b: any) => b.userId !== userId,
    );

    // 登录验证码
    (db as any).codes = ((db as any).codes || []).filter(
      (c: any) => c.email !== user.email,
    );

    // 删除该用户拥有的上传文件以及与文章/头像/壁纸相关的上传记录
    try {
      const fsMod = require("node:fs") as typeof import("node:fs");
      const pathMod = require("node:path") as typeof import("node:path");
      const pub = pathMod.join(process.cwd(), "public");
      const uploads: any[] = ((db as any).uploads || []) as any[];
      (db as any).uploads = uploads.filter((u: any) => {
        const url = String(u.url || "");
        const owned = u.userId === userId;
        const listed = urlsToDelete.has(url) || mediaUrls.has(url);
        if (owned || listed) {
          if (url.startsWith("/uploads/")) {
            const filePath = pathMod.join(pub, url.replace(/^\//, ""));
            try {
              if (fsMod.existsSync(filePath)) fsMod.unlinkSync(filePath);
            } catch {}
          }
          return false;
        }
        return true;
      });
    } catch {}

    // 最后删除用户本身
    db.users.splice(idx, 1);
    writeDB(db);
    return true;
  },
  listPosts(opts?: { tag?: string; page?: number; pageSize?: number; authorId?: number; favoritedBy?: number; q?: string; includeDraft?: boolean }){ const db = readDB(); let items = db.posts.slice(); const now = Date.now(); const isDue = (s?: string)=>{ if(!s) return false; const t = Date.parse(String(s)); return Number.isFinite(t) && t <= now; }; const effAt = (p:any)=>{ const t = isDue(p.scheduledAt) ? Date.parse(String(p.scheduledAt)) : Date.parse(String(p.publishedAt)); return Number.isFinite(t) ? t : 0; }; if(opts?.tag){ items = items.filter(p=> (p.tags||[]).includes(opts.tag!)); } if(typeof opts?.authorId==='number'){ items = items.filter(p=> p.authorId===opts.authorId); } if(typeof opts?.favoritedBy==='number'){ const favSet = new Set(((db as any).favorites||[]).filter((f: any)=>f.userId===opts!.favoritedBy).map((f:any)=>f.postSlug)); items = items.filter(p=> favSet.has(p.slug)); } if(opts?.q){ const q=opts.q.toLowerCase(); items = items.filter(p=> (p.title||'').toLowerCase().includes(q) || (p.excerpt||'').toLowerCase().includes(q) || (p.content||'').toLowerCase().includes(q) || (p.tags||[]).some(t=> (t||'').toLowerCase().includes(q))); } if(!opts?.includeDraft){ items = items.filter(p=> (p.status||'published')==='published' || isDue(p.scheduledAt as any)); } items.sort((a,b)=> effAt(b)-effAt(a)); const page=opts?.page||1, ps=opts?.pageSize||5; const start=(page-1)*ps; const end=start+ps; return { items: items.slice(start,end), total: items.length, hasMore: end<items.length }; },
  createPost(authorId: number, data: { title: string; content: string; excerpt?: string; tags?: string[]; status?: 'draft'|'published'; scheduledAt?: string }): Post{ const db = readDB(); const slugBase = data.title.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\u4e00-\u9fa5\-]/g,''); let slug = slugBase || ('post-'+Date.now()); let i=1; while(db.posts.some(p=>p.slug===slug)){ slug = slugBase+'-'+(++i); } const p: Post = { id: nextId(db.posts), slug, title: data.title, content: data.content, excerpt: data.excerpt, tags: data.tags, publishedAt: new Date().toISOString(), authorId, status: data.status||'published', scheduledAt: data.scheduledAt }; db.posts.push(p); writeDB(db); return p; },
  updatePost(slug: string, userId: number, patch: Partial<Post>){ const db = readDB(); const p = db.posts.find(x=>x.slug===slug); if(!p) return null; if(p.authorId!==userId) return null; const prevStatus = p.status as any; if(patch.title){ p.title = patch.title; } if(patch.content!==undefined){ p.content = patch.content; } if(patch.excerpt!==undefined){ p.excerpt = patch.excerpt; } if(patch.tags!==undefined){ p.tags = patch.tags; } if(patch.status){ p.status = patch.status; if(patch.status==='published'){ (p as any).scheduledAt = undefined; if(prevStatus!=='published'){ p.publishedAt = new Date().toISOString(); } } } if(patch.scheduledAt!==undefined){ p.scheduledAt = patch.scheduledAt; } writeDB(db); return p; },
  deletePost(slug: string, requesterId: number, isAdmin: boolean){
    const db = readDB();
    const idx = db.posts.findIndex(x=>x.slug===slug);
    if(idx<0) return false;
    const post = db.posts[idx];
    if(!isAdmin && post.authorId!==requesterId) return false;
    // Collect media URLs from content (images/audio) under /uploads/
    const content = String(post.content||"");
    const media = Array.from(content.matchAll(/\((\/uploads\/[^)]+)\)|src=\"(\/uploads\/[^\"]+)\"/g))
      .map(m=> (m[1]||m[2]||'').trim())
      .filter(Boolean);
    // Remove post
    db.posts.splice(idx,1);
    // Cascade delete: comments, likes, favorites
    db.comments = db.comments.filter(c=>c.postSlug!==slug);
    db.likes = db.likes.filter(l=>l.postSlug!==slug);
    (db as any).favorites = ((db as any).favorites||[]).filter((f:any)=>f.postSlug!==slug);
    // Remove likedAward marker from users
    for(const u of db.users){ const arr: string[] = ((u as any).likedAward||[]) as string[]; if(Array.isArray(arr) && arr.includes(slug)){ (u as any).likedAward = arr.filter(s=>s!==slug); } }
    // Remove uploaded files & upload records that match the post content
    try{
      const fs = require('node:fs') as typeof import('node:fs');
      const path = require('node:path') as typeof import('node:path');
      const pub = path.join(process.cwd(), 'public');
      (db as any).uploads = ((db as any).uploads||[]);
      const urls = new Set(media);
      (db as any).uploads = (db as any).uploads.filter((u:any)=>{
        if(urls.has(u.url)){
          const filePath = path.join(pub, u.url.replace(/^\//,''));
          try{ if(fs.existsSync(filePath)) fs.unlinkSync(filePath); }catch{}
          return false; // remove record
        }
        return true;
      });
    }catch{}
    writeDB(db);
    return true;
  },
  listComments(postSlug: string){ const db = readDB(); return db.comments.filter(c=>c.postSlug===postSlug).sort((a,b)=> a.createdAt.localeCompare(b.createdAt)); },
  addComment(postSlug: string, data: { content: string; userId?: number; guestName?: string }){ const db = readDB(); const c: Comment = { id: nextId(db.comments as any), postSlug, content: data.content, createdAt: new Date().toISOString(), userId: data.userId, guestName: data.guestName }; db.comments.push(c); writeDB(db); return c; },
  countLikes(postSlug: string){ const db = readDB(); return db.likes.filter(l=>l.postSlug===postSlug).length; },
  hasLiked(postSlug: string, userId: number){ const db = readDB(); return db.likes.some(l=>l.postSlug===postSlug && l.userId===userId); },
  toggleLike(postSlug: string, userId: number){ const db = readDB(); const i = db.likes.findIndex(l=>l.postSlug===postSlug && l.userId===userId); if(i>=0){ db.likes.splice(i,1); writeDB(db); return { liked:false, count: db.likes.filter(l=>l.postSlug===postSlug).length }; } else { const l: Like = { id: nextId(db.likes as any), postSlug, userId, createdAt: new Date().toISOString() }; db.likes.push(l); writeDB(db); return { liked:true, count: db.likes.filter(l=>l.postSlug===postSlug).length }; } },
  // favorites
  countFavorites(postSlug: string){ const db = readDB(); return ((db as any).favorites||[]).filter((f:any)=>f.postSlug===postSlug).length; },
  hasFavorited(postSlug: string, userId: number){ const db = readDB(); return ((db as any).favorites||[]).some((f:any)=>f.postSlug===postSlug && f.userId===userId); },
  toggleFavorite(postSlug: string, userId: number){ const db = readDB(); (db as any).favorites = (db as any).favorites || []; const i = (db as any).favorites.findIndex((f:any)=>f.postSlug===postSlug && f.userId===userId); if(i>=0){ (db as any).favorites.splice(i,1); writeDB(db); return { favorited:false, count: ((db as any).favorites||[]).filter((f:any)=>f.postSlug===postSlug).length }; } else { const rec: Favorite = { id: nextId(((db as any).favorites) as any), postSlug, userId, createdAt: new Date().toISOString() }; (db as any).favorites.push(rec); writeDB(db); return { favorited:true, count: ((db as any).favorites||[]).filter((f:any)=>f.postSlug===postSlug).length }; } },
  // uploads
  setUploadStatus(id: number, status: 'pending'|'approved'|'rejected'){ const db = readDB(); const u = (db as any).uploads?.find((x:any)=>x.id===id); if(!u) return null; u.status=status; writeDB(db); return u; },
  listUploads(filter?: { status?: 'pending'|'approved'|'rejected'; kind?: 'avatar'|'wallpaper'|'other' }){ const db = readDB(); let a: any[] = (db as any).uploads || []; if(filter?.status) a = a.filter((x:any)=>x.status===filter.status); if(filter?.kind) a = a.filter((x:any)=>x.kind===filter.kind); return a.sort((a:any,b:any)=> b.createdAt.localeCompare(a.createdAt)); },
  addUpload(rec: { userId?: number; kind: 'avatar'|'wallpaper'|'other'; filename: string; url: string; originalName?: string; mime: string; size: number }){ const db = readDB(); const up: any = { id: nextId((db as any).uploads||[]), userId: rec.userId, kind: rec.kind, filename: rec.filename, url: rec.url, originalName: rec.originalName, mime: rec.mime, size: rec.size, createdAt: new Date().toISOString(), status: 'pending' }; (db as any).uploads = (db as any).uploads || []; (db as any).uploads.push(up); writeDB(db); return up; },
  // comments deletion
  deleteComment(id: number, requesterId: number, isAdmin: boolean){ const db = readDB(); const i = db.comments.findIndex(c=>c.id===id); if(i<0) return false; const c = db.comments[i]; if(!isAdmin && c.userId !== requesterId) return false; db.comments.splice(i,1); writeDB(db); return true; },
  // guest comment quota
  recordGuestComment(ip: string){ const db = readDB(); (db as any).rates = (db as any).rates || []; const today = new Date().toISOString().slice(0,10); let r = (db as any).rates.find((x: any) => x.ip === ip && x.date === today); if(!r){ r = { ip, date: today, count: 0 }; (db as any).rates.push(r); }
    if(r.count >= 5){ return { allowed: false, remain: 0 }; }
    r.count += 1; writeDB(db); return { allowed: true, remain: Math.max(0, 5 - r.count) };
  },
  // login code persistence
  setLoginCode(email: string, code: string){ const db = readDB(); (db as any).codes = (db as any).codes || []; const now = new Date().toISOString(); const i = (db as any).codes.findIndex((x: any)=>x.email===email); if(i>=0){ (db as any).codes[i] = { email, code, at: now }; } else { (db as any).codes.push({ email, code, at: now }); } writeDB(db); },
  getLoginCode(email: string){ const db = readDB(); const c: any = (db as any).codes?.find((x: any)=>x.email===email); return c || null; },
  clearLoginCode(email: string){ const db = readDB(); (db as any).codes = (db as any).codes || []; const i = (db as any).codes.findIndex((x: any)=>x.email===email); if(i>=0){ (db as any).codes.splice(i,1); writeDB(db); } },
  // leveling helpers
  getLevelFromXp(xp?: number){ const v = Math.max(0, xp||0); let lvl = 1; for(let L=1; L<=10; L++){ const threshold = Math.round(1_000_000 * Math.pow(L/10, 2)); if(v >= threshold) lvl = L; } return lvl; },
  ensureStats(u: User){ const today = new Date().toISOString().slice(0,10); if(!u.stats || u.stats.date !== today){ u.stats = { date: today, postsToday: 0, xpToday: 0 }; } if(typeof u.stats.postsToday !== 'number') u.stats.postsToday = 0; if(typeof u.stats.xpToday !== 'number') u.stats.xpToday = 0; if(typeof u.xp !== 'number') u.xp = 0; },
  canPostToday(userId: number, isAdmin: boolean){ const db = readDB(); const u = db.users.find(x=>x.id===userId); if(!u) return false; if(isAdmin) return true; (Store as any).ensureStats(u); if((u.stats!.postsToday||0) >= 50) return false; u.stats!.postsToday = (u.stats!.postsToday||0)+1; writeDB(db); return true; },
  addXP(userId: number, amount: number){ if(amount<=0) return { added: 0, xpToday: 0, xp: 0 }; const db = readDB(); const u = db.users.find(x=>x.id===userId); if(!u) return { added: 0, xpToday: 0, xp: 0 }; if(u.role==='ADMIN' || u.role==='GUEST') return { added: 0, xpToday: u?.stats?.xpToday||0, xp: u.xp||0 }; (Store as any).ensureStats(u); const remain = Math.max(0, 2500 - (u.stats!.xpToday||0)); const add = Math.min(remain, amount); if(add>0){ u.stats!.xpToday = (u.stats!.xpToday||0) + add; u.xp = (u.xp||0) + add; writeDB(db); } return { added: add, xpToday: u.stats!.xpToday||0, xp: u.xp||0 }; },
  // user preferences
  getPref(userId: number){
    const db = readDB();
    return db.prefs.find((p) => p.userId === userId) || null;
  },
  setPref(userId: number, data: Partial<Pref>){
    const db = readDB();
    (db as any).prefs = (db as any).prefs || [];
    let pref = (db as any).prefs.find((p: any) => p.userId === userId) as Pref | undefined;
    if (!pref) {
      pref = { userId, wallpaper: data.wallpaper, opacity: data.opacity };
      (db as any).prefs.push(pref);
    } else {
      if (Object.prototype.hasOwnProperty.call(data, "wallpaper")) {
        pref.wallpaper = data.wallpaper;
      }
      if (Object.prototype.hasOwnProperty.call(data, "opacity")) {
        pref.opacity = data.opacity;
      }
    }
    writeDB(db);
    return pref;
  },
  // admin elevation & logs
  setAdminElevation(userId: number, minutes: number){
    const db = readDB();
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    (db as any).adminSessions = (db as any).adminSessions || [];
    const existing = (db as any).adminSessions.find((x: any) => x.userId === userId);
    if (existing) {
      existing.until = until;
    } else {
      (db as any).adminSessions.push({ userId, until });
    }
    writeDB(db);
    return until;
  },
  clearAdminElevation(userId: number){
    const db = readDB();
    (db as any).adminSessions = (db as any).adminSessions || [];
    const idx = (db as any).adminSessions.findIndex((x: any) => x.userId === userId);
    if (idx >= 0) {
      (db as any).adminSessions.splice(idx, 1);
      writeDB(db);
    }
  },
  isAdminElevated(userId: number){
    const db = readDB();
    const list: any[] = (db as any).adminSessions || [];
    const rec = list.find((x: any) => x.userId === userId);
    if (!rec) return { elevated: false, until: null as string | null };
    const t = Date.parse(String(rec.until));
    if (!Number.isFinite(t) || t < Date.now()) {
      return { elevated: false, until: rec.until as string };
    }
    return { elevated: true, until: rec.until as string };
  },
  addAdminLog(entry: {
    adminId: number;
    action: string;
    targetType?: string;
    targetId?: string | number;
    detail?: string;
    ip?: string;
    ua?: string;
  }){
    const db = readDB();
    (db as any).adminLogs = (db as any).adminLogs || [];
    const id = nextId(((db as any).adminLogs) as any);
    const rec = {
      id,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    (db as any).adminLogs.push(rec);
    writeDB(db);
    return rec;
  },
  // user ban helpers
  getActiveUserBan(userId: number){
    const db = readDB();
    const list: any[] = (db as any).userBans || [];
    const now = Date.now();
    const active = list.filter((b: any) => {
      if (b.userId !== userId || !b.until) return false;
      const t = Date.parse(String(b.until));
      return Number.isFinite(t) && t > now;
    });
    if (!active.length) return null;
    active.sort(
      (a: any, b: any) =>
        Date.parse(String(a.until)) - Date.parse(String(b.until)),
    );
    return active[active.length - 1] as UserBan;
  },
  setUserBan(userId: number, until: string, reason?: string, permanent?: boolean){
    const db = readDB();
    (db as any).userBans = (db as any).userBans || [];
    const list: any[] = (db as any).userBans;
    const id = nextId(list as any);
    const rec: UserBan = {
      id,
      userId,
      until,
      reason,
      createdAt: new Date().toISOString(),
      permanent,
    };
    list.push(rec);
    writeDB(db);
    return rec;
  },
  clearUserBan(userId: number){
    const db = readDB();
    (db as any).userBans = (db as any).userBans || [];
    const list: any[] = (db as any).userBans;
    const filtered = list.filter((b) => b.userId !== userId);
    if (filtered.length !== list.length) {
      (db as any).userBans = filtered;
      writeDB(db);
    }
  },
  // tag definitions
  listTagDefs(){
    const db = readDB();
    return ((db as any).tagDefs || []) as TagDef[];
  },
  saveTagDefs(list: TagDef[]){
    const db = readDB();
    (db as any).tagDefs = list;
    writeDB(db);
    return list;
  },
  // page view tracking → 直接写入 Prisma.PageView（不再使用 JSON pageViews）
  addPageView(data: { route: string; slug?: string; userId?: number; ip?: string }){
    // 在同步 API 中调用，尽量避免抛错影响主流程，这里采用 fire-and-forget 写库
    try {
      // 延迟加载 prisma，避免在任意 client 端使用 Store 时打包进来
      const { prisma } = require("./prisma") as typeof import("./prisma");
      void prisma.pageView.create({
        data: {
          route: data.route,
          slug: data.slug ?? null,
          userId: data.userId ?? null,
          ip: data.ip ?? null,
        },
      });
    } catch {
      // 记录 PV 失败可以忽略
    }
  },
};


