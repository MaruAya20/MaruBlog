import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name } = (await req.json().catch(() => ({}))) as {
    name?: string;
  };

  const base =
    typeof name === "string" && name.trim()
      ? name.trim()
      : `访客${Math.floor(Math.random() * 10000)}`;

  const u = await prisma.user.create({
    data: {
      name: base,
      role: "GUEST",
    },
  });

  await setSession({
    uid: u.id,
    role: "GUEST",
    name: u.name ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: u.id,
      name: u.name ?? undefined,
      role: u.role,
    },
  });
}

