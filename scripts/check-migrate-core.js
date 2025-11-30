/* 对比 db.json 与 PostgreSQL，检查第一批核心数据迁移是否正确。
 *
 * 使用方式（在 web 目录）：
 *   node scripts/check-migrate-core.js
 *
 * 输出：
 *  - JSON 与数据库中的计数对比
 *  - 检查每个文章 slug 是否都在数据库中存在
 *  - 检查每个标签名称是否都在数据库中存在
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

  console.log("JSON 计数：");
  console.log("  users      :", jsonUsers.length);
  console.log("  prefs      :", jsonPrefs.length);
  console.log("  posts      :", jsonPosts.length);
  console.log("  comments   :", jsonComments.length);
  console.log("  likes      :", jsonLikes.length);
  console.log("  favorites  :", jsonFavorites.length);
  console.log("  tagDefs    :", jsonTagDefs.length);
  console.log("  settings   :", jsonSettings ? 1 : 0);

  const dbUsers = await prisma.user.count();
  const dbPrefs = await prisma.userPreference.count();
  const dbPosts = await prisma.post.count();
  const dbComments = await prisma.comment.count();
  const dbLikes = await prisma.like.count();
  const dbFavorites = await prisma.favorite.count();
  const dbTagDefs = await prisma.tagDef.count();
  const dbSettings = await prisma.siteSettings.count();

  console.log("\n数据库计数：");
  console.log("  users      :", dbUsers);
  console.log("  prefs      :", dbPrefs);
  console.log("  posts      :", dbPosts);
  console.log("  comments   :", dbComments);
  console.log("  likes      :", dbLikes);
  console.log("  favorites  :", dbFavorites);
  console.log("  tagDefs    :", dbTagDefs);
  console.log("  settings   :", dbSettings);

  function check(label, jsonCount, dbCount) {
    if (jsonCount === dbCount) {
      console.log(`✔ ${label} 数量一致：${jsonCount}`);
    } else {
      console.warn(
        `⚠ ${label} 数量不一致：JSON=${jsonCount}, DB=${dbCount}`,
      );
    }
  }

  console.log("\n数量对比结果：");
  check("users", jsonUsers.length, dbUsers);
  check("prefs", jsonPrefs.length, dbPrefs);
  check("posts", jsonPosts.length, dbPosts);
  check("comments", jsonComments.length, dbComments);
  check("likes", jsonLikes.length, dbLikes);
  check("favorites", jsonFavorites.length, dbFavorites);
  check("tagDefs", jsonTagDefs.length, dbTagDefs);
  check("settings", jsonSettings ? 1 : 0, dbSettings);

  // 检查每个文章 slug 是否都在数据库中存在
  console.log("\n检查文章 slug 是否全部存在于数据库...");
  const missingSlugs = [];
  for (const p of jsonPosts) {
    const slug = String(p.slug || "").trim();
    if (!slug) continue;
    const found = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!found) {
      missingSlugs.push(slug);
    }
  }
  if (!missingSlugs.length) {
    console.log("✔ 所有 JSON 中的文章 slug 都已在数据库中找到。");
  } else {
    console.warn(
      "⚠ 以下 slug 在数据库中未找到，对应文章可能迁移失败：",
      missingSlugs,
    );
  }

  // 检查标签名称
  console.log("\n检查标签定义是否全部存在于数据库...");
  const dbTagNames = new Set(
    (await prisma.tagDef.findMany({ select: { name: true } })).map(
      (t) => t.name,
    ),
  );
  const missingTags = [];
  for (const t of jsonTagDefs) {
    const name = String(t.name || "").trim();
    if (!name) continue;
    if (!dbTagNames.has(name)) {
      missingTags.push(name);
    }
  }
  if (!missingTags.length) {
    console.log("✔ 所有 JSON 中的标签定义都已在数据库中找到。");
  } else {
    console.warn(
      "⚠ 以下标签在数据库中未找到，对应定义可能迁移失败：",
      missingTags,
    );
  }

  console.log("\n检查完成。");
}

main()
  .catch((e) => {
    console.error("检查过程中发生错误：", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

