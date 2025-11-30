"use client";
import { useEffect, useRef, useState } from "react";
import MarkdownToolbar from "../../components/MarkdownToolbar";
import { useToast } from "../../components/ToastProvider";
import { getLevelBadge } from "@/lib/userLevel";

type ImageItem = { url: string; name: string; snippet: string };
type AudioItem = { url: string; name: string; snippet: string };

// 点赞按钮
export function LikeButton({ slug }: { slug: string }) {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${encodeURIComponent(slug)}/likes`)
      .then((r) => r.json())
      .then((d) => {
        setCount(d.count || 0);
        setLiked(Boolean(d.liked));
      })
      .catch(() => {});
  }, [slug]);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/posts/${encodeURIComponent(slug)}/likes`,
        { method: "POST" },
      );
      if (r.ok) {
        const d = await r.json();
        setLiked(Boolean(d.liked));
        setCount(d.count);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="nav-link"
      disabled={loading}
      onClick={toggle}
      style={{ cursor: "pointer" }}
    >
      {liked ? "已赞" : "点赞"} · {count}
    </button>
  );
}

// 收藏按钮
export function FavoriteButton({ slug }: { slug: string }) {
  const [count, setCount] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${encodeURIComponent(slug)}/favorites`)
      .then((r) => r.json())
      .then((d) => {
        setCount(d.count || 0);
        setFavorited(Boolean(d.favorited));
      })
      .catch(() => {});
  }, [slug]);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/posts/${encodeURIComponent(slug)}/favorites`,
        { method: "POST" },
      );
      if (r.ok) {
        const d = await r.json();
        setFavorited(Boolean(d.favorited));
        setCount(d.count);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="nav-link"
      disabled={loading}
      onClick={toggle}
      style={{ cursor: "pointer" }}
    >
      {favorited ? "已收藏" : "收藏"} · {count}
    </button>
  );
}

// 评论列表与输入
export function Comments({ slug }: { slug: string }) {
  const [list, setList] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [me, setMe] = useState<any>(null);
  const { showToast } = useToast();

  async function load() {
    const d = await fetch(
      `/api/posts/${encodeURIComponent(slug)}/comments`,
    ).then((r) => r.json());
    setList(d.comments || []);
  }

  useEffect(() => {
    load().catch(() => {});
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user || null))
      .catch(() => {});
  }, [slug]);

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed) {
      showToast("评论内容不能为空", "info");
      return;
    }
    const body: any = { content: trimmed };
    if (!me && guestName.trim()) {
      body.guestName = guestName.trim();
    }
    const r = await fetch(
      `/api/posts/${encodeURIComponent(slug)}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (r.ok) {
      setContent("");
      setGuestName("");
      load().catch(() => {});
      return;
    }

    const d = await r.json().catch(() => ({}));
    if (d?.error === "guest_comment_disabled") {
      showToast(
        d?.message || "当前站点暂时关闭访客评论，请登录后再试~",
        "info",
      );
    } else if (d?.error === "comment_banned") {
      // 本地化解封时间，并附加封禁原因
      let tip = "";
      if (d.until) {
        const t = new Date(String(d.until));
        if (!Number.isNaN(t.getTime())) {
          const local = t.toLocaleString();
          tip = `评论权限直到 ${local} 解禁！`;
        }
      }
      if (d.reason) {
        const reasonText = String(d.reason);
        tip = tip
          ? `${tip} 封禁原因：${reasonText}`
          : `评论权限已被封禁，原因：${reasonText}`;
      }
      if (!tip) {
        tip = d.message || "评论权限当前被关闭，请稍后再试~";
      }
      showToast(tip, "error");
    } else if (d?.error === "rate_limited") {
      showToast(
        d?.message || "评论上传频率过高，请稍后再试哦~",
        "error",
      );
    } else if (d?.message) {
      showToast(d.message, "error");
    } else {
      showToast("发表评论失败，请稍后再试~", "error");
    }
  }

  async function remove(id: number) {
    if (!window.confirm("确定删除这条评论吗？")) return;
    const r = await fetch(
      `/api/posts/${encodeURIComponent(slug)}/comments?id=${id}`,
      { method: "DELETE" },
    );
    if (r.ok) {
      load().catch(() => {});
    } else {
      showToast("无权限或删除失败", "error");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 600 }}>评论</div>
      <div style={{ display: "grid", gap: 6 }}>
        <textarea
          rows={3}
          placeholder="写下你的想法（未登录可填昵称）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "transparent",
            color: "var(--text)",
          }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="昵称（未登录可选）"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <button
            className="nav-link"
            type="button"
            onClick={submit}
            style={{ cursor: "pointer" }}
          >
            发布
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {list.map((c: any) => {
          const badge = c.user
            ? getLevelBadge(c.user.role as any, c.user.level)
            : null;
          const canJump = Boolean(c.user?.name);
          const gotoProfile = () => {
            if (c.user?.name) {
              location.href = `/user/${encodeURIComponent(
                c.user.name,
              )}`;
            }
          };
          const isGuest = !c.user;
          return (
            <div
              key={c.id}
              className="card"
              style={{ padding: 10, position: "relative" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  onMouseEnter={() => setHoverId(c.user?.id || null)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid var(--border)",
                    background: "rgba(159,122,234,.12)",
                    overflow: "hidden",
                    cursor: canJump ? "pointer" : "default",
                  }}
                  onClick={gotoProfile}
                >
                  {c.user?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.user.avatar}
                      alt="头像"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ fontWeight: 700 }}>
                      {(c.user?.name || c.displayName || "游客").slice(
                        0,
                        1,
                      )}
                    </span>
                  )}
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        cursor: canJump ? "pointer" : "default",
                      }}
                      onClick={gotoProfile}
                    >
                      {c.user?.name || c.displayName}
                    </div>
                    {isGuest && (
                      <span
                        className="user-level"
                        style={{
                          borderColor: "#6b7280",
                          color: "#d1d5db",
                          background: "rgba(31,41,55,.4)",
                        }}
                      >
                        访客
                      </span>
                    )}
                    {badge && (
                      <>
                        <span
                          className="user-level"
                          style={{
                            borderColor: badge.color,
                            color: badge.color,
                            background: badge.bg,
                            cursor: canJump ? "pointer" : "default",
                          }}
                          onClick={gotoProfile}
                        >
                          {badge.text}
                        </span>
                        {badge.extraTag && (
                          <span
                            className="user-level"
                            style={{
                              cursor: canJump ? "pointer" : "default",
                            }}
                          >
                            {badge.extraTag}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
                {me &&
                  (me.role === "ADMIN" || me.id === c.user?.id) && (
                    <button
                      className="nav-link"
                      type="button"
                      onClick={() => remove(c.id)}
                      style={{
                        marginLeft: "auto",
                        cursor: "pointer",
                      }}
                    >
                      删除
                    </button>
                  )}
              </div>
              <div style={{ marginTop: 6 }}>{c.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 文章作者 / 管理员编辑区域
export function OwnerActions({ slug }: { slug: string }) {
  const [me, setMe] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [preset, setPreset] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  // 加载用户与文章
  useEffect(() => {
    (async () => {
      try {
        const meResp = await fetch("/api/me", { cache: "no-store" });
        const meData = await meResp.json().catch(() => ({}));
        setMe(meData.user || null);
      } catch {
        setMe(null);
      }
      try {
        const r = await fetch(
          `/api/posts/${encodeURIComponent(slug)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const d = await r.json();
        const p = d.post;
        if (!p || !p.authorId) {
          setPost(null);
          return;
        }
        setPost(p);
        setTitle(p.title || "");
        setContent(p.content || "");
        setExcerpt(p.excerpt || "");
        setTags(Array.isArray(p.tags) ? p.tags : []);

        // 解析正文中的已有图片和音频，填充卡片列表，使编辑体验与新建页一致
        const c = String(p.content || "");

        // 图片：匹配 ![...](url)
        const imgMatches = Array.from(
          c.matchAll(/!\[[^\]]*]\(([^)]+)\)/g),
        );
        setImages(
          imgMatches.slice(0, 3).map((m) => {
            const url = m[1];
            const snippet = `\n![图片](${url})\n`;
            return { url, name: "图片", snippet };
          }),
        );

        // 音频：匹配我们生成的 data-audio 片段
        const audioMatches = Array.from(
          c.matchAll(
            /<div className=\"card\" data-audio>\s*<div>🎵 ([^<]+)<\/div>\s*<audio[^>]* src=\"([^\"]+)\"/g,
          ),
        );
        setAudios(
          audioMatches.slice(0, 2).map((m) => {
            const name = m[1];
            const url = m[2];
            const safeName = name.replace(/[`\\]/g, "");
            const snippet = `\n<div className=\"card\" data-audio>\n  <div>🎵 ${safeName}</div>\n  <audio controls src="${url}" preload="none" style={{width:'100%'}} />\n</div>\n`;
            return { url, name, snippet };
          }),
        );
        if (p.scheduledAt) {
          const t = new Date(p.scheduledAt);
          if (!Number.isNaN(t.getTime())) {
            const isoLocal = new Date(
              t.getTime() - t.getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16);
            setScheduledAt(isoLocal);
          }
        } else {
          setScheduledAt("");
        }
      } catch {
        setPost(null);
      }
      try {
        const r = await fetch("/api/tags", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          setPreset(d.tags || []);
        }
      } catch {
        // ignore
      }
    })().catch(() => {});
  }, [slug]);

  const isOwnerOrAdmin =
    me &&
    post &&
    (me.role === "ADMIN" || me.id === post.authorId);

  if (!isOwnerOrAdmin) {
    return null;
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files) return;
    if (images.length >= 3) {
      showToast("最多只能添加 3 张图片", "info");
      return;
    }
    const remaining = Math.max(0, 3 - images.length);
    const picked = Array.from(files).slice(0, remaining);
    for (const f of picked) {
      if (f.size > 10 * 1024 * 1024) {
        showToast(`${f.name} 超过 10MB，已跳过`, "error");
        continue;
      }
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await fetch("/api/upload?kind=other", {
          method: "POST",
          body: fd,
        });
        const d = await r.json();
        if (!r.ok || !d?.upload?.url) {
          showToast(d?.error || "上传失败", "error");
          continue;
        }
        const url = d.upload.url as string;
        const snippet = `\n![图片](${url})\n`;
        setContent((prev) => prev + snippet);
        setImages((prev) =>
          [...prev, { url, name: f.name, snippet }].slice(0, 3),
        );
      } catch {
        showToast("上传失败", "error");
      }
    }
  }

  async function handleAudioFile(file: File | null) {
    if (!file) return;
    if (audios.length >= 2) {
      showToast("最多只能添加 2 个音频", "info");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(`${file.name} 超过 10MB，已跳过`, "error");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/upload?kind=other", {
        method: "POST",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok || !d?.upload?.url) {
        showToast(d?.error || "上传失败", "error");
        return;
      }
      const url = d.upload.url as string;
      const safeName = file.name.replace(/[`\\]/g, "");
      const snippet = `\n<div className="card" data-audio>\n  <div>🎵 ${safeName}</div>\n  <audio controls src="${url}" preload="none" style={{width:'100%'}} />\n</div>\n`;
      setContent((prev) => prev + snippet);
      setAudios((prev) =>
        prev.length >= 2
          ? prev
          : [...prev, { url, name: file.name, snippet }],
      );
    } catch {
      showToast("上传失败", "error");
    }
  }

  async function removeImage(item: ImageItem) {
    setImages((prev) => prev.filter((x) => x.url !== item.url));
    setContent((prev) => prev.replace(item.snippet, ""));
    try {
      await fetch("/api/upload/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [item.url] }),
      });
    } catch {
      // ignore cleanup failures
    }
  }

  async function removeAudio(item: AudioItem) {
    setAudios((prev) => prev.filter((x) => x.url !== item.url));
    setContent((prev) => prev.replace(item.snippet, ""));
    try {
      await fetch("/api/upload/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [item.url] }),
      });
    } catch {
      // ignore cleanup failures
    }
  }

  async function saveDraft() {
    if (!post) return;
    if (!title.trim() || !content.trim()) {
      showToast("标题和正文不能为空", "info");
      return;
    }
    let schedIso: string | undefined;
    if (scheduledAt) {
      const t = Date.parse(String(scheduledAt));
      if (!Number.isFinite(t) || t <= Date.now()) {
        showToast("定时发布时间必须在当前时间之后", "error");
        return;
      }
      schedIso = new Date(t).toISOString();
    }
    setSaving(true);
    setMsg("正在保存草稿...");
    try {
      const body: any = {
        title,
        content,
        excerpt,
        tags,
        status: "draft",
      };
      if (schedIso) body.scheduledAt = schedIso;
      const r = await fetch(
        `/api/posts/${encodeURIComponent(slug)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg("草稿已保存");
        showToast("草稿已保存", "success");
      } else {
        setMsg(d?.error || "保存草稿失败");
        showToast(d?.error || "保存草稿失败", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!post) return;
    if (!title.trim() || !content.trim()) {
      showToast("标题和正文不能为空", "info");
      return;
    }
    setSaving(true);
    setMsg("正在发布...");
    try {
      const body: any = {
        title,
        content,
        excerpt,
        tags,
        status: "published",
      };
      const r = await fetch(
        `/api/posts/${encodeURIComponent(slug)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg("已发布");
        showToast("文章已发布", "success");
      } else {
        setMsg(d?.error || "发布失败");
        showToast(d?.error || "发布失败", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removePost() {
    if (!window.confirm("确定要删除这篇文章吗？")) return;
    const r = await fetch(
      `/api/posts/${encodeURIComponent(slug)}`,
      { method: "DELETE" },
    );
    if (r.ok) {
      showToast("文章已删除", "success");
      // 删除后跳转到作者个人主页（或首页）
      if (me?.name) {
        window.location.href = `/user/${encodeURIComponent(me.name)}`;
      } else {
        window.location.href = "/";
      }
    } else {
      const d = await r.json().catch(() => ({}));
      showToast(d?.error || "删除失败", "error");
    }
  }

  return (
    <div
      className="card"
      style={{ margin: "16px 0 16px", display: "grid", gap: 8 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600 }}>作者操作</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="nav-link"
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ cursor: "pointer" }}
          >
            {open ? "收起" : "展开编辑"}
          </button>
          <button
            className="nav-link"
            type="button"
            onClick={removePost}
            style={{ cursor: "pointer" }}
          >
            删除文章
          </button>
        </div>
      </div>
      {open && (
        <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "var(--muted)" }}>标签</div>
            <div
              style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              {preset.map((t) => (
                <button
                  type="button"
                  key={t}
                  className="nav-link"
                  aria-pressed={tags.includes(t)}
                  onClick={() =>
                    setTags((prev) =>
                      prev.includes(t)
                        ? prev.filter((x) => x !== t)
                        : [...prev, t],
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  {tags.includes(t) ? "✓ " : ""}
                  {t}
                </button>
              ))}
              <button
                type="button"
                className="nav-link"
                onClick={() => {
                  const t = window.prompt("输入自定义标签");
                  if (!t) return;
                  const v = t.trim();
                  if (!v) return;
                  if (!tags.includes(v)) {
                    setTags((prev) => [...prev, v]);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                +自定义
              </button>
            </div>
          </div>
          <textarea
            placeholder="摘要"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "var(--muted)" }}>
              定时发布时间（可选）
            </span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "transparent",
                color: "var(--text)",
              }}
            />
          </label>

          <MarkdownToolbar
            targetRef={editorRef}
            value={content}
            onChange={setContent}
          />

          {/* 图片上传 */}
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>
              图片（最多 3 张，单张 ≤ 10MB）
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                const input = e.currentTarget;
                await handleImageFiles(input.files);
                input.value = "";
              }}
            />
            {!!images.length && (
              <div className="hint">
                已添加图片：{images.length}/3
              </div>
            )}
          </div>
          {!!images.length && (
            <div
              style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              {images.map((img) => (
                <div
                  key={img.url}
                  style={{
                    position: "relative",
                    display: "inline-block",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.name}
                    style={{
                      width: 88,
                      height: 88,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img)}
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(0,0,0,.6)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      lineHeight: "20px",
                      textAlign: "center",
                    }}
                    aria-label="移除图片"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 音频上传 */}
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>
              音频（最多 2 个，单个 ≤ 10MB）
            </div>
            <input
              type="file"
              accept="audio/*"
              onChange={async (e) => {
                const input = e.currentTarget;
                const f = input.files?.[0] || null;
                await handleAudioFile(f);
                input.value = "";
              }}
            />
            {!!audios.length && (
              <div className="hint">
                已添加音频：
                {audios.map((a) => (
                  <span key={a.url} style={{ marginRight: 8 }}>
                    {a.name}
                    <button
                      type="button"
                      onClick={() => removeAudio(a)}
                      style={{
                        marginLeft: 4,
                        border: "none",
                        background: "transparent",
                        color: "var(--muted)",
                        cursor: "pointer",
                      }}
                      aria-label="移除音频"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <textarea
            ref={editorRef}
            placeholder="正文（支持 Markdown / MDX）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="nav-link"
              type="button"
              onClick={saveDraft}
              disabled={saving}
              style={{ cursor: "pointer" }}
            >
              保存草稿
            </button>
            <button
              className="nav-link"
              type="button"
              onClick={publish}
              disabled={saving}
              style={{ cursor: "pointer" }}
            >
              发布
            </button>
            {msg && <span className="hint">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
