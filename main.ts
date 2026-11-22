// Cheeseburger — a program that draws one delicious burger, procedurally,
// and writes it to /output/entry.png (PNG, 1024x1024, pure stdlib, no network,
// fully deterministic: no clock, no randomness source, no network).
//
// The picture: one big cheeseburger on a white plate, warm cream light,
// glossy top bun with sesame, cheese dripping over a grilled patty.
// Built from a framebuffer + hand-rolled shapes + a pure-stdlib PNG encoder.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const fb = new Uint8Array(W * H * 3);

type RGB = [number, number, number];

// ---------- tiny helpers ----------
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function mix(c0: RGB, c1: RGB, t: number): RGB {
  return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
}
// deterministic 0..1 hash for texture speckles (fixed seed, no randomness)
function hash01(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 974634) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}
function blendPx(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  fb[i] = lerp(fb[i], c[0], a);
  fb[i + 1] = lerp(fb[i + 1], c[1], a);
  fb[i + 2] = lerp(fb[i + 2], c[2], a);
}

// filled ellipse; color may be a flat RGB or a function of (x, y)
function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  col: RGB | ((x: number, y: number) => RGB),
  alpha = 1,
  clip?: (x: number, y: number) => boolean,
): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / ry;
    const dxMax = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
    for (let x = Math.max(x0, Math.ceil(cx - dxMax)); x <= Math.min(x1, Math.floor(cx + dxMax)); x++) {
      if (clip && !clip(x, y)) continue;
      const c = typeof col === 'function' ? col(x, y) : col;
      if (alpha >= 1) setPx(x, y, c);
      else blendPx(x, y, c, alpha);
    }
  }
}

// axis-aligned rect with per-pixel color function
function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col: RGB | ((x: number, y: number) => RGB),
  alpha = 1,
): void {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
      const c = typeof col === 'function' ? col(x, y) : col;
      if (alpha >= 1) setPx(x, y, c);
      else blendPx(x, y, c, alpha);
    }
  }
}

// rounded rect (corner radius r), vertical gradient between cTop and cBot
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number, cTop: RGB, cBot: RGB): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const nx = Math.max(x0 + r, Math.min(x1 - r, x));
      const ny = Math.max(y0 + r, Math.min(y1 - r, y));
      if ((x - nx) * (x - nx) + (y - ny) * (y - ny) > r * r) continue;
      const t = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
      setPx(x, y, mix(cTop, cBot, t));
    }
  }
}

// ---------- background: warm cream, soft radial light, gentle vignette ----------
const bgTop: RGB = [250, 238, 205];
const bgBot: RGB = [238, 214, 163];
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const base = mix(bgTop, bgBot, t);
  for (let x = 0; x < W; x++) {
    const dLight = Math.hypot(x - 512, y - 400);
    const glow = Math.max(0, 1 - dLight / 680) * 16;
    const dEdge = Math.hypot((x - 512) / 512, (y - 512) / 512);
    const vig = dEdge > 0.85 ? 1 - (dEdge - 0.85) * 0.28 : 1;
    const i = (y * W + x) * 3;
    fb[i] = clamp(base[0] * vig + glow, 0, 255);
    fb[i + 1] = clamp(base[1] * vig + glow, 0, 255);
    fb[i + 2] = clamp(base[2] * vig + glow, 0, 255);
  }
}

// ---------- plate shadow + plate ----------
ellipse(512, 812, 375, 58, [120, 84, 48], 0.16);
ellipse(512, 726, 405, 132, [226, 216, 196]); // rim
ellipse(512, 722, 388, 122, [253, 250, 242]); // plate face
ellipse(512, 700, 388, 122, [255, 255, 255], 0.25); // soft top sheen

// ---------- burger stack (bottom to top) ----------
// bottom bun
roundRect(316, 636, 708, 722, 26, [224, 158, 62], [186, 118, 34]);
rect(316, 700, 708, 722, [166, 102, 26]); // toasted base edge
// patty, grilled, with speckles
roundRect(292, 588, 732, 652, 22, [104, 56, 26], [58, 30, 13]);
rect(296, 588, 728, 596, [140, 84, 40], 0.7); // charred top edge catches the light
for (let y = 592; y <= 648; y++) {
  for (let x = 296; x <= 728; x++) {
    const nx = Math.max(292 + 22, Math.min(732 - 22, x));
    const ny = Math.max(588 + 22, Math.min(652 - 22, y));
    if ((x - nx) * (x - nx) + (y - ny) * (y - ny) > 22 * 22) continue;
    const h = hash01(x, y, 7);
    if (h > 0.94) blendPx(x, y, [32, 16, 7], 0.55);
    else if (h > 0.88) blendPx(x, y, [150, 92, 46], 0.5);
  }
}
// cheese: sheet + three glossy drips over the patty edge
rect(306, 556, 718, 596, (x, y) => mix([255, 158, 26], [234, 116, 8], (y - 556) / 40));
for (const cx of [372, 512, 652]) {
  ellipse(cx, 596, 27, 30, (x, y) => mix([255, 158, 26], [234, 116, 8], clamp((y - 556) / 40, 0, 1)));
}
ellipse(512, 566, 200, 8, [255, 196, 80], 0.55); // cheese shine
// tomato
roundRect(322, 528, 702, 562, 14, [216, 62, 40], [168, 30, 18]);
rect(330, 532, 694, 540, [232, 92, 66], 0.8);
// lettuce: wavy green band
for (let x = 320; x <= 704; x++) {
  const wave = 8 * Math.sin(x * 0.045 + 1.3) + 6 * Math.sin(x * 0.11);
  const yTop = 498;
  const yBot = Math.round(522 + wave);
  for (let y = yTop; y <= yBot; y++) {
    const t = clamp((y - yTop) / 26, 0, 1);
    setPx(x, y, mix([124, 180, 66], [84, 138, 46], t));
  }
  setPx(x, yBot, [70, 118, 38]);
}
// top bun: big golden dome
const dome = (x: number, y: number) => {
  const dx = (x - 512) / 202;
  const dy = (y - 502) / 188;
  return dx * dx + dy * dy <= 1 && y <= 502;
};
for (let y = 314; y <= 502; y++) {
  const dy = (y - 502) / 188;
  const dxMax = Math.sqrt(Math.max(0, 1 - dy * dy)) * 202;
  for (let x = Math.ceil(512 - dxMax); x <= Math.floor(512 + dxMax); x++) {
    const t = clamp((y - 314) / 188, 0, 1);
    setPx(x, y, mix([244, 182, 76], [206, 132, 36], t));
  }
}
// bun gloss, clipped to the dome
ellipse(438, 372, 92, 42, [255, 228, 160], 0.34, dome);
ellipse(600, 440, 46, 18, [255, 220, 150], 0.22, dome);
// sesame seeds on the dome (fixed positions, all inside the dome)
const seeds: Array<[number, number, number]> = [
  [420, 372, -0.5], [512, 348, 0.2], [598, 376, 0.6], [462, 420, 0.3],
  [556, 424, -0.4], [384, 432, 0.9], [636, 436, -0.9], [512, 462, 0.1],
  [448, 468, 0.5], [580, 470, -0.3], [410, 470, -0.7], [616, 400, 0.4],
];
for (const [sx, sy, ang] of seeds) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if ((dx / 10) * (dx / 10) + (dy / 5) * (dy / 5) > 1) continue;
      const x = Math.round(sx + dx * ca - dy * sa);
      const y = Math.round(sy + dx * sa + dy * ca);
      if (dome(x, y)) setPx(x, y, [255, 233, 176]);
    }
  }
}
// a few sesame seeds scattered on the plate
for (const [sx, sy] of [[352, 782], [688, 786], [646, 806]] as Array<[number, number]>) {
  ellipse(sx, sy, 9, 5, [232, 206, 150]);
}

// ---------- PNG encoder (pure stdlib) ----------
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
