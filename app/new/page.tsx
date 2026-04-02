"use client";

import Container from "../components/Container";
import { useEffect, useRef, useState } from "react";
import MarkdownToolbar from "../components/MarkdownToolbar";
import { useToast } from "../components/ToastProvider";
import { playMusic } from '../post/[slug]/Actions';

type ImageItem = { url: string; name: string; snippet: string };
type AudioItem = { url: string; name: string; snippet: string };

export default function NewPost() {
  const [me, setMe] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [preset, setPreset] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [excerpt, setExcerpt] = useState("");
  const [msg, setMsg] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const { showToast } = useToast();
  // 是否需要保留本次会话中的上传（例如已经暂存，或已成功保存为草稿）
  const keepUploadsRef = useRef(false);

  const getTempKey = (userId?: number) =>
    `marublog:new-temp:${userId ?? "guest"}`;

  // 初始化当前用户与预设标签
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch(() => {});
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setPreset(d.tags || []))
      .catch(() => {});
  }, []);

  // 读取本地暂存内容（每个用户一个暂存位）
  useEffect(() => {
    if (!me) return;
    try {
      const raw = localStorage.getItem(getTempKey(me.id));
      if (!raw) return;
      const data = JSON.parse(raw) as any;
      if (data.title) setTitle(String(data.title));
      if (data.content) setContent(String(data.content));
      if (Array.isArray(data.tags)) setTags(data.tags as string[]);
      if (data.excerpt) setExcerpt(String(data.excerpt));
      if (typeof data.scheduledAt === "string")
        setScheduledAt(data.scheduledAt);
      if (Array.isArray(data.images))
        setImages(data.images as ImageItem[]);
      if (Array.isArray(data.audios))
        setAudios(data.audios as AudioItem[]);
      keepUploadsRef.current = true;
      // 防止在开发模式下 React 严格模式导致重复提示：全局标记只提示一次
      if (typeof window !== "undefined") {
        const g = window as any;
        if (!g.__marublogNewRestored) {
          g.__marublogNewRestored = true;
          showToast("已恢复上次未完成的文章", "info");
        }
      }
    } catch {
      // 忽略暂存解析错误
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // 离开新建页面时，清理本次会话中未使用的上传资源（仅在未暂存 / 未发布的情况下）
  useEffect(() => {
    return () => {
      if (keepUploadsRef.current) return;
      const urls = [
        ...images.map((i) => i.url),
        ...audios.map((a) => a.url),
      ];
      if (!urls.length) return;
      try {
        const payload = JSON.stringify({ urls });
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          const blob = new Blob([payload], {
            type: "application/json",
          });
          navigator.sendBeacon("/api/upload/cleanup", blob);
        } else {
          // 退路：使用 keepalive fetch，尽量在关闭前发出请求
          fetch("/api/upload/cleanup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            keepalive: true as any,
            body: payload,
          }).catch(() => {});
        }
      } catch {
        showToast("清理未使用资源失败", "error");
      }
    };
  }, []);

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
      
      // 创建简化的音频卡片HTML，但实际存储到Markdown中的只是一个引用
      const snippet = `\n[audio:${safeName}](${url})\n`;
      
      setContent((prev) => prev + snippet);
      setAudios((prev) =>
        prev.length >= 2 ? prev : [...prev, { url, name: file.name, snippet }],
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

  function clearTemp() {
    if (!me) return;
    try {
      localStorage.removeItem(getTempKey(me.id));
    } catch {
      // ignore
    }
  }

  function saveTemp() {
    if (!me) return;
    if (
      !title &&
      !content &&
      !excerpt &&
      !tags.length &&
      !images.length &&
      !audios.length &&
      !scheduledAt
    ) {
      // 没有内容就不写入暂存
      return;
    }
    try {
      const key = getTempKey(me.id);
      const payload = {
        title,
        content,
        tags,
        excerpt,
        scheduledAt,
        images,
        audios,
      };
      localStorage.setItem(key, JSON.stringify(payload));
      // 一旦写入暂存，就视为需要保留本次上传
      keepUploadsRef.current = true;
    } catch {
      // 静默失败即可，避免打扰用户
    }
  }

  // 自动暂存：表单内容发生变化时后台静默写入本地暂存（每用户一份）
  useEffect(() => {
    if (!me) return;
    saveTemp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    me,
    title,
    content,
    excerpt,
    scheduledAt,
    tags,
    images,
    audios,
  ]);

  // 根据当前已选标签推导出自定义标签列表，用于在标签行尾部显示并提供删除按钮
  useEffect(() => {
    const presetSet = new Set(preset);
    const custom: string[] = [];
    for (const t of tags) {
      const name = (t || "").trim();
      if (!name) continue;
      if (!presetSet.has(name)) custom.push(name);
    }
    setCustomTags(custom);
  }, [preset, tags]);

  async function submit() {
    if (!me) {
      showToast("请先登录", "info");
      return;
    }
    if (!title.trim()) {
      showToast("请输入标题", "error");
      return;
    }
    if (!content.trim()) {
      showToast("请输入正文", "error");
      return;
    }

    setMsg("发布中...");
    const r = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        excerpt,
        tags,
        authorId: me.id,  // 添加作者ID
        status: "published",
        scheduledAt: scheduledAt || undefined,
      }),
    });
    if (r.ok) {
      clearTemp();
      location.href = "/";
    } else {
      const d = await r.json();
      setMsg(d.error || "发布失败");
    }
  }

  async function saveDraft() {
    if (!title.trim() && !content.trim()) {
      showToast("标题和正文不能同时为空", "error");
      return;
    }

    setMsg("保存中...");
    const r = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        excerpt,
        tags,
        authorId: me?.id,  // 添加作者ID
        status: "draft",
        scheduledAt: scheduledAt || undefined,
      }),
    });
    if (r.ok) {
      showToast("已保存草稿", "success");
    } else {
      const d = await r.json();
      setMsg(d.error || "保存失败");
    }
  }

  async function scheduleDraft() {
    if (!title.trim() && !content.trim()) {
      showToast("标题和正文不能同时为空", "error");
      return;
    }
    if (!(scheduledAt || "").trim()) {
      showToast("请选择定时发布时间", "error");
      return;
    }
    const t = Date.parse(String(scheduledAt));
    if (!Number.isFinite(t) || t <= Date.now()) {
      showToast("定时发布时间必须在当前时间之后", "error");
      return;
    }

    setMsg("设置定时发布中...");
    const body = {
      title,
      content,
      excerpt,
      tags,
      authorId: me?.id,  // 添加作者ID
      status: "draft",
      scheduledAt: new Date(t).toISOString(),
    };
    const r = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      showToast("已设置定时发布", "success");
    } else {
      const d = await r.json();
      setMsg(d.error || "设置失败");
    }
  }

  // 在发布或保存草稿后，清理暂存的上传资源
  useEffect(() => {
    if (title && content) {
      keepUploadsRef.current = true;
      try {
        const data = JSON.stringify({
          title,
          content,
          tags,
          excerpt,
          scheduledAt,
          images,
          audios,
        });
        localStorage.setItem(getTempKey(me?.id), data);
      } catch {
        // ignore persist errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    content,
    tags,
    excerpt,
    scheduledAt,
    JSON.stringify(images),
    JSON.stringify(audios),
  ]);

  return (
    <Container>
      <section className="section" style={{ display: "grid", gap: 12 }}>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>新建文章</div>
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

          {/* 标签选择 + 自定义标签 */}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "var(--muted)" }}>标签</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {/* 预设标签 */}
              {preset.map((t) => {
                const selected = tags.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    className="nav-link"
                    aria-pressed={selected}
                    onClick={() =>
                      setTags((prev) =>
                        prev.includes(t)
                          ? prev.filter((x) => x !== t)
                          : [...prev, t],
                      )
                    }
                    style={{ cursor: "pointer" }}
                  >
                    {selected ? "✓ " : ""}
                    {t}
                  </button>
                );
              })}

              {/* 自定义标签，追加在尾部，每个内部带一个叉号 */}
              {customTags.map((t) => {
                const selected = tags.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    className="nav-link"
                    aria-pressed={selected}
                    onClick={() =>
                      setTags((prev) =>
                        prev.includes(t)
                          ? prev.filter((x) => x !== t)
                          : [...prev, t],
                      )
                    }
                    style={{
                      cursor: "pointer",
                      position: "relative",
                      paddingRight: 22,
                    }}
                  >
                    {selected ? "✓ " : ""}
                    {t}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setCustomTags((prev) =>
                          prev.filter((x) => x !== t),
                        );
                        setTags((prev) =>
                          prev.filter((x) => x !== t),
                        );
                      }}
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 4,
                        cursor: "pointer",
                      }}
                      aria-label="移除自定义标签"
                    >
                      ×
                    </span>
                  </button>
                );
              })}

              {/* 新建自定义标签按钮 */}
              <button
                type="button"
                className="nav-link"
                onClick={() => {
                  const t = prompt("输入自定义标签");
                  if (!t) return;
                  const v = t.trim();
                  if (!v) return;
                  // 如果与预设标签重名，直接当预设标签使用
                  if (preset.includes(v)) {
                    setTags((prev) =>
                      prev.includes(v) ? prev : [...prev, v],
                    );
                    return;
                  }
                  setCustomTags((prev) =>
                    prev.includes(v) ? prev : [...prev, v],
                  );
                  setTags((prev) =>
                    prev.includes(v) ? prev : [...prev, v],
                  );
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
              <div className="hint">已添加图片：{images.length}/3</div>
            )}
          </div>

          {!!images.length && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {images.map((img) => (
                <div
                  key={img.url}
                  style={{ position: "relative", display: "inline-block" }}
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
            placeholder="正文（支持 Markdown/MDX）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
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
              onClick={submit}
              style={{ cursor: "pointer" }}
            >
              发布
            </button>
            <button
              className="nav-link"
              type="button"
              onClick={saveDraft}
              style={{ cursor: "pointer" }}
            >
              保存草稿
            </button>
            <button
              className="nav-link"
              type="button"
              onClick={scheduleDraft}
              style={{ cursor: "pointer" }}
            >
              定时发布
            </button>
            <button
              className="nav-link"
              type="button"
              onClick={async () => {
                const ok = window.confirm(
                  "确定要清空当前新建文章以及暂存内容吗？此操作不可恢复。",
                );
                if (!ok) return;
                const urls = [
                  ...images.map((i) => i.url),
                  ...audios.map((a) => a.url),
                ];
                setTitle("");
                setContent("");
                setExcerpt("");
                setTags([]);
                setScheduledAt("");
                setImages([]);
                setAudios([]);
                clearTemp();
                keepUploadsRef.current = false;
                if (urls.length) {
                  try {
                    await fetch("/api/upload/cleanup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ urls }),
                    });
                  } catch {
                    // ignore
                  }
                }
                showToast("已清空当前新建文章", "success");
              }}
              style={{ cursor: "pointer" }}
            >
              清空
            </button>
            {msg && <span className="hint">{msg}</span>}
          </div>
        </div>
      </section>
    </Container>
  );
}