import { NextResponse } from 'next/server'

const LEVEL_NAMES = ['新丸','小小丸','小丸','中丸','大丸','大大丸','超大丸','巨丸','饭钢丸','射命丸'] as const
const LEVEL_COLORS: string[] = [
  '#4caf50', // 新丸 绿
  '#2196f3', // 小小丸 蓝
  '#ff9800', // 小丸 橙
  '#9c27b0', // 中丸 紫
  '#00bcd4', // 大丸 青
  '#ff5722', // 大大丸 深橙
  '#8bc34a', // 超大丸 浅绿
  '#3f51b5', // 巨丸 靛蓝
  '#245a88', // 饭钢丸 指定
  '#ef4045', // 射命丸 指定
]

function thresholdFor(level: number){
  // 二次曲线映射到 1,000,000，总经验越高等级越高
  const L = Math.max(1, Math.min(10, level))
  return Math.round(1_000_000 * Math.pow(L/10, 2))
}

export async function GET(){
  const list = [] as { level: number; name: string; color: string; minXp: number; maxXp: number }[]
  for(let L=1; L<=10; L++){
    const min = L===1 ? 0 : thresholdFor(L)
    const max = L===10 ? 1_000_000 : thresholdFor(L+1)-1
    list.push({ level: L, name: LEVEL_NAMES[L-1], color: LEVEL_COLORS[L-1], minXp: min, maxXp: max })
  }
  // 管理员特殊徽章
  const admin = { name: '姬海棠', color: '#a72aabff', level: 0 }
  return NextResponse.json({ total: 1_000_000, levels: list, admin })
}

