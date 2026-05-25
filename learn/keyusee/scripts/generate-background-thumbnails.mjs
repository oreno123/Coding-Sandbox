import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backgroundDir = path.resolve(projectRoot, 'src', 'image', 'background');
const thumbsDir = path.resolve(backgroundDir, '_thumbs');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const width = Number(process.env.THUMB_WIDTH || 320);
const height = Number(process.env.THUMB_HEIGHT || 180);
const quality = Number(process.env.THUMB_QUALITY || 72);

const isImageFile = (fileName) => /\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(fileName);

if (!fs.existsSync(backgroundDir)) {
  console.error(`Background directory not found: ${backgroundDir}`);
  process.exit(1);
}

fs.mkdirSync(thumbsDir, { recursive: true });

const files = fs
  .readdirSync(backgroundDir, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name)
  .filter(isImageFile);

let processed = 0;
let skipped = 0;
let failed = 0;

for (const fileName of files) {
  const inputPath = path.resolve(backgroundDir, fileName);
  const baseName = path.parse(fileName).name;
  const outputPath = path.resolve(thumbsDir, `${baseName}.jpg`);

  try {
    if (!force && fs.existsSync(outputPath)) {
      const inputStat = fs.statSync(inputPath);
      const outputStat = fs.statSync(outputPath);
      if (outputStat.mtimeMs >= inputStat.mtimeMs) {
        skipped += 1;
        continue;
      }
    }

    await sharp(inputPath, { failOn: 'none' })
      .rotate()
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality, mozjpeg: true })
      .toFile(outputPath);

    processed += 1;
  } catch (e) {
    failed += 1;
    console.error(`Failed: ${fileName}`);
    console.error(e?.message || e);
  }
}

console.log(
  JSON.stringify(
    {
      backgroundDir,
      thumbsDir,
      width,
      height,
      quality,
      processed,
      skipped,
      failed
    },
    null,
    2
  )
);
