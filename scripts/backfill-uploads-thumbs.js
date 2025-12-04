/* Backfill existing uploads:
 * - Compress main images in place (resize + re-encode)
 * - Generate missing thumbnails in public/uploads/thumbs
 *
 * Run once on the server:
 *   cd /srv/marublog
 *   node scripts/backfill-uploads-thumbs.js
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require("sharp");

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const THUMB_DIR = path.join(UPLOAD_DIR, "thumbs");
const IMAGE_EXTS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
];

async function processImage(name) {
  if (name.startsWith(".")) return { skipped: true };
  if (name.includes(".thumb.")) return { skipped: true };

  const ext = path.extname(name).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) return { skipped: true };

  const filePath = path.join(UPLOAD_DIR, name);
  const thumbName = name.replace(ext, `.thumb${ext}`);
  const thumbPath = path.join(THUMB_DIR, thumbName);

  const stat = fs.statSync(filePath);
  const origSize = stat.size;

  let compressed = false;
  try {
    const img = sharp(filePath, { failOnError: false });
    const metadata = await img.metadata();

    let pipeline = img.resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    });

    if (ext === ".jpg" || ext === ".jpeg") {
      pipeline = pipeline.jpeg({ quality: 80 });
    } else if (ext === ".png") {
      pipeline = pipeline.png({ compressionLevel: 9 });
    }

    const buffer = await pipeline.toBuffer();
    if (buffer.length < origSize || metadata.width > 1920 || metadata.height > 1920) {
      fs.writeFileSync(filePath, buffer);
      compressed = true;
    }
  } catch (err) {
    console.error("[backfill] compress failed for", name, err.message || err);
  }

  let thumbCreated = false;
  try {
    if (!fs.existsSync(thumbPath)) {
      let thumbPipeline = sharp(filePath, { failOnError: false }).resize(
        400,
        400,
        { fit: "cover" },
      );

      if (ext === ".jpg" || ext === ".jpeg") {
        thumbPipeline = thumbPipeline.jpeg({ quality: 75 });
      } else if (ext === ".png") {
        thumbPipeline = thumbPipeline.png({ compressionLevel: 9 });
      }

      const thumbBuffer = await thumbPipeline.toBuffer();
      fs.writeFileSync(thumbPath, thumbBuffer);
      thumbCreated = true;
    }
  } catch (err) {
    console.error("[backfill] thumb failed for", name, err.message || err);
  }

  return { compressed, thumbCreated, skipped: false };
}

async function main() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log("[backfill] uploads directory not found:", UPLOAD_DIR);
    return;
  }
  fs.mkdirSync(THUMB_DIR, { recursive: true });

  const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });

  let processed = 0;
  let compressedCount = 0;
  let thumbCount = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const res = await processImage(name);
    if (res.skipped) {
      skipped++;
      continue;
    }
    processed++;
    if (res.compressed) compressedCount++;
    if (res.thumbCreated) thumbCount++;
  }

  console.log("[backfill] done.");
  console.log("  processed images:", processed);
  console.log("  compressed main:", compressedCount);
  console.log("  created thumbs:", thumbCount);
  console.log("  skipped entries:", skipped);
}

main().catch((err) => {
  console.error("[backfill] fatal error:", err);
  process.exit(1);
});

