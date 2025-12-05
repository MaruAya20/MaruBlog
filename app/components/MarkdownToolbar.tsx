"use client";
import React from "react";

type Props = {
  targetRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
};

export default function MarkdownToolbar({
  targetRef,
  value,
  onChange,
}: Props) {
  const insert = (before: string, after = "") => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const next =
      value.slice(0, start) +
      before +
      selected +
      after +
      value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    }, 0);
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button
        className="nav-link"
        type="button"
        onClick={() => insert("**", "**")}
        style={{ cursor: "pointer" }}
      >
        加粗
      </button>
      <button
        className="nav-link"
        type="button"
        onClick={() => insert("_", "_")}
        style={{ cursor: "pointer" }}
      >
        斜体
      </button>
      <button
        className="nav-link"
        type="button"
        onClick={() => insert("`", "`")}
        style={{ cursor: "pointer" }}
      >
        行内代码
      </button>
      <button
        className="nav-link"
        type="button"
        onClick={() => insert("\n```\n", "\n```\n")}
        style={{ cursor: "pointer" }}
      >
        代码块
      </button>
      <button
        className="nav-link"
        type="button"
        onClick={() => insert("# ")}
        style={{ cursor: "pointer" }}
      >
        标题
      </button>
      <button
        className="nav-link"
        type="button"
        onClick={() => insert("- ")}
        style={{ cursor: "pointer" }}
      >
        列表
      </button>
      <button
        className="nav-link"
        type="button"
        onClick={() => insert("[文本](链接)")}
        style={{ cursor: "pointer" }}
      >
        链接
      </button>
      <button
        className="nav-link"
        type="button"
        onClick={() =>
          insert("![alt](https://example.com/image.jpg)")
        }
        style={{ cursor: "pointer" }}
      >
        图片
      </button>
    </div>
  );
}

