#!/usr/bin/env node
/**
 * Generates PWA icons for Purview DLP Logic Visualizer.
 * Pure Node.js — no external dependencies.
 * Run: node scripts/generate-icons.js
 */
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// --- CRC32 ---
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c;
}
function crc32(buf) {
    let crc = 0xffffffff;
    for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
}

function makePNG(size, pixelFn) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // 8-bit depth
    ihdr[9] = 2; // RGB truecolor
    // compression/filter/interlace = 0

    const rowLen = 1 + size * 3;
    const raw = Buffer.alloc(size * rowLen);
    for (let y = 0; y < size; y++) {
        raw[y * rowLen] = 0; // filter byte: None
        for (let x = 0; x < size; x++) {
            const [r, g, b] = pixelFn((x + 0.5) / size, (y + 0.5) / size);
            const off = y * rowLen + 1 + x * 3;
            raw[off] = r; raw[off + 1] = g; raw[off + 2] = b;
        }
    }

    const compressed = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

// --- Geometry helpers ---
function ptInRoundedRect(nx, ny, x0, y0, x1, y1, r) {
    if (nx < x0 || nx > x1 || ny < y0 || ny > y1) return false;
    const d = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
    if (nx < x0 + r && ny < y0 + r) return d(nx, ny, x0 + r, y0 + r) <= r;
    if (nx > x1 - r && ny < y0 + r) return d(nx, ny, x1 - r, y0 + r) <= r;
    if (nx < x0 + r && ny > y1 - r) return d(nx, ny, x0 + r, y1 - r) <= r;
    if (nx > x1 - r && ny > y1 - r) return d(nx, ny, x1 - r, y1 - r) <= r;
    return true;
}

// --- Icon design ---
// Indigo (#4F46E5) background + white shield + thin inset indigo border on shield
const BG    = [79,  70,  229]; // #4F46E5
const WHITE = [255, 255, 255];
const LIGHT = [199, 210, 254]; // indigo-200 for subtle detail

function shieldContains(nx, ny) {
    // Shield: rounded-top rectangle (y 0.14..0.63) + triangle tip (y 0.63..0.87)
    const L = 0.18, R = 0.82, T = 0.14, M = 0.63, TIP = 0.87, CX = 0.5, CR = 0.10;
    if (ny >= T && ny <= M) return ptInRoundedRect(nx, ny, L, T, R, M, CR);
    if (ny > M && ny <= TIP) {
        const t = (ny - M) / (TIP - M);
        const hw = (R - L) / 2 * (1 - t);
        return nx >= CX - hw && nx <= CX + hw;
    }
    return false;
}

function shieldInnerContains(nx, ny) {
    // 5% inset of shield
    const pad = 0.04;
    const L = 0.18 + pad, R = 0.82 - pad, T = 0.14 + pad, M = 0.63 - pad * 0.5, TIP = 0.87 - pad, CX = 0.5, CR = 0.07;
    if (ny >= T && ny <= M) return ptInRoundedRect(nx, ny, L, T, R, M, CR);
    if (ny > M && ny <= TIP) {
        const t = (ny - M) / (TIP - M);
        const hw = (R - L) / 2 * (1 - t);
        return nx >= CX - hw && nx <= CX + hw;
    }
    return false;
}

// Simple "D" letterform drawn as filled bezier-like shapes in normalized coords
function letterDContains(nx, ny) {
    // "D": vertical bar on left + curved right half
    const lx = 0.36, rx = 0.68, ty = 0.30, by = 0.70, sw = 0.07;
    // Vertical stem
    if (nx >= lx && nx <= lx + sw && ny >= ty && ny <= by) return true;
    // Top cap
    if (ny >= ty && ny <= ty + sw && nx >= lx && nx <= rx - 0.07) return true;
    // Bottom cap
    if (ny >= by - sw && ny <= by && nx >= lx && nx <= rx - 0.07) return true;
    // Right arc: half-ellipse, right side only
    const cx = lx + sw / 2;
    const cy = (ty + by) / 2;
    const aRx = (rx - cx);
    const aRy = (by - ty) / 2;
    const innerRx = aRx - sw;
    const innerRy = aRy - sw;
    if (nx >= cx) {
        const ex = (nx - cx) / aRx;
        const ey = (ny - cy) / aRy;
        const outer = ex * ex + ey * ey;
        const ix = (nx - cx) / innerRx;
        const iy = (ny - cy) / innerRy;
        const inner = ix * ix + iy * iy;
        if (outer <= 1 && inner >= 1) return true;
    }
    return false;
}

function iconPixel(nx, ny) {
    // Background: indigo
    // White shield outline
    // Indigo inner shield area
    // White "D" letterform inside
    if (!shieldContains(nx, ny)) return BG;
    if (!shieldInnerContains(nx, ny)) return LIGHT; // thin border ring
    // Inner shield area: indigo
    if (!letterDContains(nx, ny)) return BG;
    // Letter D: white
    return WHITE;
}

// --- Generate ---
const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
    const buf = makePNG(size, iconPixel);
    const outPath = path.join(outDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`Generated ${outPath} (${buf.length} bytes)`);
}

console.log('Done.');
