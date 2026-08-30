/* Generates assets/icon.png — a cute Lumi cat face — with zero deps.
 * Run: node scripts/gen-icon.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

// ---------- tiny PNG encoder ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- drawing helpers ----------
const px = new Uint8Array(SIZE * SIZE * 4);

function blend(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return;
  const i = (y * SIZE + x) * 4;
  const na = a + (px[i + 3] / 255) * (1 - a);
  if (na <= 0) return;
  px[i] = Math.round((r * a + px[i] * (px[i + 3] / 255) * (1 - a)) / na);
  px[i + 1] = Math.round((g * a + px[i + 1] * (px[i + 3] / 255) * (1 - a)) / na);
  px[i + 2] = Math.round((b * a + px[i + 2] * (px[i + 3] / 255) * (1 - a)) / na);
  px[i + 3] = Math.round(na * 255);
}

function fillEllipse(cx, cy, rx, ry, color, alpha = 1) {
  const [r, g, b] = color;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) {
        // soft edge
        const a = alpha * Math.min(1, Math.max(0, (1 - d) * ry * 0.8 + 0.2));
        blend(x, y, r, g, b, a);
      }
    }
  }
}

function fillTriangle(p1, p2, p3, color, alpha = 1) {
  const [r, g, b] = color;
  const minX = Math.min(p1[0], p2[0], p3[0]);
  const maxX = Math.max(p1[0], p2[0], p3[0]);
  const minY = Math.min(p1[1], p2[1], p3[1]);
  const maxY = Math.max(p1[1], p2[1], p3[1]);
  const sign = (a, b2, c) => (a[0] - c[0]) * (b2[1] - c[1]) - (b2[0] - c[0]) * (a[1] - c[1]);
  for (let y = minY; y <= maxX - minX && y <= maxY; y++) {
    const yy = y;
    for (let x = minX; x <= maxX; x++) {
      const d1 = sign([x, yy], p1, p2);
      const d2 = sign([x, yy], p2, p3);
      const d3 = sign([x, yy], p3, p1);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) blend(x, yy, r, g, b, alpha);
    }
  }
}

// ---------- Lumi cat ----------
const INDIGO = [99, 102, 241];
const INDIGO_LIGHT = [165, 180, 252];
const DARK = [30, 27, 75];
const WHITE = [255, 255, 255];
const PINK = [253, 164, 175];

const cx = SIZE / 2;
const cy = SIZE / 2 + 14;

// ears (before body so body overlaps base)
fillTriangle([cx - 78, cy - 58], [cx - 18, cy - 86], [cx - 60, cy + 6], INDIGO, 1);
fillTriangle([cx + 78, cy - 58], [cx + 18, cy - 86], [cx + 60, cy + 6], INDIGO, 1);
// inner ears
fillTriangle([cx - 66, cy - 50], [cx - 30, cy - 70], [cx - 52, cy - 2], INDIGO_LIGHT, 0.9);
fillTriangle([cx + 66, cy - 50], [cx + 30, cy - 70], [cx + 52, cy - 2], INDIGO_LIGHT, 0.9);

// head: big rounded blob
fillEllipse(cx, cy, 96, 84, INDIGO, 1);
// top highlight
fillEllipse(cx - 30, cy - 40, 52, 30, WHITE, 0.14);
// muzzle / belly patch
fillEllipse(cx, cy + 30, 46, 32, WHITE, 0.35);

// eyes
fillEllipse(cx - 34, cy - 8, 12, 15, DARK, 1);
fillEllipse(cx + 34, cy - 8, 12, 15, DARK, 1);
// eye highlights
fillEllipse(cx - 30, cy - 14, 4.5, 5, WHITE, 1);
fillEllipse(cx + 38, cy - 14, 4.5, 5, WHITE, 1);

// blush
fillEllipse(cx - 56, cy + 18, 12, 7, PINK, 0.55);
fillEllipse(cx + 56, cy + 18, 12, 7, PINK, 0.55);

// mouth: w shape (two small arcs approximated with ellipses cut) — simple smile
for (let t = 0; t <= 1.0; t += 0.002) {
  // left arc
  let x = cx - 12 + 12 * t;
  let y = cy + 26 + 8 * Math.sin(Math.PI * t);
  fillEllipse(x, y, 1.6, 1.6, DARK, 1);
  // right arc
  x = cx + 12 - 12 * t;
  fillEllipse(x, y, 1.6, 1.6, DARK, 1);
}
// nose
fillEllipse(cx, cy + 18, 5, 4, DARK, 1);

// whiskers
for (let i = -1; i <= 1; i++) {
  for (let t = 0; t <= 1; t += 0.01) {
    const y = cy + 14 + i * 9 + t * 2;
    fillEllipse(cx - 70 - t * 24, y, 1.3, 1.3, WHITE, 0.85);
    fillEllipse(cx + 70 + t * 24, y, 1.3, 1.3, WHITE, 0.85);
  }
}

// sparkles
function sparkle(sx, sy, s, a) {
  for (let t = -1; t <= 1; t += 0.02) {
    fillEllipse(sx + t * s, sy, s * 0.12 * (1 - Math.abs(t)), 1, WHITE, a);
    fillEllipse(sx, sy + t * s, 1, s * 0.12 * (1 - Math.abs(t)), WHITE, a);
  }
}
sparkle(36, 52, 16, 0.9);
sparkle(222, 96, 12, 0.7);
sparkle(210, 210, 9, 0.6);

// ---------- write ----------
const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const png = encodePNG(SIZE, SIZE, Buffer.from(px));
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log('icon written:', path.join(outDir, 'icon.png'), png.length, 'bytes');
