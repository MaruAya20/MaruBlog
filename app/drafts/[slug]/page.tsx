"use client";
import Container from "../../components/Container";
import { useEffect, useRef, useState } from "react";
import MarkdownToolbar from "../../components/MarkdownToolbar";
import { useToast } from "../../components/ToastProvider";

type ImageItem = { url: string; name: string; snippet: string };
type AudioItem = { url: string; name: string; snippet: string };

function toLocalDateTimeInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function EditDraft({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [me, setMe] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [preset, setPreset] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user || null))
      .catch(() => {});
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setPreset(d.tags || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const { slug: raw } = await params;
      const slug = decodeURIComponent(raw);
      const d = await fetch(`/api/posts/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .catch(() => ({}));
      if (!d?.post) {
        setMsg("未找到文章");
        return;
      }
      const p = d.post;
      setPost(p);
      setTitle(p.title || "");
      setContent(p.content || "");
      setExcerpt(p.excerpt || "");
      setTags(p.tags || []);
      // 将 ISO 时间转换为 datetime-local 可用的本地字符串
      setScheduledAt(toLocalDateTimeInputValue(p.scheduledAt));

      // 解析正文中已有的图片与音频，填充卡片列表
      const c = String(p.content || "");

      // 图片：匹配 ![...] (url)
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
    })().catch(() => {});
  }, [params]);

  if (!post) return null;

  async function saveDraft() {
    setMsg("保存中...");
    const r = await fetch(`/api/posts/${encodeURIComponent(post.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        excerpt,
        tags,
        status: "draft",
        scheduledAt: scheduledAt || undefined,
      }),
    });
    setMsg(r.ok ? "已保存" : "保存失败");
  }

  async function schedule() {
    if (!(scheduledAt || "").trim()) {
      setMsg("请选择定时发布时间");
      return;
    }
    setMsg("正在设置定时发布...");
    const t = Date.parse(String(scheduledAt));
    if (!Number.isFinite(t) || t <= Date.now()) {
      setMsg("定时发布时间必须在当前时间之后");
      return;
    }
    const body = {
      title,
      content,
      excerpt,
      tags,
      status: "draft",
      scheduledAt: new Date(t).toISOString(),
    };
    const r = await fetch(`/api/posts/${encodeURIComponent(post.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg(r.ok ? "已设置定时发布" : "定时发布失败");
  }

  async function publish() {
    setMsg("发布中...");
    const r = await fetch(`/api/posts/${encodeURIComponent(post.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        excerpt,
        tags,
        status: "published",
        scheduledAt: undefined,
      }),
    });
    if (r.ok) {
      location.href = `/post/${encodeURIComponent(post.slug)}`;
    } else {
      setMsg("发布失败");
    }
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
      
      // 修改音频卡片格式，使用新的全局播放器逻辑
      const snippet = `\n<div className="audio-card" data-audio="${url}" style="margin:16px 0;padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--card-bg);display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="triggerGlobalPlay('${url}', '${safeName}')">\n  <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:linear-gradient(45deg, #667eea 0%, #764ba2 100%);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;">♪</div>\n  <div style="flex:1;min-width:0;">\n    <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeName}</div>\n  </div>\n  <button type="button" style="width:32px;height:32px;border:none;border-radius:50%;background:var(--brand);color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;">▶</button>\n</div>\n<script>\nfunction triggerGlobalPlay(url, name) {\n  // 创建临时元素用于动画\n  const clickedEl = event.currentTarget;\n  const rect = clickedEl.getBoundingClientRect();\n  \n  const tempImg = document.createElement('div');\n  tempImg.innerHTML = '♪';\n  tempImg.style.position = 'fixed';\n  tempImg.style.zIndex = '9999';\n  tempImg.style.fontSize = '24px';\n  tempImg.style.width = '40px';\n  tempImg.style.height = '40px';\n  tempImg.style.display = 'flex';\n  tempImg.style.alignItems = 'center';\n  tempImg.style.justifyContent = 'center';\n  tempImg.style.background = 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)';\n  tempImg.style.borderRadius = '8px';\n  tempImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';\n  tempImg.style.left = rect.left + 'px';\n  tempImg.style.top = rect.top + 'px';\n  tempImg.style.color = 'white';\n  \n  document.body.appendChild(tempImg);\n  \n  // 获取目标位置（全局播放器位置）\n  const musicPlayer = document.querySelector('.music-player');\n  if (musicPlayer) {\n    const targetRect = musicPlayer.getBoundingClientRect();\n    \n    tempImg.animate([\n      { \n        transform: \`translate(0, 0) scale(1)\`,\n        opacity: 1\n      },\n      { \n        transform: \`translate(\${targetRect.left - rect.left}px, \${targetRect.top - rect.top}px) scale(0.3)\`,\n        opacity: 0.5\n      },\n      { \n        transform: \`translate(\${targetRect.left - rect.left}px, \${targetRect.top - rect.top}px) scale(0)\`,\n        opacity: 0\n      }\n    ], {\n      duration: 600,\n      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'\n    }).onfinish = () => {\n      document.body.removeChild(tempImg);\n      // 动画完成后播放音乐\n      window.dispatchEvent(new CustomEvent('playMusic', {\n        detail: { url, title: name, artist: '文章音频', cover: null }\n      }));\n    };\n  } else {\n    // 如果找不到播放器，直接播放音乐\n    setTimeout(() => {\n      document.body.removeChild(tempImg);\n      window.dispatchEvent(new CustomEvent('playMusic', {\n        detail: { url, title: name, artist: '文章音频', cover: null }\n      }));\n    }, 300);\n  }\n}\n</script>`;
      
      setContent((prev) => prev + snippet);
      setAudios((prev) =>
        prev.length >= 2 ? prev : [...prev, { url, name: file.name, snippet }],
      );
    } catch {
      showToast("上传失败", "error");
    }
  }

  function removeImage(item: ImageItem) {
    setImages((prev) => prev.filter((x) => x.url !== item.url));
    setContent((prev) => prev.replaceAll(item.snippet, ""));
  }

  function removeAudio(item: AudioItem) {
    setAudios((prev) => prev.filter((x) => x.url !== item.url));
    setContent((prev) => prev.replaceAll(item.snippet, ""));
  }

  return (
    <Container>
      <section className="section" style={{ display: "grid", gap: 12 }}>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>编辑草稿</div>
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                  {tags.includes(t) ? "✔" : ""}
                  {t}
                </button>
              ))}
              <button
                type="button"
                className="nav-link"
                onClick={() => {
                  const v = window.prompt("输入新的标签名：")?.trim();
                  if (!v) return;
                  setPreset((prev) =>
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
                if (audios.length >= 2) {
                  showToast("最多只能添加 2 个音频", "info");
                  input.value = "";
                  return;
                }
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
            rows={12}
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
              style={{ cursor: "pointer" }}
            >
              保存草稿
            </button>
            <button
              className="nav-link"
              type="button"
              onClick={schedule}
              style={{ cursor: "pointer" }}
            >
              定时发布
            </button>
            <button
              className="nav-link"
              type="button"
              onClick={publish}
              style={{ cursor: "pointer" }}
            >
              发布
            </button>
            {msg && <span className="hint">{msg}</span>}
          </div>
        </div>
      </section>
    </Container>
  );
}
