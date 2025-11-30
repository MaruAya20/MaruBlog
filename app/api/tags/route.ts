import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTagStyle } from "@/lib/tagStyle";

const PRESET_TAGS = [
  "编程",
  "音乐",
  "绘画",
  "科技",
  "生活",
  "闲谈",
  "其他",
];

// 公共标签列表：用于前台选择标签（仅返回未隐藏的标签名称）
export async function GET() {
  // 先从数据库读取标签定义
  let defs = await prisma.tagDef.findMany();

  // 如无标签定义，则用默认标签初始化一批，并写入默认颜色（保持与 discover 样式一致）
  if (!defs.length) {
    const created = [];
    for (const name of PRESET_TAGS) {
      const sty = getTagStyle(name);
      const row = await prisma.tagDef.create({
        data: {
          name,
          hidden: false,
          color: sty.color,
          bg: sty.bg,
          border: sty.border,
        },
      });
      created.push(row);
    }
    defs = created;
  } else {
    // 兼容旧数据：如果历史数据里没有记录颜色，在这里自动补齐默认颜色
    for (const t of defs) {
      if (!t.color && !t.bg && !t.border) {
        const sty = getTagStyle(t.name);
        await prisma.tagDef.update({
          where: { id: t.id },
          data: {
            color: sty.color,
            bg: sty.bg,
            border: sty.border,
          },
        });
      }
    }
    // 重新读取以获得最新颜色配置
    defs = await prisma.tagDef.findMany();
  }

  const visible = defs.filter((t) => !t.hidden);
  const styles: Record<
    string,
    { bg: string; color: string; border: string }
  > = {};
  for (const t of visible) {
    const sty = getTagStyle(t.name);
    styles[t.name] = {
      bg: t.bg || sty.bg,
      color: t.color || sty.color,
      border: t.border || sty.border,
    };
  }

  return NextResponse.json({
    tags: visible.map((t) => t.name),
    styles,
  });
}
