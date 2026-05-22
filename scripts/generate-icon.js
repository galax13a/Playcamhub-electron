'use strict';
// Generates assets/icons/icon.png (512x512 gradient) without external deps
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([tb, data]));
  const lenB = Buffer.allocUnsafe(4); lenB.writeUInt32BE(data.length);
  const crcB = Buffer.allocUnsafe(4); crcB.writeUInt32BE(crc);
  return Buffer.concat([lenB, tb, data, crcB]);
}

const SIZE = 512;
const scanlines = [];

for (let y = 0; y < SIZE; y++) {
  const line = Buffer.alloc(SIZE * 4 + 1);
  line[0] = 0; // None filter
  for (let x = 0; x < SIZE; x++) {
    // Diagonal gradient: Red #FF3366 → Purple #8B5CF6
    const t  = (x + y) / (2 * (SIZE - 1));
    const cx = x - SIZE / 2, cy = y - SIZE / 2;
    const dist = Math.sqrt(cx * cx + cy * cy) / (SIZE / 2);

    const r = Math.round(0xFF * (1 - t) + 0x8B * t);
    const g = Math.round(0x33 * (1 - t) + 0x5C * t);
    const b = Math.round(0x66 * (1 - t) + 0xF6 * t);

    // Slight vignette
    const alpha = Math.round(255 * Math.max(0.1, 1 - dist * 0.3));

    line[1 + x * 4] = r;
    line[2 + x * 4] = g;
    line[3 + x * 4] = b;
    line[4 + x * 4] = alpha;
  }
  scanlines.push(line);
}

const raw        = Buffer.concat(scanlines);
const compressed = zlib.deflateSync(raw, { level: 6 });

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '..', 'assets', 'icons', 'icon.png');
fs.writeFileSync(outPath, png);
console.log('✅  Icon written:', outPath, `(${(png.length / 1024).toFixed(1)} KB)`);
