/**
 * Task 14-h: alternative hero posters for the poster library (admin CMS).
 *
 * The z-ai CLI only allows a fixed size list, and the backend API rejects
 * 1440x720 (720 is not a multiple of 32). So we generate each poster at
 * 1472x736 (exact 2:1 aspect, both dimensions multiples of 32) via the SDK
 * and then resize to the canonical contract size 1440x720 with sharp.
 *
 * Run: bun scripts/gen-hero-posters.ts
 */
import ZAI from 'z-ai-web-dev-sdk';
import sharp from 'sharp';
import fs from 'fs';

const POSTERS: { prompt: string; out: string }[] = [
  {
    prompt:
      'Wide promotional banner for a doll shop: elegant tea party scene with fashion dolls in pastel dresses seated at a miniature table with tiny cakes and porcelain cups, soft pink and cream tones, warm studio lighting, generous empty copy space on the left side, professional product photography, high quality, no text, no letters, no logos',
    out: '/home/z/my-project/public/images/hero/hero-tea-party.png',
  },
  {
    prompt:
      'Wide promotional banner for a doll shop: glamorous fashion runway scene with dolls in sparkling outfits, small podium with bright spotlights, confetti in the air, magenta and gold tones, festive retail advertising style, generous empty copy space on the left side, professional photography, high quality, no text, no letters, no logos',
    out: '/home/z/my-project/public/images/hero/hero-runway.png',
  },
];

const GEN_SIZE = '1472x736'; // 2:1 ratio, multiples of 32, API-valid
const FINAL_W = 1440;
const FINAL_H = 720;

async function main() {
  const zai = await ZAI.create();

  for (const poster of POSTERS) {
    const response = await zai.images.generations.create({
      prompt: poster.prompt,
      size: GEN_SIZE as "1440x720", // фактический размер — 1472x736 (кратен 32)
    });

    const base64 = response.data?.[0]?.base64;
    if (!base64) {
      throw new Error('Invalid response from image generation API');
    }

    const buffer = Buffer.from(base64, 'base64');

    // Resize to the canonical contract size 1440x720 (same 2:1 aspect)
    const finalBuffer = await sharp(buffer)
      .resize(FINAL_W, FINAL_H, { kernel: 'lanczos3' })
      .png()
      .toBuffer();

    fs.writeFileSync(poster.out, finalBuffer);
    console.log(`OK ${poster.out} (${finalBuffer.length} bytes, ${FINAL_W}x${FINAL_H})`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
