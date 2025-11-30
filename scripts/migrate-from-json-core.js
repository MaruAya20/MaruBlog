/* 第一批 JSON -> PostgreSQL 迁移脚本（核心内容：用户/偏好/文章/评论/点赞/收藏/标签）
 *
 * 使用方式（在 web 目录）：
 *   node scripts/migrate-from-json-core.js
 *
 * 注意：
 * - 当前应用仍然使用 db.json 作为真实数据源，本脚本只是把现有数据复制一份到数据库中，方便后续切换。
 * - 建议在运行前备份 web/data/db.json。
 * - 脚本会在目标表非空时跳过该表的迁移，避免重复插入。
 */

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
  const jsonPrefs = Array.isArray(data.prefs) ? data.prefs : [];
  const jsonPosts = Array.isArray(data.posts) ? data.posts : [];
  const jsonComments = Array.isArray(data.comments) ? data.comments : [];
  const jsonLikes = Array.isArray(data.likes) ? data.likes : [];
  const jsonFavorites = Array.isArray(data.favorites) ? data.favorites : [];
  const jsonTagDefs = Array.isArray(data.tagDefs) ? data.tagDefs : [];
  const jsonSettings = data.settings || null;

  console.log("JSON 内容统计：");
  console.log("  users      :", jsonUsers.length);
  console.log("  prefs      :", jsonPrefs.length);
  console.log("  posts      :", jsonPosts.length);
  console.log("  comments   :", jsonComments.length);
  console.log("  likes      :", jsonLikes.length);
  console.log("  favorites  :", jsonFavorites.length);
  console.log("  tagDefs    :", jsonTagDefs.length);
  console.log("  settings   :", jsonSettings ? "1" : "0");

  // 为了保持关系，需要建立旧 ID -> 新 ID 的映射
  const userIdMap = new Map(); // oldUserId -> newUserId
  const slugToPostId = new Map(); // slug -> newPostId

  // 1) 用户
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("User 表非空（", userCount, "条），跳过用户迁移。");
  } else {
    console.log("开始迁移用户...");
    const seenEmails = new Set(); // 防止 email 唯一冲突
    for (const u of jsonUsers) {
      let email = u.email ? String(u.email).trim() : null;
      if (email) {
        const key = email.toLowerCase();
        if (seenEmails.has(key)) {
          console.warn(
            "[用户迁移] 发现重复邮箱，设置为 null 以避免冲突：",
            email,
            "(旧用户 ID:",
            u.id,
            ")",
          );
          email = null;
        } else {
          seenEmails.add(key);
        }
      }

      const stats = u.stats || {};
      const createdAt = u.createdAt ? new Date(u.createdAt) : new Date();

      const created = await prisma.user.create({
        data: {
          email: email,
          name: u.name || null,
          role: (u.role || "GUEST").toUpperCase(),
          createdAt,
          avatar: u.avatar || null,
          signature: u.signature || null,
          xp: typeof u.xp === "number" ? u.xp : 0,
          statsDate: stats.date || null,
          postsToday:
            typeof stats.postsToday === "number" ? stats.postsToday : 0,
          xpToday: typeof stats.xpToday === "number" ? stats.xpToday : 0,
          lastCommentAt: stats.lastCommentAt
            ? new Date(stats.lastCommentAt)
            : null,
        },
      });

      userIdMap.set(u.id, created.id);

      // likedAward 数组迁移到 UserLikedAward
      const likedAward = Array.isArray(u.likedAward) ? u.likedAward : [];
      for (const title of likedAward) {
        const t = String(title || "").trim();
        if (!t) continue;
        await prisma.userLikedAward.create({
          data: {
            userId: created.id,
            title: t,
          },
        });
      }
    }
    console.log("用户迁移完成，总数：", jsonUsers.length);
  }

  // 2) 用户偏好
  const prefCount = await prisma.userPreference.count();
  if (prefCount > 0) {
    console.log("UserPreference 表非空（", prefCount, "条），跳过偏好迁移。");
  } else if (jsonPrefs.length) {
    console.log("开始迁移用户偏好...");
    for (const p of jsonPrefs) {
      const newUserId = userIdMap.get(p.userId);
      if (!newUserId) {
        console.warn(
          "[偏好迁移] 找不到对应用户，跳过 userId=",
          p.userId,
        );
        continue;
      }
      await prisma.userPreference.create({
        data: {
          userId: newUserId,
          wallpaper: p.wallpaper || null,
          opacity:
            typeof p.opacity === "number" ? p.opacity : null,
          theme: p.theme || null,
          fontSize: p.fontSize || null,
        },
      });
    }
    console.log("用户偏好迁移完成，总数：", jsonPrefs.length);
  }

  // 3) 标签定义
  const tagCount = await prisma.tagDef.count();
  if (tagCount > 0) {
    console.log("TagDef 表非空（", tagCount, "条），跳过标签迁移。");
  } else if (jsonTagDefs.length) {
    console.log("开始迁移标签定义...");
    for (const t of jsonTagDefs) {
      await prisma.tagDef.create({
        data: {
          name: t.name,
          color: t.color || null,
          bg: t.bg || null,
          border: t.border || null,
          hidden: !!t.hidden,
        },
      });
    }
    console.log("标签定义迁移完成，总数：", jsonTagDefs.length);
  }

  // 4) 文章
  const postCount = await prisma.post.count();
  if (postCount > 0) {
    console.log("Post 表非空（", postCount, "条），跳过文章迁移。");
  } else if (jsonPosts.length) {
    console.log("开始迁移文章...");
    for (const p of jsonPosts) {
      const newAuthorId = userIdMap.get(p.authorId);
      if (!newAuthorId) {
        console.warn(
          "[文章迁移] 找不到作者，跳过文章 slug=",
          p.slug,
          " authorId=",
          p.authorId,
        );
        continue;
      }
      const publishedAt = p.publishedAt
        ? new Date(p.publishedAt)
        : new Date();
      const scheduledAt =
        p.scheduledAt ? new Date(p.scheduledAt) : null;
      const tags = Array.isArray(p.tags) ? p.tags : [];

      const created = await prisma.post.create({
        data: {
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt || null,
          content: p.content || "",
          tags,
          publishedAt,
          status: p.status || "published",
          scheduledAt,
          authorId: newAuthorId,
        },
      });

      slugToPostId.set(p.slug, created.id);
    }
    console.log("文章迁移完成，总数：", jsonPosts.length);
  }

  // 5) 评论
  const commentCount = await prisma.comment.count();
  if (commentCount > 0) {
    console.log("Comment 表非空（", commentCount, "条），跳过评论迁移。");
  } else if (jsonComments.length) {
    console.log("开始迁移评论...");
    let migrated = 0;
    for (const c of jsonComments) {
      const postId = slugToPostId.get(c.postSlug);
      if (!postId) {
        console.warn(
          "[评论迁移] 找不到对应文章，跳过 comment id=",
          c.id,
          " postSlug=",
          c.postSlug,
        );
        continue;
      }
      const newUserId = c.userId ? userIdMap.get(c.userId) : null;
      const createdAt = c.createdAt
        ? new Date(c.createdAt)
        : new Date();
      await prisma.comment.create({
        data: {
          content: c.content || "",
          createdAt,
          postId,
          userId: newUserId || null,
          guestName: c.guestName || null,
        },
      });
      migrated++;
    }
    console.log("评论迁移完成，总数：", migrated);
  }

  // 6) 点赞
  const likeCount = await prisma.like.count();
  if (likeCount > 0) {
    console.log("Like 表非空（", likeCount, "条），跳过点赞迁移。");
  } else if (jsonLikes.length) {
    console.log("开始迁移点赞...");
    let migrated = 0;
    for (const l of jsonLikes) {
      const postId = slugToPostId.get(l.postSlug);
      const newUserId = userIdMap.get(l.userId);
      if (!postId || !newUserId) {
        console.warn(
          "[点赞迁移] 找不到对应文章或用户，跳过 like id=",
          l.id,
          " postSlug=",
          l.postSlug,
          " userId=",
          l.userId,
        );
        continue;
      }
      const createdAt = l.createdAt
        ? new Date(l.createdAt)
        : new Date();
      await prisma.like.create({
        data: {
          postId,
          userId: newUserId,
          createdAt,
        },
      });
      migrated++;
    }
    console.log("点赞迁移完成，总数：", migrated);
  }

  // 7) 收藏
  const favCount = await prisma.favorite.count();
  if (favCount > 0) {
    console.log("Favorite 表非空（", favCount, "条），跳过收藏迁移。");
  } else if (jsonFavorites.length) {
    console.log("开始迁移收藏...");
    let migrated = 0;
    for (const f of jsonFavorites) {
      const postId = slugToPostId.get(f.postSlug);
      const newUserId = userIdMap.get(f.userId);
      if (!postId || !newUserId) {
        console.warn(
          "[收藏迁移] 找不到对应文章或用户，跳过 favorite id=",
          f.id,
          " postSlug=",
          f.postSlug,
          " userId=",
          f.userId,
        );
        continue;
      }
      const createdAt = f.createdAt
        ? new Date(f.createdAt)
        : new Date();
      await prisma.favorite.create({
        data: {
          postId,
          userId: newUserId,
          createdAt,
        },
      });
      migrated++;
    }
    console.log("收藏迁移完成，总数：", migrated);
  }

  // 8) 站点设置（如存在）
  const settingsRow = await prisma.siteSettings.findFirst();
  if (settingsRow) {
    console.log("SiteSettings 已存在，跳过站点设置迁移。");
  } else if (jsonSettings) {
    console.log("开始迁移站点设置...");
    await prisma.siteSettings.create({
      data: {
        id: 1,
        title: jsonSettings.title || "MaruBlog",
        subtitle: jsonSettings.subtitle || null,
        seoDescription: jsonSettings.seoDescription || null,
        announcement: jsonSettings.announcement || null,
        allowGuestComment:
          typeof jsonSettings.allowGuestComment === "boolean"
            ? jsonSettings.allowGuestComment
            : true,
        allowRegistration:
          typeof jsonSettings.allowRegistration === "boolean"
            ? jsonSettings.allowRegistration
            : true,
      },
    });
    console.log("站点设置迁移完成。");
  }

  console.log("第一批核心数据迁移完成。");
}

main()
  .catch((e) => {
    console.error("迁移过程中发生错误：", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

