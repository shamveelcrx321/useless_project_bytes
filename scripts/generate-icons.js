/**
 * Generates minimal PNG icons and a Windows .ico for DIGAMBARAN.
 * No external deps — writes uncompressed RGBA PNGs and a simple ICO.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createPng(size, rgbaFn) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = rgbaFn(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function digambaranPixel(x, y, size) {
  const cx = (x + 0.5) / size;
  const cy = (y + 0.5) / size;
  const dx = cx - 0.5;
  const dy = cy - 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // dark circle
  if (dist > 0.48) return [0, 0, 0, 0];
  if (dist > 0.42) return [196, 92, 38, 255];

  // inner mark — vertical slash
  const slash = Math.abs(dx * 0.7 + dy * 0.1) < 0.08 && Math.abs(dy) < 0.28;
  if (slash) return [242, 234, 216, 255];

  return [26, 24, 21, 255];
}

function pngToIco(pngBuffers, sizes) {
  // ICO with PNG images (Vista+)
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  const parts = [header];

  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(16);
    const size = sizes[i];
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngBuffers[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += pngBuffers[i].length;
  }

  return Buffer.concat([...parts, ...entries, ...pngBuffers]);
}

const root = path.join(__dirname, "..");
const assets = path.join(root, "assets");
const extIcons = path.join(root, "chrome-extension", "icons");
fs.mkdirSync(assets, { recursive: true });
fs.mkdirSync(extIcons, { recursive: true });

const sizes = [16, 32, 48, 128, 256];
const pngs = {};
for (const size of sizes) {
  pngs[size] = createPng(size, digambaranPixel);
}

fs.writeFileSync(path.join(assets, "tray.png"), pngs[16]);
fs.writeFileSync(path.join(assets, "icon.png"), pngs[256]);
fs.writeFileSync(
  path.join(assets, "icon.ico"),
  pngToIco([pngs[16], pngs[32], pngs[48], pngs[256]], [16, 32, 48, 256])
);

fs.writeFileSync(path.join(extIcons, "icon16.png"), pngs[16]);
fs.writeFileSync(path.join(extIcons, "icon48.png"), pngs[48]);
fs.writeFileSync(path.join(extIcons, "icon128.png"), pngs[128]);

console.log("Icons generated.");
