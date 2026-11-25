/* ============================================================
   Pocket Pal — 8-bit sprite engine
   Everything is drawn procedurally on canvas at a logical
   resolution and rendered with image-rendering: pixelated.
   ============================================================ */

const OUT = '#443357';
const DARK = '#3c2b52';
const WHITE = '#ffffff';

export const STAGE_K = [1.15, 1.35, 1.55];

export const SPECIES = [
  { id: 'bunny', name: 'Bunny', stages: ['Little Bun', 'Hopper', 'Big Rabbit'] },
  { id: 'dino', name: 'Dino', stages: ['Baby Dino', 'Raptor', 'Crowned Rex'] },
  { id: 'giraffe', name: 'Giraffe', stages: ['Tiny Giraffe', 'Longneck', 'Noble Giraffe'] },
  { id: 'monkey', name: 'Monkey', stages: ['Baby Monkey', 'Swinger', 'Jungle King'] },
  { id: 'nummy', name: 'Nummy', stages: ['Squish', 'Nummy Pal', 'Mega Nummy'] },
  { id: 'banana', name: 'Banana', stages: ['Little Banana', 'Split Banana', 'Royal Bunch'] },
];

export const TINTS = [
  { id: 'blossom', name: 'Blossom', hex: '#ffb3c7' },
  { id: 'mint', name: 'Mint', hex: '#a8e6c3' },
  { id: 'sky', name: 'Sky', hex: '#a9d6ff' },
  { id: 'butter', name: 'Butter', hex: '#ffe08a' },
  { id: 'lilac', name: 'Lilac', hex: '#cdb4f6' },
  { id: 'peach', name: 'Peach', hex: '#ffc09f' },
];

/* ---------------- colour helpers ---------------- */

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t);
  const g = Math.round(A[1] + (B[1] - A[1]) * t);
  const bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function palette(tint) {
  return {
    base: tint,
    dark: mix(tint, OUT, 0.34),
    deep: mix(tint, OUT, 0.55),
    light: mix(tint, '#ffffff', 0.45),
    belly: mix(tint, '#fff8f2', 0.7),
    blush: 'rgba(255, 126, 170, 0.45)',
    outline: OUT,
  };
}

/* ---------------- primitives ---------------- */

export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function oval(ctx, cx, cy, rx, ry, color, step = 2) {
  if (rx <= 0 || ry <= 0) return;
  ctx.fillStyle = color;
  for (let y = -ry; y < ry; y += step) {
    const yy = y + step / 2;
    const w = Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))) * rx;
    const x0 = Math.round(cx - w);
    const x1 = Math.round(cx + w);
    if (x1 > x0) ctx.fillRect(x0, Math.round(cy + y), x1 - x0, step);
  }
}

/** outlined oval */
export function part(ctx, cx, cy, rx, ry, fill, o = OUT, grow = 2, step = 2) {
  oval(ctx, cx, cy, rx + grow, ry + grow, o, step);
  oval(ctx, cx, cy, rx, ry, fill, step);
}

export function ovalRing(ctx, cx, cy, rx, ry, t, color, step = 2) {
  ctx.fillStyle = color;
  const irx = Math.max(1, rx - t);
  const iry = Math.max(1, ry - t);
  for (let y = -ry; y < ry; y += step) {
    const yy = y + step / 2;
    const w = Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))) * rx;
    let wi = 0;
    if (Math.abs(yy) < iry) wi = Math.sqrt(1 - (yy * yy) / (iry * iry)) * irx;
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), Math.round(Math.max(1, w - wi)), step);
    ctx.fillRect(Math.round(cx + wi), Math.round(cy + y), Math.round(Math.max(1, w - wi)), step);
  }
}

/** upward pointing pixel triangle (apex at baseY - h) */
export function tri(ctx, cx, baseY, w, h, color) {
  ctx.fillStyle = color;
  const steps = Math.max(2, Math.round(h / 2));
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    const ww = Math.max(1, Math.round(w * t));
    const y = Math.round(baseY - h + (i * h) / steps);
    ctx.fillRect(Math.round(cx - ww / 2), y, ww, Math.max(2, Math.ceil(h / steps) + 1));
  }
}

export function triDown(ctx, cx, topY, w, h, color) {
  ctx.fillStyle = color;
  const steps = Math.max(2, Math.round(h / 2));
  for (let i = 0; i < steps; i++) {
    const t = 1 - (i + 1) / steps;
    const ww = Math.max(1, Math.round(w * t));
    const y = Math.round(topY + (i * h) / steps);
    ctx.fillRect(Math.round(cx - ww / 2), y, ww, Math.max(2, Math.ceil(h / steps) + 1));
  }
}

export function arcSmile(ctx, cx, cy, w, depth, color, thick = 2, invert = false) {
  ctx.fillStyle = color;
  const n = Math.max(4, Math.round(w));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(cx - w / 2 + i);
    const off = Math.sin(t * Math.PI) * depth * (invert ? -1 : 1);
    ctx.fillRect(x, Math.round(cy + off), 1, thick);
  }
}

export function map(ctx, x, y, rows, pal, s = 1) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c) px(ctx, x + i * s, y + j * s, s, s, c);
    }
  }
}

const HEART = [
  '.XX...XX.',
  'XXXX.XXXX',
  'XXXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
];

const STAR = [
  '...X...',
  '...X...',
  '..XXX..',
  'XXXXXXX',
  '..XXX..',
  '...X...',
  '...X...',
];

export function drawHeart(ctx, cx, cy, s, color, shine = WHITE) {
  map(ctx, Math.round(cx - 4 * s), Math.round(cy - 4 * s), HEART, { X: color }, s);
  if (s >= 2) px(ctx, cx - 2 * s, cy - 2 * s, Math.max(1, s * 0.8), Math.max(1, s * 0.8), shine);
}

export function drawStar(ctx, cx, cy, s, color, shine = WHITE) {
  map(ctx, Math.round(cx - 3 * s), Math.round(cy - 3 * s), STAR, { X: color }, s);
  if (s >= 2) px(ctx, cx - s / 2, cy - s / 2, Math.max(1, s), Math.max(1, s), shine);
}

/* ---------------- eyes ---------------- */

function eyeShape(ctx, x, y, rx, ry, open) {
  const h = Math.max(1, ry * 2 * Math.max(0.06, open));
  oval(ctx, x, y, rx, h / 2, DARK, 2);
  if (open > 0.4) {
    const hs = Math.max(1.2, rx * 0.5);
    px(ctx, x - rx * 0.55, y - h * 0.34, hs, hs, WHITE);
    if (rx > 3.4) px(ctx, x + rx * 0.22, y + h * 0.16, Math.max(1, hs * 0.55), Math.max(1, hs * 0.55), WHITE);
  }
}

/**
 * Draws both cute eyes.
 * expr: normal | blink | squint | heart | sparkle | droop | chomp
 */
export function drawEyes(ctx, L, expr, opts = {}) {
  const open = opts.open == null ? 1 : opts.open;
  const ex = L.head.cx;
  const y = L.head.cy + L.eyePos.y;
  const rx = L.eyePos.rx;
  const ry = L.eyePos.ry;
  const positions = [ex - L.eyePos.x, ex + L.eyePos.x];
  const base = L.colors ? L.colors.base : '#ffd7e4';

  if (expr === 'heart') {
    const s = Math.max(1, Math.round(rx / 3.6));
    for (const x of positions) drawHeart(ctx, x, y, s, '#ff5c8a');
    return;
  }
  if (expr === 'sparkle') {
    const s = Math.max(1, Math.round(rx / 3.4));
    for (const x of positions) drawStar(ctx, x, y, s, '#ffcf4d');
    return;
  }
  if (expr === 'squint') {
    for (const x of positions) {
      const w = Math.round(rx * 2.3);
      for (let i = 0; i <= w; i++) {
        const t = i / w;
        const off = -Math.sin(t * Math.PI) * ry * 0.82;
        px(ctx, x - w / 2 + i, y + off - 1, 1.4, 2.6, DARK);
      }
    }
    return;
  }
  if (expr === 'droop') {
    for (const x of positions) {
      eyeShape(ctx, x, y, rx, ry, Math.min(open, 1));
      // heavy eyelid
      const lidTop = y - ry * 0.95;
      const lidBottom = y - ry * 0.18;
      ctx.fillStyle = base;
      const span = Math.round(rx * 2);
      for (let i = 0; i <= span; i++) {
        const t = i / span;
        const slant = Math.sin(t * Math.PI) * 1.5;
        ctx.fillRect(Math.round(x - rx + i), Math.round(lidTop), 1, Math.max(1, lidBottom - lidTop + slant));
      }
      // sad brow
      px(ctx, x - rx, y - ry - 2.6, rx * 0.9, 1.6, OUT);
      px(ctx, x, y - ry - 1.6, rx * 0.9, 1.6, OUT);
      if (rx > 3) {
        px(ctx, x + rx * 0.75, y + ry * 0.5, 1.6, 2.4, '#8fd3ff');
        px(ctx, x + rx * 0.75, y + ry * 0.5 + 2.4, 1.6, 1.2, '#8fd3ff');
      }
    }
    return;
  }
  // normal + chomp
  for (const x of positions) eyeShape(ctx, x, y, rx, ry, open);
}

/* ---------------- mouth ---------------- */

function drawMouth(ctx, L, mode, openAmt = 0) {
  const m = L.mouth;
  const tone = '#5a3f6b';
  if (openAmt > 0.12) {
    const h = 3 + openAmt * 7 * (L.k || 1);
    const w = m.w * (0.75 + openAmt * 0.45);
    oval(ctx, m.x, m.y + h * 0.2, w * 0.5, h * 0.62, tone, 2);
    oval(ctx, m.x, m.y + h * 0.55, w * 0.3, h * 0.26, '#ff8fb1', 2);
  } else if (mode === 'sad') {
    arcSmile(ctx, m.x, m.y + 2, m.w * 0.7, 1.6, tone, 1.6, true);
  } else if (mode === 'happy') {
    arcSmile(ctx, m.x, m.y, m.w, 3.2, tone, 2);
  } else {
    arcSmile(ctx, m.x, m.y, m.w * 0.72, 2.2, tone, 2);
    px(ctx, m.x - m.w * 0.36 - 1, m.y - 1.4, 1.6, 1.6, tone);
    px(ctx, m.x + m.w * 0.36 - 0.6, m.y - 1.4, 1.6, 1.6, tone);
  }
}

/* ---------------- species ---------------- */

function bunny(ctx, c, k, stage) {
  const cx = 80;
  const GY = 134;
  const bodyRy = 17 * k;
  const bodyRx = 20 * k;
  const bodyCy = GY - bodyRy + 3;
  const headRx = 23 * k;
  const headRy = 20.5 * k;
  const headCy = bodyCy - 16 * k;

  // tail
  part(ctx, cx + bodyRx - 1, bodyCy + 4 * k, 6 * k, 6 * k, c.belly);

  // ears behind head
  for (const s of [-1, 1]) {
    const ex = cx + s * 13.5 * k;
    const earBottom = headCy - headRy * 0.2;
    const earTop = earBottom - (26 + stage * 4) * k;
    const earCy = (earTop + earBottom) / 2;
    const earRy = (earBottom - earTop) / 2;
    part(ctx, ex, earCy, 5.4 * k, earRy, c.base);
    oval(ctx, ex, earCy + 1, 2.6 * k, Math.max(1, earRy - 4 * k), mix(c.belly, '#ff9ec4', 0.4));
    if (stage === 2) px(ctx, ex - 2 * k, earCy - earRy + 3 * k, 1.6 * k, 6 * k, c.light);
  }

  // body
  part(ctx, cx, bodyCy, bodyRx, bodyRy, c.base);
  oval(ctx, cx, bodyCy + 3 * k, bodyRx * 0.6, bodyRy * 0.66, c.belly);

  // feet + arms
  for (const s of [-1, 1]) {
    part(ctx, cx + s * 10.5 * k, GY - 4.5 * k, 8 * k, 4.4 * k, c.belly);
    px(ctx, cx + s * 10.5 * k - 1.5 * k, GY - 4 * k, 1.4 * k, 3 * k, mix(c.belly, OUT, 0.18));
    part(ctx, cx + s * (bodyRx - 0.5 * k), bodyCy + 2 * k, 5 * k, 4.6 * k, c.base);
  }

  // head
  part(ctx, cx, headCy, headRx, headRy, c.base);

  // muzzle + blush + nose
  oval(ctx, cx, headCy + 8 * k, 9 * k, 6.6 * k, c.belly);
  for (const s of [-1, 1]) oval(ctx, cx + s * 14 * k, headCy + 5.5 * k, 4.4 * k, 3 * k, c.blush);
  px(ctx, cx - 1.3 * k, headCy + 5.4 * k, 2.6 * k, 1.8 * k, '#e8799b');

  if (stage === 2) {
    for (let i = -1; i <= 1; i++) tri(ctx, cx + i * 7 * k, headCy - headRy + 4, 6 * k, 6 * k, c.light);
  }

  return {
    k,
    cx,
    gy: GY,
    head: { cx, cy: headCy, rx: headRx, ry: headRy },
    body: { cx, cy: bodyCy, rx: bodyRx, ry: bodyRy },
    eyePos: { x: 8.8 * k, y: -1.2 * k, rx: 5.1 * k, ry: 6.9 * k },
    mouth: { x: cx, y: headCy + 10.5 * k, w: 9.5 * k },
    hatY: headCy - headRy - 1,
    neckY: headCy + headRy * 0.92,
    colors: c,
  };
}

function dino(ctx, c, k, stage) {
  const cx = 80;
  const GY = 134;
  const bodyRy = 16.5 * k;
  const bodyRx = 20 * k;
  const bodyCy = GY - bodyRy + 3;
  const headRx = 19 * k;
  const headRy = 15 * k;
  const headCy = bodyCy - 15 * k;

  for (let i = 0; i < 3; i++) {
    part(ctx, cx + bodyRx - 3 * k + i * 7 * k, bodyCy + 5 * k - i * 2.5 * k, (7 - i * 1.7) * k, (6 - i * 1.5) * k, c.base);
  }

  const spikeN = 2 + stage;
  for (let i = 0; i < spikeN; i++) {
    tri(ctx, cx - 9 * k + i * 9 * k, headCy - headRy * 0.55 + (i === 0 ? 4 * k : 0), (8 + stage) * k, (7 + stage * 2) * k, c.light);
  }

  part(ctx, cx, bodyCy, bodyRx, bodyRy, c.base);
  oval(ctx, cx, bodyCy + 3 * k, bodyRx * 0.58, bodyRy * 0.64, c.belly);

  for (const s of [-1, 1]) {
    part(ctx, cx + s * 11 * k, GY - 4 * k, 8.5 * k, 4.4 * k, c.base);
    part(ctx, cx + s * (bodyRx - 1 * k), bodyCy + 1 * k, 5 * k, 4 * k, c.base);
  }

  part(ctx, cx, headCy, headRx, headRy, c.base);

  oval(ctx, cx, headCy + 6 * k, 10.5 * k, 6.4 * k, c.belly);
  px(ctx, cx - 4 * k, headCy + 4 * k, 2 * k, 1.6 * k, mix(c.belly, OUT, 0.45));
  px(ctx, cx + 2 * k, headCy + 4 * k, 2 * k, 1.6 * k, mix(c.belly, OUT, 0.45));
  for (const s of [-1, 1]) oval(ctx, cx + s * 14 * k, headCy + 4.5 * k, 3.6 * k, 2.6 * k, c.blush);

  if (stage === 2) {
    px(ctx, cx - 3.5 * k, headCy + 10 * k, 2 * k, 2 * k, WHITE);
    px(ctx, cx + 1.5 * k, headCy + 10 * k, 2 * k, 2 * k, WHITE);
    for (const s of [-1, 1]) tri(ctx, cx + s * (headRx - 1), headCy - 2 * k, 6 * k, 5 * k, c.light);
  }

  return {
    k,
    cx,
    gy: GY,
    head: { cx, cy: headCy, rx: headRx, ry: headRy },
    body: { cx, cy: bodyCy, rx: bodyRx, ry: bodyRy },
    eyePos: { x: 8 * k, y: -2.5 * k, rx: 5 * k, ry: 6.8 * k },
    mouth: { x: cx, y: headCy + 9 * k, w: 9 * k },
    hatY: headCy - headRy - 1,
    neckY: headCy + headRy * 0.95,
    colors: c,
  };
}

function giraffe(ctx, c, k, stage) {
  const cx = 80;
  const GY = 134;
  const bodyRy = 14.5 * k;
  const bodyRx = 17 * k;
  const bodyCy = GY - bodyRy + 3;
  const neckTop = bodyCy - (32 + stage * 2) * k;
  const headRx = 14 * k;
  const headRy = 11.5 * k;
  const headCy = neckTop - 2 * k;

  part(ctx, cx + 1 * k, (neckTop + bodyCy) / 2 + 3 * k, 7 * k, (bodyCy - neckTop) / 2 + 8 * k, c.base);
  part(ctx, cx, bodyCy, bodyRx, bodyRy, c.base);
  oval(ctx, cx, bodyCy + 2 * k, bodyRx * 0.55, bodyRy * 0.6, c.belly);

  for (const s of [-1, 1]) {
    part(ctx, cx + s * 9 * k, GY - 5 * k, 6.5 * k, 5 * k, c.base);
    px(ctx, cx + s * 9 * k - 2 * k, GY - 2 * k, 4 * k, 2 * k, c.deep);
  }
  part(ctx, cx + bodyRx - 1, bodyCy - 2 * k, 3.4 * k, 4 * k, c.base);
  px(ctx, cx + bodyRx + 1 * k, bodyCy + 4 * k, 2 * k, 4 * k, c.deep);

  part(ctx, cx, headCy, headRx, headRy, c.base);
  oval(ctx, cx, headCy + 4.5 * k, 8.5 * k, 6 * k, c.belly);

  for (const s of [-1, 1]) {
    const ox = cx + s * 7 * k;
    px(ctx, ox - 1 * k, headCy - headRy - 2.5 * k, 2 * k, 3.5 * k, c.dark);
    part(ctx, ox, headCy - headRy - 3.8 * k, 2.6 * k, 2.2 * k, c.light, OUT, 1.4);
    oval(ctx, cx + s * (headRx + 1 * k), headCy + 1 * k, 4 * k, 2.6 * k, c.base);
  }

  const spots = stage === 0 ? 3 : stage === 1 ? 4 : 5;
  for (let i = 0; i < spots; i++) {
    const sy = neckTop + 4 * k + i * 7 * k;
    const sx = cx + 1 * k + (i % 2 === 0 ? -3 * k : 3.4 * k);
    oval(ctx, sx, sy, 2.2 * k, 2 * k, c.dark, 2);
  }
  oval(ctx, cx - 8 * k, bodyCy + 1 * k, 2.6 * k, 2.2 * k, c.dark, 2);
  oval(ctx, cx + 8 * k, bodyCy + 4 * k, 2.4 * k, 2 * k, c.dark, 2);
  for (const s of [-1, 1]) oval(ctx, cx + s * 10 * k, headCy + 3 * k, 3 * k, 2.2 * k, c.blush);

  return {
    k,
    cx,
    gy: GY,
    head: { cx, cy: headCy, rx: headRx, ry: headRy },
    body: { cx, cy: bodyCy, rx: bodyRx, ry: bodyRy },
    eyePos: { x: 5.4 * k, y: -1.4 * k, rx: 4.2 * k, ry: 5.8 * k },
    mouth: { x: cx, y: headCy + 8.5 * k, w: 7 * k },
    hatY: headCy - headRy - 2,
    neckY: headCy + 10 * k,
    colors: c,
  };
}

function monkey(ctx, c, k, stage) {
  const cx = 80;
  const GY = 134;
  const bodyRy = 14.5 * k;
  const bodyRx = 17 * k;
  const bodyCy = GY - bodyRy + 3;
  const headRx = 19 * k;
  const headRy = 17 * k;
  const headCy = bodyCy - 17 * k;

  const tailPts = [
    [cx + bodyRx - 1, bodyCy + 1 * k],
    [cx + bodyRx + 6 * k, bodyCy - 3 * k],
    [cx + bodyRx + 10 * k, bodyCy - 11 * k],
    [cx + bodyRx + 8 * k, bodyCy - 17 * k],
  ];
  for (const [tx, ty] of tailPts) part(ctx, tx, ty, 3.6 * k, 3.6 * k, c.base);

  for (const s of [-1, 1]) {
    part(ctx, cx + s * (headRx - 1 * k), headCy + 1 * k, 6 * k, 6.6 * k, c.base);
    oval(ctx, cx + s * (headRx - 1 * k), headCy + 1 * k, 3 * k, 3.4 * k, c.belly);
  }

  part(ctx, cx, bodyCy, bodyRx, bodyRy, c.base);
  oval(ctx, cx, bodyCy + 2 * k, bodyRx * 0.55, bodyRy * 0.6, c.belly);

  for (const s of [-1, 1]) {
    part(ctx, cx + s * 10 * k, GY - 4 * k, 7.5 * k, 4.2 * k, c.base);
    part(ctx, cx + s * (bodyRx - 0.5 * k), bodyCy + 1 * k, 5 * k, 6 * k, c.base);
    oval(ctx, cx + s * (bodyRx - 0.5 * k), bodyCy + 6 * k, 4 * k, 3.4 * k, c.belly);
  }

  part(ctx, cx, headCy, headRx, headRy, c.base);
  oval(ctx, cx, headCy + 6 * k, 11 * k, 8 * k, c.belly);
  px(ctx, cx - 2 * k, headCy + 4.6 * k, 1.6 * k, 1.4 * k, OUT);
  px(ctx, cx + 0.6 * k, headCy + 4.6 * k, 1.6 * k, 1.4 * k, OUT);

  if (stage >= 1) {
    for (let i = -1; i <= 1; i++) tri(ctx, cx + i * 5 * k, headCy - headRy + 3, 5 * k, 7 * k, c.dark);
  }
  if (stage === 2) {
    for (const s of [-1, 1]) oval(ctx, cx + s * 8 * k, headCy + 9 * k, 4 * k, 3 * k, mix(c.blush, '#ff7ea8', 0.2));
  }

  return {
    k,
    cx,
    gy: GY,
    head: { cx, cy: headCy, rx: headRx, ry: headRy },
    body: { cx, cy: bodyCy, rx: bodyRx, ry: bodyRy },
    eyePos: { x: 7.4 * k, y: -2.6 * k, rx: 5.2 * k, ry: 7 * k },
    mouth: { x: cx, y: headCy + 8.5 * k, w: 8 * k },
    hatY: headCy - headRy - 1,
    neckY: headCy + headRy * 0.95,
    colors: c,
  };
}

function nummy(ctx, c, k, stage, t = 0) {
  const cx = 80;
  const GY = 134;
  const rx = (23 + stage * 2) * k;
  const ry = (22 + stage * 2) * k;
  const wob = Math.sin(t * 2.1) * 1.4;
  const cy = GY - ry + 4 + wob;
  const headCy = cy - ry * 0.28;

  for (const s of [-1, 1]) {
    part(ctx, cx + s * (rx - 1), cy - 2 * k, 5 * k, 5.5 * k, c.base);
    part(ctx, cx + s * 9 * k, GY - 3.5 * k, 7.5 * k, 4 * k, c.belly);
  }

  part(ctx, cx, cy, rx, ry, c.base);
  oval(ctx, cx, cy + ry * 0.32, rx * 0.62, ry * 0.5, c.belly);
  oval(ctx, cx - rx * 0.3, cy - ry * 0.45, rx * 0.24, ry * 0.16, c.light);

  oval(ctx, cx + rx * 0.52, cy - ry * 0.35, 3.4 * k, 2.6 * k, c.dark, 2);
  oval(ctx, cx + rx * 0.62, cy - ry * 0.05, 2.4 * k, 2 * k, c.dark, 2);
  if (stage >= 1) oval(ctx, cx - rx * 0.55, cy + ry * 0.2, 2.6 * k, 2.2 * k, c.dark, 2);

  for (const s of [-1, 1]) oval(ctx, cx + s * (rx * 0.55), cy + ry * 0.16, 4 * k, 3 * k, c.blush);

  return {
    k,
    cx,
    gy: GY,
    head: { cx, cy: headCy, rx: rx * 0.86, ry: ry * 0.72 },
    body: { cx, cy, rx, ry },
    eyePos: { x: rx * 0.34, y: -ry * 0.18, rx: 6 * k, ry: 8 * k },
    mouth: { x: cx, y: cy + ry * 0.26, w: 9 * k },
    hatY: cy - ry - 1,
    neckY: cy + ry * 0.42,
    colors: c,
  };
}

function banana(ctx, c, k, stage) {
  const cx = 80;
  const GY = 134;
  const h = (58 + stage * 5) * k;
  const pts = [];
  const N = 11;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const y = GY - 7 * k - u * h;
    const sway = Math.sin(u * Math.PI) * 8.5 * k;
    const x = cx - sway + 2 * k;
    const r = 6.6 * k + Math.sin(u * Math.PI) * 5 * k;
    pts.push({ x, y, r });
  }
  for (const p of pts) oval(ctx, p.x, p.y, p.r + 2, p.r + 2, c.outline, 2);
  for (const p of pts) oval(ctx, p.x, p.y, p.r, p.r, c.base, 2);
  for (const p of pts) oval(ctx, p.x - p.r * 0.34, p.y, p.r * 0.3, p.r * 0.6, c.light, 2);
  for (let i = 1; i < pts.length - 1; i += 2) {
    const p = pts[i];
    px(ctx, p.x + p.r * 0.5, p.y - p.r * 0.5, 1.4, p.r, mix(c.base, OUT, 0.18));
  }

  const top = pts[N];
  part(ctx, top.x + 1 * k, top.y - 5 * k, 2.4 * k, 4 * k, '#8ac47a');
  px(ctx, top.x + 1 * k, top.y - 9 * k, 2 * k, 4 * k, '#5f9c58');
  const bot = pts[0];
  oval(ctx, bot.x, bot.y + 3 * k, 2 * k, 1.8 * k, c.deep, 2);

  for (const s of [-1, 1]) {
    part(ctx, cx + s * 7 * k, GY - 3 * k, 6 * k, 3.4 * k, c.belly);
    oval(ctx, cx + s * 9 * k, bot.y - h * 0.38, 3 * k, 2.2 * k, c.blush);
  }

  const headCy = GY - 7 * k - h * 0.72;
  return {
    k,
    cx,
    gy: GY,
    head: { cx: cx + 1 * k, cy: headCy, rx: 11 * k, ry: 12 * k },
    body: { cx: pts[3].x, cy: pts[3].y, rx: 10 * k, ry: 9 * k },
    eyePos: { x: 5 * k, y: -0.5 * k, rx: 4 * k, ry: 5.6 * k },
    mouth: { x: cx + 1 * k, y: headCy + 7 * k, w: 6.5 * k },
    hatY: headCy - 13 * k,
    neckY: headCy + 10.5 * k,
    colors: c,
  };
}

const SPECIES_DRAW = { bunny, dino, giraffe, monkey, nummy, banana };

/* ---------------- clothing ---------------- */

const GOLD = '#ffcf4d';
const GOLD_D = '#e2a32a';
const RED = '#f0616f';
const RED_D = '#c73f52';
const PINK = '#ff9ec4';
const PINK_D = '#d9679a';
const BLUE = '#8ec5f5';
const BLUE_D = '#4f86c6';
const GREEN = '#7fd6a0';
const GREEN_D = '#46a878';
const CREAM = '#fff6e0';
const BANANA = '#ffe08a';
const BANANA_D = '#d9a940';

function hoodArc(ctx, cx, cy, rx, ry, thick, color) {
  const steps = 26;
  const from = Math.PI * 1.02;
  const to = Math.PI * 1.98;
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    oval(ctx, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, thick, thick, color, 2);
  }
}

function rectO(ctx, x, y, w, h, fill, o = OUT, t = 1.5) {
  px(ctx, x - t, y - t, w + t * 2, h + t * 2, o);
  px(ctx, x, y, w, h, fill);
}

function bowWing(ctx, cx, cy, w, h, dir, color) {
  for (let i = 0; i < w; i++) {
    const t = i / w;
    const hh = h * (0.34 + 0.66 * t);
    px(ctx, cx + dir * i, cy - hh / 2, 1.4, hh, color);
  }
}

function decoBow(ctx, x, y, w, h, color, colorD) {
  bowWing(ctx, x, y + h * 0.5, w * 0.55, h, -1, color);
  bowWing(ctx, x, y + h * 0.5, w * 0.55, h, 1, color);
  rectO(ctx, x - w * 0.1, y + h * 0.42, w * 0.2, h * 0.62, colorD, OUT, 1);
  px(ctx, x - w * 0.34, y + h * 0.32, w * 0.16, 2, mix(color, WHITE, 0.55));
}

const HAT_DRAW = {
  crown(ctx, L) {
    const w = L.head.rx * 1.45;
    const h = L.head.rx * 0.66;
    const x = L.head.cx - w / 2;
    const y = L.hatY - h + 1;
    rectO(ctx, x, y + h * 0.52, w, h * 0.48, GOLD, OUT, 1.6);
    px(ctx, x + 2, y + h * 0.52 + 2, w - 4, 2, GOLD_D);
    for (let i = 0; i < 3; i++) {
      const sx = x + (w / 6) * (1 + i * 2);
      tri(ctx, sx, y + h * 0.56, w * 0.26, h * 0.6, GOLD);
      px(ctx, sx - 1, y + h * 0.2, 2, 2, GOLD_D);
    }
    for (let i = 0; i < 3; i++) {
      px(ctx, x + (w / 3) * (i + 0.5) - 1.5, y + h * 0.68, 3, 3, i === 1 ? '#ff8fb1' : '#8fd3ff');
    }
  },
  sprout(ctx, L) {
    const x = L.head.cx;
    const y = L.hatY;
    px(ctx, x - 1.4, y - 10, 2.8, 11, GREEN_D);
    oval(ctx, x - 5, y - 11, 4.6, 3, GREEN, 2);
    oval(ctx, x + 5, y - 13, 4.6, 3, GREEN, 2);
    px(ctx, x - 7, y - 12, 4, 1.4, GREEN_D);
    px(ctx, x + 3, y - 14, 4, 1.4, GREEN_D);
  },
  propeller(ctx, L, t) {
    const cx = L.head.cx;
    const y = L.hatY;
    const brimW = L.head.rx * 1.55;
    const domeR = L.head.rx * 0.6;
    const domeH = L.head.rx * 0.48;
    // dome sits above the head top
    oval(ctx, cx, y - domeH * 0.18, domeR + 1.5, domeH + 1.5, OUT, 2);
    oval(ctx, cx, y - domeH * 0.18, domeR, domeH, BLUE, 2);
    oval(ctx, cx - domeR * 0.36, y - domeH * 0.62, domeR * 0.3, domeH * 0.32, mix(BLUE, WHITE, 0.55), 2);
    // brim rests on the top of the head, never over the eyes
    rectO(ctx, cx - brimW / 2, y + 0.5, brimW, 3, BLUE_D, OUT, 1.2);
    // propeller
    const topY = y - domeH * 1.35;
    px(ctx, cx - 1, topY, 2, 7, '#6a4f92');
    ctx.save();
    ctx.translate(cx, topY + 1);
    ctx.rotate(t * 8);
    px(ctx, -brimW * 0.44, -1, brimW * 0.88, 2, RED);
    px(ctx, -1, -domeH * 0.9, 2, domeH * 1.8, GOLD);
    ctx.restore();
    px(ctx, cx - 2.5, topY - 2, 5, 3, GOLD);
  },
  bow(ctx, L) {
    const w = L.head.rx * 0.95;
    const h = L.head.rx * 0.5;
    const x = L.head.cx + L.head.rx * 0.3;
    const y = L.hatY - h * 0.85;
    decoBow(ctx, x, y, w, h, PINK, PINK_D);
  },
};

const NECK_DRAW = {
  bandana(ctx, L) {
    const w = L.head.rx * 1.5;
    const y = L.neckY - 2;
    triDown(ctx, L.head.cx, y, w, w * 0.62, RED);
    px(ctx, L.head.cx - w * 0.5, y - 2, w, 3, RED_D);
    for (let i = 0; i < 3; i++) px(ctx, L.head.cx - w * 0.26 + i * w * 0.22, y + w * 0.16 + (i % 2) * 3, 2, 2, CREAM);
  },
  bowtie(ctx, L) {
    const w = L.head.rx * 0.6;
    const h = L.head.rx * 0.3;
    decoBow(ctx, L.head.cx, L.neckY - h * 0.6, w, h, '#7fb8f0', BLUE_D);
  },
  scarf(ctx, L) {
    const w = L.head.rx * 1.42;
    const y = L.neckY - 3;
    rectO(ctx, L.head.cx - w / 2, y, w, 6, RED, OUT, 1.4);
    for (let i = 0; i < 4; i++) px(ctx, L.head.cx - w / 2 + 4 + i * (w / 4), y + 1, 2, 4, RED_D);
    const tx = L.head.cx + w * 0.16;
    rectO(ctx, tx, y + 4, 5, 12, RED, OUT, 1.2);
    px(ctx, tx + 1, y + 8, 3, 2, RED_D);
    px(ctx, tx + 1, y + 12, 3, 2, RED_D);
    px(ctx, tx, y + 15, 5, 2, CREAM);
  },
};

const EYE_DRAW = {
  shades(ctx, L) {
    const y = L.head.cy + L.eyePos.y;
    const w = Math.min(L.eyePos.rx * 1.8, L.eyePos.x * 1.38);
    const h = L.eyePos.ry * 1.15;
    for (const s of [-1, 1]) {
      const x = L.head.cx + s * L.eyePos.x - w / 2;
      rectO(ctx, x, y - h / 2, w, h, '#34283f', OUT, 1.2);
      px(ctx, x + 2, y - h / 2 + 2, w * 0.34, 1.6, 'rgba(255,255,255,0.75)');
      px(ctx, x + 2, y - h / 2 + 4, 2, 2, 'rgba(255,255,255,0.45)');
    }
    // bridge + temples
    px(ctx, L.head.cx - L.eyePos.x + w / 2, y - 1, L.eyePos.x * 2 - w, 2, '#34283f');
    for (const s of [-1, 1]) {
      const x = L.head.cx + s * L.eyePos.x;
      px(ctx, x + s * w * 0.5, y - 1.5, s * L.eyePos.rx * 0.45, 2, '#34283f');
    }
  },
  glasses(ctx, L) {
    const y = L.head.cy + L.eyePos.y;
    const rx = Math.min(L.eyePos.rx * 1.45, L.eyePos.x * 1.15);
    const ry = L.eyePos.ry * 1.2;
    for (const s of [-1, 1]) {
      const x = L.head.cx + s * L.eyePos.x;
      ovalRing(ctx, x, y, rx, ry, 2, OUT, 2);
      px(ctx, x - rx * 0.6, y - ry * 0.5, 2, 2, WHITE);
    }
    px(ctx, L.head.cx - L.eyePos.x + rx, y - 1, L.eyePos.x * 2 - rx * 2, 2, OUT);
  },
};

const OUTFIT_DRAW = {
  overalls(ctx, L) {
    const b = L.body;
    const pw = b.rx * 1.5;
    const ph = b.ry * 0.66;
    const x = b.cx - pw / 2;
    const y = b.cy + b.ry * 0.18;
    // trousers follow the body curve
    part(ctx, b.cx, y + ph * 0.42, pw / 2, ph / 2, BLUE, OUT, 1.3);
    px(ctx, b.cx - 1.5, y + ph * 0.62, 3, ph * 0.4, BLUE_D);
    px(ctx, b.cx - pw * 0.34, y + ph * 0.8, pw * 0.68, 2, BLUE_D);
    // bib (never rides up onto the chin)
    const bw = b.rx * 0.92;
    const bh = b.ry * 0.44;
    const by = Math.max(y - bh + 2, L.neckY - 3);
    rectO(ctx, b.cx - bw / 2, by, bw, bh + 2, BLUE, OUT, 1.4);
    // shoulder straps
    for (const s of [-1, 1]) {
      const sx = b.cx + s * bw * 0.34;
      rectO(ctx, sx - 1.8, by - b.ry * 0.34, 3.6, b.ry * 0.4, BLUE_D, OUT, 1);
      px(ctx, sx - 2, by + 1.5, 4, 3.4, GOLD);
    }
    // pocket
    px(ctx, b.cx - bw * 0.22, y + ph * 0.16, bw * 0.44, ph * 0.42, BLUE_D);
    px(ctx, b.cx - bw * 0.22, y + ph * 0.16, bw * 0.44, 1.5, mix(BLUE, WHITE, 0.4));
  },
  hoodie(ctx, L) {
    const b = L.body;
    // hood rim sits just OUTSIDE the head so the face stays clear
    const hx = L.head.cx;
    const hy = L.head.cy + L.head.ry * 0.05;
    const pad = 2.6;
    hoodArc(ctx, hx, hy, L.head.rx + pad, L.head.ry + pad, 3.4, BANANA_D);
    hoodArc(ctx, hx, hy, L.head.rx + pad, L.head.ry + pad, 1.7, BANANA);

    // body: rounded garment hugging the torso
    const y = Math.max(b.cy - b.ry * 0.1, L.neckY - 2);
    const h = Math.max(11, b.cy + b.ry * 0.88 - y);
    const rx = b.rx * 1.32;
    part(ctx, b.cx, y + h / 2, rx, h / 2, BANANA, OUT, 1.4);
    px(ctx, b.cx - rx * 0.84, y + h - 4.5, rx * 1.68, 3, BANANA_D);
    // pocket
    px(ctx, b.cx - rx * 0.42, y + h * 0.42, rx * 0.84, h * 0.34, BANANA_D);
    px(ctx, b.cx - rx * 0.36, y + h * 0.46, rx * 0.72, h * 0.24, BANANA);
    // drawstrings
    for (const s of [-1, 1]) {
      px(ctx, b.cx + s * rx * 0.22 - 1, y + 1, 2, 6, CREAM);
      px(ctx, b.cx + s * rx * 0.22 - 1.5, y + 6, 3, 3, GOLD);
    }
  },
};

// The cape is drawn as two wings attached at the shoulders, so it layers
// correctly over every species without needing a separate back pass.
OUTFIT_DRAW.cape = (ctx, L) => {
  const b = L.body;
  const topY = L.neckY - 1;
  const bottom = b.cy + b.ry * 1.12;
  for (const s of [-1, 1]) {
    for (let y = topY; y < bottom; y += 2) {
      const t = (y - topY) / (bottom - topY);
      const inner = b.cx + s * (b.rx * (0.7 + 0.08 * t));
      const outer = b.cx + s * (b.rx * (0.7 + 1.15 * t));
      ctx.fillStyle = RED;
      ctx.fillRect(Math.round(Math.min(inner, outer)), Math.round(y), Math.max(1, Math.round(Math.abs(outer - inner))), 2);
      ctx.fillStyle = OUT;
      ctx.fillRect(Math.round(outer) - (s < 0 ? 2 : 0), Math.round(y), 2, 2);
    }
  }
  const cw = b.rx * 1.5;
  rectO(ctx, b.cx - cw / 2, topY - 4, cw, 5, RED_D, OUT, 1.2);
  px(ctx, b.cx - 2, topY - 2, 4, 4, GOLD);
};

export const CLOTHING = [
  { id: 'sprout', cat: 'hat', name: 'Sprout Leaf', cost: 30, draw: HAT_DRAW.sprout },
  { id: 'bow', cat: 'hat', name: 'Big Bow', cost: 40, draw: HAT_DRAW.bow },
  { id: 'crown', cat: 'hat', name: 'Tiny Crown', cost: 60, draw: HAT_DRAW.crown },
  { id: 'propeller', cat: 'hat', name: 'Propeller Cap', cost: 70, draw: HAT_DRAW.propeller },
  { id: 'bandana', cat: 'neck', name: 'Red Bandana', cost: 35, draw: NECK_DRAW.bandana },
  { id: 'bowtie', cat: 'neck', name: 'Bow Tie', cost: 45, draw: NECK_DRAW.bowtie },
  { id: 'scarf', cat: 'neck', name: 'Cozy Scarf', cost: 60, draw: NECK_DRAW.scarf },
  { id: 'glasses', cat: 'eyes', name: 'Round Specs', cost: 50, draw: EYE_DRAW.glasses },
  { id: 'shades', cat: 'eyes', name: 'Pixel Shades', cost: 70, draw: EYE_DRAW.shades },
  { id: 'overalls', cat: 'outfit', name: 'Overalls', cost: 80, draw: OUTFIT_DRAW.overalls },
  { id: 'cape', cat: 'outfit', name: 'Hero Cape', cost: 90, draw: (ctx, L) => OUTFIT_DRAW.cape(ctx, L) },
  { id: 'hoodie', cat: 'outfit', name: 'Banana Hoodie', cost: 100, draw: OUTFIT_DRAW.hoodie },
];

export function findClothing(id) {
  return CLOTHING.find((c) => c.id === id) || null;
}

/* ---------------- full pet ---------------- */

export function drawPet(ctx, pet, opts = {}) {
  const t = opts.t || 0;
  const expression = opts.expression || 'normal';
  const open = opts.open == null ? 1 : opts.open;
  const chomp = opts.chomp == null ? 0 : opts.chomp;
  const stage = Math.max(0, Math.min(2, pet.stage | 0));
  const k = STAGE_K[stage];
  const c = palette(pet.tint || '#ffb3c7');
  const equipped = opts.equipped || {};
  const coat = equipped.outfit ? findClothing(equipped.outfit) : null;
  const neck = equipped.neck ? findClothing(equipped.neck) : null;
  const specs = equipped.eyes ? findClothing(equipped.eyes) : null;
  const hat = equipped.hat ? findClothing(equipped.hat) : null;

  oval(ctx, 80, 137, 30 * k, 5 * k, 'rgba(90, 70, 120, 0.16)', 2);

  const drawFn = SPECIES_DRAW[pet.species] || bunny;
  const L = drawFn(ctx, c, k, stage, t);

  if (coat && coat.draw) coat.draw(ctx, L, t);
  if (neck) neck.draw(ctx, L, t);

  drawEyes(ctx, L, expression, { open });

  if (specs) specs.draw(ctx, L, t);
  if (hat) hat.draw(ctx, L, t);

  drawMouth(ctx, L, expression === 'droop' ? 'sad' : expression === 'chomp' ? 'happy' : 'normal', chomp);

  return L;
}

/* ---------------- food ---------------- */

export const FOODS = [
  { id: 'strawberry', name: 'Strawberry', hunger: 22, thirst: 0, happy: 5, points: 10, xp: 14 },
  { id: 'onigiri', name: 'Rice Ball', hunger: 30, thirst: 0, happy: 3, points: 12, xp: 18 },
  { id: 'cookie', name: 'Cookie', hunger: 16, thirst: 0, happy: 8, points: 9, xp: 12 },
  { id: 'cake', name: 'Cake Slice', hunger: 24, thirst: 0, happy: 12, points: 14, xp: 20 },
  { id: 'carrot', name: 'Carrot', hunger: 20, thirst: 6, happy: 4, points: 9, xp: 13 },
  { id: 'melon', name: 'Watermelon', hunger: 14, thirst: 18, happy: 7, points: 11, xp: 15 },
];

function foodEyes(ctx, cx, cy, gap, blink) {
  for (const s of [-1, 1]) {
    const ex = cx + s * gap;
    if (blink) {
      px(ctx, ex - 1.4, cy, 3, 1.6, DARK);
    } else {
      px(ctx, ex - 1.4, cy - 2, 2.8, 3.6, DARK);
      px(ctx, ex - 1, cy - 1.6, 1.2, 1.2, WHITE);
    }
  }
}

function foodSmile(ctx, cx, cy, w) {
  arcSmile(ctx, cx, cy, w, 1.1, DARK, 1, false);
  px(ctx, cx - w / 2 - 2, cy - 1, 2, 1.4, 'rgba(255,120,160,0.5)');
  px(ctx, cx + w / 2, cy - 1, 2, 1.4, 'rgba(255,120,160,0.5)');
}

const FOOD_DRAW = {
  strawberry(ctx, blink) {
    oval(ctx, 16, 17, 10.5, 10, '#e8446b', 1);
    oval(ctx, 16, 15, 9, 8, '#f0577d', 1);
    oval(ctx, 16, 19, 6.5, 6, '#ff8098', 1);
    for (const [sx, sy] of [[10, 14], [20, 14], [12, 21], [21, 20], [16, 24]]) px(ctx, sx, sy, 1.6, 2, '#ffe9a8');
    for (const s of [-1, 1]) tri(ctx, 16 + s * 4, 9, 8, 4, '#5fbf7a');
    tri(ctx, 16, 8, 5, 4, '#7fd6a0');
    px(ctx, 15, 5, 2, 3, '#46a878');
    foodEyes(ctx, 15.5, 16, 4.6, blink);
    foodSmile(ctx, 15.5, 20, 5);
  },
  onigiri(ctx, blink) {
    oval(ctx, 16, 21, 10, 8, '#f4f0e2', 1);
    tri(ctx, 16, 15, 20, 11, '#f4f0e2');
    px(ctx, 10, 20, 12, 9, '#2f3c3a');
    px(ctx, 10, 20, 12, 1.5, '#4c5d58');
    foodEyes(ctx, 15.5, 13, 4.4, blink);
    foodSmile(ctx, 15.5, 17, 4.4);
    px(ctx, 24, 8, 1.6, 4, '#ffe9a8');
    px(ctx, 22.8, 9.6, 4, 1.6, '#ffe9a8');
  },
  cookie(ctx, blink) {
    oval(ctx, 16, 17, 11, 10, '#d8a05c', 1);
    oval(ctx, 16, 17, 9.6, 8.6, '#e9bb7c', 1);
    for (const [sx, sy] of [[9, 12], [22, 13], [11, 22], [21, 21], [16, 9]]) oval(ctx, sx, sy, 1.8, 1.8, '#5c3a26', 1);
    foodEyes(ctx, 15.5, 16, 4.4, blink);
    foodSmile(ctx, 15.5, 20, 5);
  },
  cake(ctx, blink) {
    oval(ctx, 16, 27, 12, 2.4, '#dcd0f0', 1);
    ctx.fillStyle = '#ffd9a8';
    ctx.fillRect(8, 15, 16, 11);
    px(ctx, 8, 15, 16, 3, '#fff1dc');
    px(ctx, 8, 19, 16, 2, '#ff9ec4');
    px(ctx, 8, 24, 16, 2, '#f7b8d4');
    oval(ctx, 16, 12, 3.4, 3.2, '#e8446b', 1);
    px(ctx, 16, 8, 1.6, 4, '#46a878');
    foodEyes(ctx, 15.5, 18, 4.2, blink);
    foodSmile(ctx, 15.5, 22, 4.4);
  },
  carrot(ctx, blink) {
    triDown(ctx, 16, 10, 14, 18, '#ff9a4d');
    px(ctx, 12, 15, 3, 1.4, '#e07a30');
    px(ctx, 18, 20, 3, 1.4, '#e07a30');
    for (const s of [-1, 1]) tri(ctx, 16 + s * 4, 12, 7, 5, '#5fbf7a');
    px(ctx, 15, 5, 2, 6, '#46a878');
    foodEyes(ctx, 15.5, 17, 3.8, blink);
    foodSmile(ctx, 15.5, 21, 4);
  },
  melon(ctx, blink) {
    ctx.fillStyle = '#5fbf7a';
    for (let y = 0; y < 12; y++) {
      const w = Math.sqrt(Math.max(0, 1 - ((y - 12) / 12) ** 2)) * 13;
      ctx.fillRect(Math.round(16 - w), 12 + y, Math.round(w * 2), 1);
    }
    px(ctx, 4, 22, 24, 3, '#8ee0a4');
    oval(ctx, 16, 17, 12, 11, '#ff7a90', 1);
    px(ctx, 4, 20, 24, 4, '#5fbf7a');
    oval(ctx, 16, 16, 10.6, 9.4, '#ff7a90', 1);
    for (const [sx, sy] of [[9, 13], [22, 14], [11, 21], [21, 20]]) px(ctx, sx, sy, 1.8, 2.2, '#3c2b52');
    foodEyes(ctx, 15.5, 14, 4.4, blink);
    foodSmile(ctx, 15.5, 18, 5);
  },
};

export function drawFood(ctx, id, opts = {}) {
  const fn = FOOD_DRAW[id];
  if (fn) fn(ctx, !!opts.blink);
}

/* ---------------- icons ---------------- */

const ICON_SPECS = {
  apple: {
    rows: ['..L.....', '...X....', '.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..'],
    pal: { X: '#ff7a90', L: '#5fbf7a' },
  },
  heart: {
    rows: ['.X...X.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    pal: { X: '#ff5c8a' },
  },
  drop: {
    rows: ['....X...', '...XXX..', '..XXXXX.', '..XXXXX.', '.XXXXXXX', '.XXXXXXX', '..XXXXX.', '...XXX..'],
    pal: { X: '#6ec4ff' },
  },
  flame: {
    rows: ['...X....', '..XX....', '..XXX...', '.XXXXX..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXX..', '..XXX...'],
    pal: { X: '#ff9a4d' },
  },
  coin: {
    rows: ['..XXX..', '.XXXXX.', 'XX...XX', 'XX.X.XX', 'XX...XX', '.XXXXX.', '..XXX..'],
    pal: { X: '#ffcf4d' },
  },
};

export function drawIcon(ctx, name) {
  const size = ctx.canvas.width || 16;
  ctx.clearRect(0, 0, size, size);
  const spec = ICON_SPECS[name];
  if (!spec) return;
  const s = Math.max(1, Math.floor(size / 8));
  const w = spec.rows[0].length * s;
  const h = spec.rows.length * s;
  map(ctx, Math.round((size - w) / 2), Math.round((size - h) / 2), spec.rows, spec.pal, s);
  px(ctx, Math.round((size - w) / 2) + s * 2, Math.round((size - h) / 2) + s * 3, s, s, '#fff7d1');
}

/* ---------------- thumbnails + shop icons ---------------- */

const thumbCanvas = document.createElement('canvas');
thumbCanvas.width = 160;
thumbCanvas.height = 160;
const thumbCtx = thumbCanvas.getContext('2d');

export function drawPetThumb(ctx, pet) {
  const size = ctx.canvas.width || 48;
  thumbCtx.clearRect(0, 0, 160, 160);
  drawPet(thumbCtx, pet, { t: 0, expression: 'normal' });
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(thumbCanvas, 32, 16, 96, 96, 0, 0, size, size);
}

function iconLayout() {
  return {
    k: 1,
    cx: 24,
    gy: 44,
    head: { cx: 24, cy: 20, rx: 10.5, ry: 9.5 },
    body: { cx: 24, cy: 33, rx: 9.5, ry: 8.5 },
    eyePos: { x: 4, y: -0.5, rx: 2.3, ry: 3 },
    mouth: { x: 24, y: 26.5, w: 5.5 },
    hatY: 9.5,
    neckY: 27.5,
    colors: palette('#e9d9ff'),
  };
}

export function drawItemIcon(ctx, item) {
  const size = ctx.canvas.width || 48;
  ctx.clearRect(0, 0, size, size);
  const L = iconLayout();
  part(ctx, L.head.cx, L.head.cy, L.head.rx, L.head.ry, '#fdf4ff', OUT, 1.4);
  part(ctx, L.body.cx, L.body.cy + 1, L.body.rx, L.body.ry, '#f7ecff', OUT, 1.4);
  for (const s of [-1, 1]) px(ctx, L.head.cx + s * L.eyePos.x - 1, L.head.cy + L.eyePos.y - 1, 2, 2.6, DARK);
  arcSmile(ctx, L.head.cx, L.head.cy + 4.4, 4.4, 1, DARK, 1);
  if (item.draw) item.draw(ctx, L, 0);
}

/* ---------------- scenes ---------------- */

export const SCENES = [
  { id: 'meadow', name: 'MEADOW' },
  { id: 'sunset', name: 'SUNSET' },
  { id: 'night', name: 'NIGHT' },
  { id: 'shore', name: 'SHORE' },
];

const GROUND = 132;

function skyBands(ctx, colors) {
  const h = 160 / colors.length;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, Math.round(i * h), 160, Math.ceil(h) + 1);
  });
}

const FLIES = [
  [28, 60, 0],
  [56, 44, 1.7],
  [104, 70, 3.1],
  [132, 48, 4.4],
  [76, 92, 2.4],
  [18, 98, 5.2],
];

function fireflies(ctx, t, color) {
  for (const [x, y, phase] of FLIES) {
    const fx = x + Math.sin(t * 0.7 + phase) * 7;
    const fy = y + Math.cos(t * 0.9 + phase) * 5;
    ctx.globalAlpha = 0.3 + Math.abs(Math.sin(t * 1.6 + phase)) * 0.6;
    px(ctx, fx, fy, 1.6, 1.6, color);
  }
  ctx.globalAlpha = 1;
}

function sceneMeadow(ctx, t) {
  skyBands(ctx, ['#f8fdea', '#eef8db', '#e2f1ca', '#d6ebbc']);
  oval(ctx, 116, 30, 17, 5, 'rgba(255,255,255,0.85)');
  oval(ctx, 104, 33, 11, 4, 'rgba(255,255,255,0.85)');
  oval(ctx, 44, 22, 12, 4, 'rgba(255,255,255,0.65)');
  px(ctx, 0, GROUND, 160, 28, '#c9e5a8');
  px(ctx, 0, GROUND, 160, 2, '#ddf0c3');
  oval(ctx, 80, 139, 44, 7, 'rgba(150, 214, 178, 0.35)');
  tri(ctx, 26, 137, 7, 8, 'rgba(120, 196, 150, 0.5)');
  tri(ctx, 33, 138, 5, 6, 'rgba(120, 196, 150, 0.42)');
  tri(ctx, 133, 137, 6, 7, 'rgba(120, 196, 150, 0.5)');
  tri(ctx, 141, 139, 5, 5, 'rgba(120, 196, 150, 0.4)');
  for (const [x, y] of [[36, 148], [122, 151]]) {
    px(ctx, x, y, 3, 3, '#fff2f7');
    px(ctx, x + 1, y + 1, 1.4, 1.4, '#ffb0cc');
  }
  fireflies(ctx, t, 'rgba(255, 214, 120, 0.9)');
}

function sceneSunset(ctx, t) {
  skyBands(ctx, ['#ffeab2', '#ffd29a', '#ffb08e', '#f08c92', '#c9729a', '#91609a']);
  oval(ctx, 80, 112, 22, 22, '#ffeaa6', 1);
  oval(ctx, 80, 112, 16, 16, '#ffd166', 1);
  for (const [x, y] of [[38, 50], [46, 47], [52, 51], [96, 62], [103, 59]]) px(ctx, x, y, 3, 1.6, 'rgba(80, 50, 90, 0.55)');
  tri(ctx, 34, 136, 96, 40, '#7a5490');
  tri(ctx, 118, 136, 108, 52, '#63457e');
  px(ctx, 0, GROUND, 160, 28, '#4d3467');
  triangleShadow(ctx);
  fireflies(ctx, t, 'rgba(255, 232, 170, 0.95)');
}

function triangleShadow(ctx) {
  ctx.globalAlpha = 0.25;
  oval(ctx, 80, 139, 44, 6, '#1d1230');
  ctx.globalAlpha = 1;
}

const STARS = [
  [16, 14], [34, 26], [52, 12], [70, 22], [88, 10], [104, 20], [124, 14], [142, 26],
  [24, 42], [60, 38], [96, 40], [134, 44], [44, 56], [112, 56], [76, 68], [150, 66],
];

function sceneNight(ctx, t) {
  skyBands(ctx, ['#221b3e', '#281f47', '#2e2450', '#342959']);
  STARS.forEach(([x, y], i) => {
    ctx.globalAlpha = 0.4 + Math.abs(Math.sin(t * 1.1 + i)) * 0.6;
    px(ctx, x, y, 1.6, 1.6, '#fff6cf');
  });
  ctx.globalAlpha = 1;
  oval(ctx, 122, 30, 12, 12, '#fdf6d8', 1);
  oval(ctx, 128, 26, 10, 10, '#2a2148', 1);
  tri(ctx, 40, 136, 110, 42, '#1b1735');
  tri(ctx, 122, 136, 120, 56, '#151128');
  px(ctx, 0, GROUND, 160, 28, '#221c3c');
  triangleShadow(ctx);
  fireflies(ctx, t, 'rgba(190, 230, 255, 0.85)');
}

function sceneShore(ctx, t) {
  skyBands(ctx, ['#e3f6ff', '#cfecff', '#b8e2ff', '#a2d8fb']);
  oval(ctx, 118, 34, 11, 11, '#fff3bf', 1);
  oval(ctx, 118, 34, 7, 7, '#ffe38a', 1);
  px(ctx, 0, 100, 160, 32, '#79c6f2');
  px(ctx, 0, 100, 160, 2, '#a9e2fb');
  px(ctx, 0, 108, 160, 3, '#96d8f8');
  px(ctx, 0, 116, 160, 3, '#96d8f8');
  px(ctx, 0, 124, 160, 3, '#a9e2fb');
  for (let i = 0; i < 6; i++) {
    const x = ((t * 14 + i * 34) % 210) - 24;
    px(ctx, x, 104 + (i % 3) * 7, 10, 1.8, 'rgba(255,255,255,0.8)');
  }
  px(ctx, 0, GROUND, 160, 28, '#f7e7bb');
  px(ctx, 0, GROUND, 160, 2, '#fff3d2');
  for (const [x, y] of [[30, 144], [120, 148], [96, 154]]) px(ctx, x, y, 2, 2, '#e7c98f');
  oval(ctx, 80, 139, 44, 7, 'rgba(214, 178, 120, 0.3)');
}

const SCENE_DRAW = {
  meadow: sceneMeadow,
  sunset: sceneSunset,
  night: sceneNight,
  shore: sceneShore,
};

export function drawScene(ctx, id, t) {
  (SCENE_DRAW[id] || sceneMeadow)(ctx, t);
}

/* ---------------- playground toys + doors ---------------- */

const TOY_DRAW = {
  ball(ctx) {
    oval(ctx, 20, 23, 12, 11, '#ff8a5c', 1);
    oval(ctx, 20, 23, 9, 8, '#ffa87a', 1);
    px(ctx, 8, 22, 24, 2.4, '#ffe0b0');
    oval(ctx, 15, 17, 3.2, 2.8, 'rgba(255,255,255,0.75)', 1);
  },
  frisbee(ctx) {
    oval(ctx, 20, 27, 15, 8, '#3f9c72', 1);
    oval(ctx, 20, 25, 14, 6.5, '#7fd6a0', 1);
    oval(ctx, 20, 24, 9, 4, '#a8e6c0', 1);
    px(ctx, 8, 24, 24, 1.4, 'rgba(255,255,255,0.8)');
  },
  bubbles(ctx) {
    const bubble = (cx, cy, r) => {
      part(ctx, cx, cy, r, r, 'rgba(190, 235, 255, 0.55)', '#5fb6e8', 1);
      px(ctx, cx - r / 2, cy - r / 2, 1.8, 1.8, '#ffffff');
    };
    bubble(14, 14, 5.5);
    bubble(27, 23, 4.5);
    bubble(17, 30, 3.2);
  },
};

export function drawToy(ctx, id) {
  const size = ctx.canvas.width || 40;
  ctx.clearRect(0, 0, size, size);
  const fn = TOY_DRAW[id];
  if (fn) fn(ctx);
}

export function drawDoor(ctx, accent) {
  const size = ctx.canvas.width || 40;
  ctx.clearRect(0, 0, size, size);
  px(ctx, 5, 2, 30, 37, '#f1e4ff');
  px(ctx, 5, 2, 30, 2.4, '#cbb0f2');
  px(ctx, 8, 7, 24, 32, accent);
  px(ctx, 8, 7, 24, 2, 'rgba(255,255,255,0.6)');
  px(ctx, 8, 21, 24, 2, 'rgba(68,51,87,0.16)');
  px(ctx, 27, 24, 3.2, 3.2, '#ffd166');
  px(ctx, 4, 38, 32, 2.4, '#7d5fb8');
}
