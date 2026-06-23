import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const logoPath = path.join(root, "src", "assets", "logos", "logo-small.png");
const svgPath = path.join(publicDir, "pwa-icon-source.svg");

const BRAND = { r: 0, g: 127, b: 109, alpha: 1 };

async function renderSvgIcon(size, outputName, paddingRatio = 0.08) {
  const svg = await readFile(svgPath);
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;

  await sharp(svg)
    .resize(inner, inner, { fit: "contain", background: BRAND })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: BRAND,
    })
    .png()
    .toFile(path.join(publicDir, outputName));
}

async function renderLogoIcon(size, outputName, logoScale = 0.78) {
  const logoWidth = Math.round(size * logoScale);
  const logo = await sharp(logoPath)
    .resize(logoWidth, Math.round(logoWidth * 0.42), {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(publicDir, outputName));
}

async function main() {
  await renderSvgIcon(192, "pwa-192x192.png", 0.06);
  await renderSvgIcon(512, "pwa-512x512.png", 0.06);
  await renderSvgIcon(512, "pwa-512x512-maskable.png", 0.18);
  await renderSvgIcon(180, "apple-touch-icon.png", 0.08);

  try {
    await renderLogoIcon(192, "pwa-192x192-logo.png");
  } catch {
    // Optional alternate icon from raster logo.
  }

  console.log("PWA icons generated in public/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
