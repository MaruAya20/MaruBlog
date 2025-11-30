"use client";
import Container from "../components/Container";
import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";

export default function DraftsPage(){
  const [me, setMe] = useState<any>(null);
  const [list, setList] = useState<any[]|null>(null);
  const [msg, setMsg] = useState("");
  const { showToast } = useToast();

  async function load(){
    const meRes = await fetch('/api/me', { cache:'no-store' }).then(r=>r.json());
    setMe(meRes.user||null);
    if(meRes.user){
      const data = await fetch(`/api/posts?includeDraft=1&authorId=${meRes.user.id}&page=1&pageSize=100`, { cache:'no-store' }).then(r=>r.json());
      const drafts = (data.posts||[]).filter((p:any)=> p.status==='draft');
      setList(drafts);
    }else{
      setList([]);
    }
  }

  useEffect(()=>{ load(); },[]);

  // 草稿列表只允许编辑或删除，发布/定时操作移动到编辑页中完成
  async function remove(slug: string){
    if(!confirm('确定删除这篇草稿吗？')) return;
    const r = await fetch(`/api/posts/${encodeURIComponent(slug)}`, { method:'DELETE' });
    if(r.ok){
      load();
    } else {
      const d = await r.json().catch(()=>({}));
      const m = d?.error || '删除失败';
      setMsg(m);
      showToast(m, 'error');
    }
  }

  if(list===null) return null;

  return (
    <Container>
      <section className="section" style={{display:'grid', gap:12}}>
        <div className="card" style={{display:'grid', gap:8}}>
          <div style={{fontWeight:600}}>我的草稿</div>
          {!list.length && <div className="hint">暂无草稿</div>}
          <div className="grid posts">
            {list.map((p:any)=> (
              <article key={p.slug} className="card post" style={{display:'grid', gap:8}}>
                <div className="title" title={p.title} style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.title||'(未命名)'}</div>
                {p.excerpt && <div className="excerpt" title={p.excerpt} style={{ overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2 as any, WebkitBoxOrient:'vertical' as any }}>{p.excerpt}</div>}
                <div className="meta">
                  {p.scheduledAt ? (
                    <span className="badge" title={`定时：${new Date(p.scheduledAt).toLocaleString()}`}>定时</span>
                  ) : (
                    <span className="badge" title="草稿">草稿</span>
                  )}
                </div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  <button className="nav-link" type="button" style={{cursor:'pointer'}} onClick={()=>{ location.href = `/drafts/${encodeURIComponent(p.slug)}`; }}>编辑</button>
                  <button className="nav-link" onClick={()=>remove(p.slug)} style={{cursor:'pointer'}}>删除</button>
                </div>
              </article>
            ))}
          </div>
          {msg && <div className="hint">{msg}</div>}
        </div>
      </section>
    </Container>
  );
}

