/* 第二批 JSON -> PostgreSQL 迁移脚本（uploads / 封禁 / 日志 / PV）
 *
 * 使用方式（在 web 目录）：
 *   node scripts/migrate-from-json-extra.js
 *
 * 注意：
 * - 假定第一批核心迁移（migrate-from-json-core.js）已经成功执行，并且 User/Post/TagDef 等表已有完整数据。
 * - 仍然不会修改 db.json，仅从中读取数据写入数据库。
 * - 每张表在发现已有数据时会跳过迁移，以避免重复插入。
 */

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function buildUserIdMap(jsonUsers) {
  // 从数据库中读取所有用户，尝试按 email / name / createdAt 匹配 JSON 用户
  const dbUsers = await prisma.user.findMany();
  const map = new Map(); // oldUserId -> newUserId

  const byEmail = new Map();
  for (const u of dbUsers) {
    if (u.email) {
      byEmail.set(u.email.toLowerCase(), u.id);
    }
  }

  // 为无 email 的用户建立辅助索引：role+name+createdAt
  const byComposite = new Map();
  for (const u of dbUsers) {
    const key = [
      u.role,
      u.name || "",
      u.createdAt.toISOString(),
    ].join("|");
    if (!byComposite.has(key)) {
      byComposite.set(key, []);
    }
    byComposite.get(key).push(u.id);
  }

  for (const ju of jsonUsers) {
    const oldId = ju.id;
    if (map.has(oldId)) continue;

    let newId = null;

    if (ju.email) {
      const emailKey = String(ju.email).toLowerCase();
      if (byEmail.has(emailKey)) {
        newId = byEmail.get(emailKey);
      }
    }

    if (!newId) {
      const role = ju.role || "GUEST";
      const createdAt = ju.createdAt
        ? new Date(ju.createdAt)
        : null;
      const createdIso = createdAt
        ? createdAt.toISOString()
        : null;
      const name = ju.name || "";
      if (createdIso) {
        const key = [role, name, createdIso].join("|");
        const list = byComposite.get(key) || [];
        if (list.length === 1) {
          newId = list[0];
        }
      }
    }

    if (!newId) {
      console.warn(
        "[用户映射] 无法为旧用户 ID",
        oldId,
        "找到对应数据库用户，将在迁移相关记录时跳过。",
      );
      continue;
    }
    map.set(oldId, newId);
  }

  return map;
}

async function buildPostSlugMap() {
  const posts = await prisma.post.findMany({
    select: { id: true, slug: true },
  });
  const map = new Map();
  for (const p of posts) {
    if (p.slug) map.set(p.slug, p.id);
  }
  return map;
}

async function main() {
  const dbPath = path.join(__dirname, "..", "data", "db.json");
  if (!fs.existsSync(dbPath)) {
    console.error("未找到 web/data/db.json，路径：", dbPath);
    process.exit(1);
  }

  console.log("读取 JSON 数据库：", dbPath);
  const raw = fs.readFileSync(dbPath, "utf-8");
  const data = JSON.parse(raw);

  const jsonUsers = Array.isArray(data.users) ? data.users : [];
  const jsonUploads = Array.isArray(data.uploads) ? data.uploads : [];
  const jsonCommentBans = Array.isArray(data.commentBans)
    ? data.commentBans
    : [];
  const jsonUserBans = Array.isArray(data.userBans)
    ? data.userBans
    : [];
  const jsonAdminLogs = Array.isArray(data.adminLogs)
    ? data.adminLogs
    : [];
  const jsonPageViews = Array.isArray(data.pageViews)
    ? data.pageViews
    : [];

  console.log("JSON 内容统计：");
  console.log("  users        :", jsonUsers.length);
  console.log("  uploads      :", jsonUploads.length);
  console.log("  commentBans  :", jsonCommentBans.length);
  console.log("  userBans     :", jsonUserBans.length);
  console.log("  adminLogs    :", jsonAdminLogs.length);
  console.log("  pageViews    :", jsonPageViews.length);

  // 先构建用户 ID 映射、文章 slug 映射
  console.log("构建用户 / 文章映射...");
  const userIdMap = await buildUserIdMap(jsonUsers);
  const slugToPostId = await buildPostSlugMap();

  // 1) 上传记录 Upload
  const uploadCount = await prisma.upload.count();
  if (uploadCount > 0) {
    console.log("Upload 表非空（", uploadCount, "条），跳过上传记录迁移。");
  } else if (jsonUploads.length) {
    console.log("开始迁移上传记录...");
    let migrated = 0;
    for (const u of jsonUploads) {
      let kind = "OTHER";
      if (u.kind === "avatar") kind = "AVATAR";
      else if (u.kind === "wallpaper") kind = "WALLPAPER";

      let status = "PENDING";
      if (u.status === "approved") status = "APPROVED";
      else if (u.status === "rejected") status = "REJECTED";

      const createdAt = u.createdAt
        ? new Date(u.createdAt)
        : new Date();

      const newUserId = u.userId ? userIdMap.get(u.userId) : null;

      if (u.userId && !newUserId) {
        console.warn(
          "[上传迁移] 找不到对应用户，仍然迁移为匿名上传，upload id=",
          u.id,
          " userId=",
          u.userId,
        );
      }

      try {
        await prisma.upload.create({
          data: {
            userId: newUserId || null,
            kind,
            filename: u.filename,
            url: u.url,
            status,
            createdAt,
            originalName: u.originalName || null,
            mime: u.mime || "",
            size: typeof u.size === "number" ? u.size : 0,
          },
        });
        migrated++;
      } catch (e) {
        console.error(
          "[上传迁移] 插入失败，url=",
          u.url,
          "错误：",
          e.message || e,
        );
      }
    }
    console.log("上传记录迁移完成，总数：", migrated);
  }

  // 2) 评论封禁 CommentBan
  const commentBanCount = await prisma.commentBan.count();
  if (commentBanCount > 0) {
    console.log(
      "CommentBan 表非空（",
      commentBanCount,
      "条），跳过评论封禁迁移。",
    );
  } else if (jsonCommentBans.length) {
    console.log("开始迁移评论封禁记录...");
    let migrated = 0;
    for (const b of jsonCommentBans) {
      const newUserId = b.userId ? userIdMap.get(b.userId) : null;
      const until = new Date(b.until);
      const createdAt = b.createdAt ? new Date(b.createdAt) : new Date();

      await prisma.commentBan.create({
        data: {
          userId: newUserId || null,
          ip: b.ip || null,
          until,
          reason: b.reason || null,
          createdAt,
        },
      });
      migrated++;
    }
    console.log("评论封禁迁移完成，总数：", migrated);
  }

  // 3) 用户封禁 UserBan
  const userBanCount = await prisma.userBan.count();
  if (userBanCount > 0) {
    console.log(
      "UserBan 表非空（",
      userBanCount,
      "条），跳过用户封禁迁移。",
    );
  } else if (jsonUserBans.length) {
    console.log("开始迁移用户封禁记录...");
    let migrated = 0;
    for (const b of jsonUserBans) {
      const newUserId = userIdMap.get(b.userId);
      if (!newUserId) {
        console.warn(
          "[用户封禁迁移] 找不到对应用户，跳过 userId=",
          b.userId,
        );
        continue;
      }
      const until = new Date(b.until);
      const createdAt = b.createdAt ? new Date(b.createdAt) : new Date();
      const permanent = !!b.permanent;

      await prisma.userBan.create({
        data: {
          userId: newUserId,
          until,
          reason: b.reason || null,
          createdAt,
          permanent,
        },
      });
      migrated++;
    }
    console.log("用户封禁迁移完成，总数：", migrated);
  }

  // 4) 管理日志 AdminLog
  const adminLogCount = await prisma.adminLog.count();
  if (adminLogCount > 0) {
    console.log(
      "AdminLog 表非空（",
      adminLogCount,
      "条），跳过管理日志迁移。",
    );
  } else if (jsonAdminLogs.length) {
    console.log("开始迁移管理日志...");
    let migrated = 0;
    for (const log of jsonAdminLogs) {
      const newAdminId = userIdMap.get(log.adminId);
      if (!newAdminId) {
        console.warn(
          "[管理日志迁移] 找不到管理员用户，跳过 adminId=",
          log.adminId,
        );
        continue;
      }
      const createdAt = log.createdAt
        ? new Date(log.createdAt)
        : new Date();
      await prisma.adminLog.create({
        data: {
          adminId: newAdminId,
          action: String(log.action || ""),
          targetType: log.targetType || null,
          targetId:
            log.targetId !== undefined && log.targetId !== null
              ? String(log.targetId)
              : null,
          detail: log.detail || null,
          createdAt,
          ip: log.ip || null,
          ua: log.ua || null,
        },
      });
      migrated++;
    }
    console.log("管理日志迁移完成，总数：", migrated);
  }

  // 5) PV 统计 PageView
  const pageViewCount = await prisma.pageView.count();
  if (pageViewCount > 0) {
    console.log(
      "PageView 表非空（",
      pageViewCount,
      "条），跳过 PV 迁移。",
    );
  } else if (jsonPageViews.length) {
    console.log("开始迁移页面访问记录 PageView...");
    let migrated = 0;
    for (const v of jsonPageViews) {
      const route = String(v.route || "").trim() || "/";
      const slug = v.slug ? String(v.slug).trim() : null;
      const at = v.at ? new Date(v.at) : new Date();

      const newUserId = v.userId ? userIdMap.get(v.userId) : null;
      let postId = null;
      if (slug && slugToPostId.has(slug)) {
        postId = slugToPostId.get(slug);
      }

      await prisma.pageView.create({
        data: {
          route,
          slug,
          at,
          userId: newUserId || null,
          postId,
          ip: v.ip || null,
        },
      });
      migrated++;
    }
    console.log("页面访问记录迁移完成，总数：", migrated);
  }

  console.log("第二批数据迁移完成。");
}

main()
  .catch((e) => {
    console.error("迁移过程中发生错误：", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

