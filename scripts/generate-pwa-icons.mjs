import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const logoPath = path.join(root, "src", "assets", "logos", "logo-small.png");

// Fondo del logo McDental Pulse (verde oscuro del branding)
const LOGO_BG = { r: 26, g: 61, b: 55, alpha: 1 };

async function createSquareIcon(size, outputName, paddingRatio = 0.08) {
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;

  const logo = await sharp(logoPath)
    .resize(inner, inner, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: LOGO_BG,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, outputName));
}

async function main() {
  await createSquareIcon(32, "favicon-32x32.png", 0.04);
  await createSquareIcon(192, "pwa-192x192.png", 0.06);
  await createSquareIcon(512, "pwa-512x512.png", 0.06);
  await createSquareIcon(512, "pwa-512x512-maskable.png", 0.18);
  await createSquareIcon(180, "apple-touch-icon.png", 0.08);

  console.log("PWA icons generated from src/assets/logos/logo-small.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
