"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "./ToastProvider";

export default function NewPostCTA(){
  const [canPost, setCanPost] = useState<boolean | null>(null);
  const { showToast } = useToast();
  useEffect(()=>{ (async()=>{
    try{
      const me = await fetch('/api/me', { cache: 'no-store' }).then(r=>r.json());
      const role = me?.user?.role as string | undefined;
      setCanPost(Boolean(me?.user && role !== 'GUEST'));
    }catch{ setCanPost(false); }
  })(); }, []);
  if(canPost === null) return null;
  return (
    <div className="hint">
      需要发布文章？前往 {
        canPost ? (
          <Link href="/new">新建</Link>
        ) : (
          <a
            href="#"
            onClick={(e)=>{ e.preventDefault(); showToast('请登录用户！','info'); }}
          >
            新建
          </a>
        )
      }
    </div>
  );
}
