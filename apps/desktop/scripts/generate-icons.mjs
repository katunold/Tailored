import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'build', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const SIZES = [16, 32, 48, 64, 128, 256, 512];
const ICO_SIZES = [16, 32, 48, 256];

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  const payload = Buffer.concat([typeBuf, data]);
  crc.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([len, payload, crc]);
}

function buildPng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    scanlines[rowStart] = 0; // no filter
    rgba.copy(scanlines, rowStart + 1, y * stride, y * stride + stride);
  }

  const idat = zlib.deflateSync(scanlines, { level: 9 });

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function iconPixels(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size * 0.42;
  const r2 = r * r;

  const bgTop = [250, 245, 238];
  const bgBottom = [230, 221, 206];

  const ringOuter = size * 0.29;
  const ringInner = size * 0.21;
  const ringOuter2 = ringOuter * ringOuter;
  const ringInner2 = ringInner * ringInner;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;

      const t = y / (size - 1);
      const bgR = Math.round(bgTop[0] * (1 - t) + bgBottom[0] * t);
      const bgG = Math.round(bgTop[1] * (1 - t) + bgBottom[1] * t);
      const bgB = Math.round(bgTop[2] * (1 - t) + bgBottom[2] * t);

      let R = bgR;
      let G = bgG;
      let B = bgB;
      let A = 255;

      if (d2 <= r2) {
        const edge = Math.sqrt(d2) / r;
        const shade = 1 - 0.22 * edge;
        R = Math.round(39 * shade + 8);
        G = Math.round(74 * shade + 10);
        B = Math.round(118 * shade + 18);

        const highlight = clamp(((cx - x) + (cy - y)) / (size * 1.7), 0, 0.2);
        R = clamp(Math.round(R + 255 * highlight), 0, 255);
        G = clamp(Math.round(G + 255 * highlight), 0, 255);
        B = clamp(Math.round(B + 255 * highlight), 0, 255);

        // golden ring
        if (d2 <= ringOuter2 && d2 >= ringInner2) {
          const glow = clamp((ringOuter2 - d2) / (ringOuter2 - ringInner2), 0, 1);
          R = Math.round(232 + 12 * glow);
          G = Math.round(184 + 18 * glow);
          B = Math.round(84 + 10 * glow);
        }

        // stylized monogram T
        const sx = (x - cx) / size;
        const sy = (y - cy) / size;
        const topBar = sy > -0.16 && sy < -0.06 && Math.abs(sx) < 0.20;
        const stem = sy >= -0.06 && sy < 0.20 && Math.abs(sx) < 0.05;

        if (topBar || stem) {
          R = 247;
          G = 237;
          B = 210;
        }
      } else {
        // rounded square alpha mask
        const pad = size * 0.04;
        if (x < pad || y < pad || x > size - 1 - pad || y > size - 1 - pad) {
          const kx = Math.min(x, size - 1 - x);
          const ky = Math.min(y, size - 1 - y);
          const d = Math.min(kx, ky);
          A = d < pad ? Math.round(clamp(d / pad, 0, 1) * 255) : 255;
        }
      }

      buf[i + 0] = R;
      buf[i + 1] = G;
      buf[i + 2] = B;
      buf[i + 3] = A;
    }
  }

  return buf;
}

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  const blobs = [];
  let offset = header.length + images.length * 16;

  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    blobs.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...blobs]);
}

const pngBySize = new Map();
for (const size of SIZES) {
  const pixels = iconPixels(size);
  const png = buildPng(size, size, pixels);
  pngBySize.set(size, png);
  fs.writeFileSync(path.join(outDir, `${size}x${size}.png`), png);
}

// electron-builder commonly picks this as a primary icon file
fs.copyFileSync(path.join(outDir, '512x512.png'), path.join(outDir, 'icon.png'));
fs.writeFileSync(
  path.join(outDir, 'favicon.ico'),
  buildIco(ICO_SIZES.map((size) => ({ size, png: pngBySize.get(size) })))
);
fs.writeFileSync(
  path.join(outDir, 'icon.ico'),
  buildIco(ICO_SIZES.map((size) => ({ size, png: pngBySize.get(size) })))
);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#faf5ee" />
      <stop offset="100%" stop-color="#e6ddce" />
    </linearGradient>
    <radialGradient id="orb" cx="35%" cy="28%" r="68%">
      <stop offset="0%" stop-color="#38649a" />
      <stop offset="100%" stop-color="#17345a" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="84" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="215" fill="url(#orb)"/>
  <circle cx="256" cy="256" r="126" fill="none" stroke="#e3b95f" stroke-width="42"/>
  <path d="M154 183h204v47h-79v140h-46V230h-79z" fill="#f7edd2"/>
</svg>`;
fs.writeFileSync(path.join(outDir, 'icon.svg'), svg, 'utf8');

console.log(`Generated icon assets in ${outDir}`);
