import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Protect /admin routes
  if (path.startsWith('/admin')) {
    const token = req.cookies.get('sess')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');
      const { payload } = await jwtVerify(token, secret);
      const role = (payload as any)?.role;
      if (role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }
  const wp = url.searchParams.get('wallpaper');
  const op = url.searchParams.get('opacity');
  const persist = url.searchParams.get('persist');

  if (!wp && !op) return NextResponse.next();

  // Clean URL
  url.searchParams.delete('wallpaper');
  url.searchParams.delete('opacity');
  url.searchParams.delete('persist');

  const res = NextResponse.redirect(url);
  if (wp) res.cookies.set('wp_url', wp, { path: '/', maxAge: persist ? 60 * 60 * 24 * 30 : undefined });
  if (op) {
    const n = Math.max(0, Math.min(1, Number(op)));
    res.cookies.set('wp_opacity', String(n), { path: '/', maxAge: persist ? 60 * 60 * 24 * 30 : undefined });
  }
  return res;
}

// 只在页面路由上运行，不拦截 /api/** 请求，避免对带 body 的 API 请求做多余包装
export const config = {
  matcher: [
    '/((?!api/).*)',
  ],
};

