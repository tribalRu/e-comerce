/**
 * Task 2-a fallback: hero banner generation.
 *
 * The z-ai CLI only allows a fixed size list, and the backend API rejects
 * 1440x720 (720 is not a multiple of 32). So we generate the hero at
 * 1472x736 (exact 2:1 aspect, both dimensions multiples of 32) via the SDK
 * and then resize to the canonical contract size 1440x720 with sharp.
 *
 * Run: bun scripts/gen-images.ts
 */
import ZAI from 'z-ai-web-dev-sdk';
import sharp from 'sharp';
import fs from 'fs';

const HERO_PROMPT =
  'Bright cheerful e-commerce hero banner for a doll store: a group of diverse beautiful dolls including a fashion doll, a baby doll and an elegant porcelain doll arranged on light display shelves, soft red and white geometric shapes in the background, festive modern retail advertising style, generous empty copy space on the left side, red color accents, high quality, no text, no letters, no logos';

const OUT_PATH = '/home/z/my-project/public/images/hero-dolls.png';
const GEN_SIZE = '1472x736'; // 2:1 ratio, multiples of 32, API-valid
const FINAL_W = 1440;
const FINAL_H = 720;

async function main() {
  const zai = await ZAI.create();

  const response = await zai.images.generations.create({
    prompt: HERO_PROMPT,
    size: GEN_SIZE,
  });

  const base64 = response.data?.[0]?.base64;
  if (!base64) {
    throw new Error('Invalid response from image generation API');
  }

  const buffer = Buffer.from(base64, 'base64');

  // Resize to the canonical contract size 1440x720 (same 2:1 aspect, no distortion)
  const finalBuffer = await sharp(buffer)
    .resize(FINAL_W, FINAL_H, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  fs.writeFileSync(OUT_PATH, finalBuffer);
  const meta = await sharp(finalBuffer).metadata();
  console.log(
    `OK hero-dolls.png written (${finalBuffer.length} bytes, ${meta.width}x${meta.height})`,
  );
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
