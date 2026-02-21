import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '../services/socket';
import '../styles/GameCanvas.css';

const TILE = 32;
const LERP_SPEED = 0.1;
const POS_LERP = 0.22;
const TWO_PI = Math.PI * 2;

// ── Rich color palettes ──────────────────────────────────────────────────────
const PLAYER_COLORS = [
  { owned: '#e84040', ownedLight: '#ff7070', ownedEdge: '#b01818', trail: '#ff6060', trailGlow: 'rgba(255,96,96,0.6)', head: '#ff4444', headGrad: '#cc1111', ring: '#ff9999', bar: 'linear-gradient(90deg,#e84040,#ff6060)', particle: '#ff8888' },
  { owned: '#4080e8', ownedLight: '#70a8ff', ownedEdge: '#1848b0', trail: '#60a0ff', trailGlow: 'rgba(96,160,255,0.6)', head: '#4488ff', headGrad: '#1155cc', ring: '#99bbff', bar: 'linear-gradient(90deg,#4080e8,#60a0ff)', particle: '#88bbff' },
  { owned: '#40c860', ownedLight: '#70f090', ownedEdge: '#189028', trail: '#60e880', trailGlow: 'rgba(96,232,128,0.6)', head: '#44dd66', headGrad: '#11aa33', ring: '#88ff99', bar: 'linear-gradient(90deg,#40c860,#60e880)', particle: '#88ff99' },
  { owned: '#e8a030', ownedLight: '#ffc860', ownedEdge: '#b07010', trail: '#ffc050', trailGlow: 'rgba(255,192,80,0.6)', head: '#ffaa33', headGrad: '#cc7700', ring: '#ffcc77', bar: 'linear-gradient(90deg,#e8a030,#ffc050)', particle: '#ffcc77' },
  { owned: '#a050e0', ownedLight: '#c880ff', ownedEdge: '#7020b0', trail: '#c070ff', trailGlow: 'rgba(192,112,255,0.6)', head: '#bb55ff', headGrad: '#8822cc', ring: '#dd99ff', bar: 'linear-gradient(90deg,#a050e0,#c070ff)', particle: '#dd99ff' },
  { owned: '#40c8c8', ownedLight: '#70f0f0', ownedEdge: '#109090', trail: '#60e8e8', trailGlow: 'rgba(96,232,232,0.6)', head: '#44dddd', headGrad: '#11aaaa', ring: '#88ffff', bar: 'linear-gradient(90deg,#40c8c8,#60e8e8)', particle: '#88ffff' },
];

const GROUND_A = '#eee8cc';
const GROUND_B = '#e6deba';

function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// ── Element skin drawing ─────────────────────────────────────────────────────
// Each function draws the unique character skin at (cx, cy) with radius r
const SKIN_DRAWERS = [
  // 0: LAVA 🔥 — molten body with floating rock chunks and fire corona
  function drawLava(ctx, cx, cy, r, time, bob, isLocal) {
    // Fire corona
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TWO_PI + time * 2;
      const flicker = 0.7 + Math.sin(time * 8 + i * 1.3) * 0.3;
      const fr = r + 3 + Math.sin(time * 5 + i * 2) * 3;
      const fx = cx + Math.cos(a) * fr;
      const fy = cy + Math.sin(a) * fr + bob;
      ctx.fillStyle = `rgba(255,${80 + i * 20},0,${0.35 * flicker})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 3 + Math.sin(time * 6 + i) * 1.5, 0, TWO_PI);
      ctx.fill();
    }
    // Molten body
    const bodyG = ctx.createRadialGradient(cx - 2, cy - 3 + bob, 1, cx, cy + bob, r);
    bodyG.addColorStop(0, '#ffcc00');
    bodyG.addColorStop(0.35, '#ff6600');
    bodyG.addColorStop(0.7, '#cc2200');
    bodyG.addColorStop(1, '#661100');
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.fillStyle = bodyG;
    ctx.fill();
    // Dark crust patches
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * TWO_PI + time * 0.3;
      const d = r * 0.45;
      ctx.fillStyle = 'rgba(60,20,0,0.4)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * d, cy + bob + Math.sin(ang) * d, 3, 0, TWO_PI);
      ctx.fill();
    }
    // Rock chunks orbiting
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * TWO_PI + time * 1.5;
      const orbitR = r + 6 + Math.sin(time * 2 + i) * 2;
      const rx = cx + Math.cos(ang) * orbitR;
      const ry = cy + bob + Math.sin(ang) * orbitR * 0.5 - 2;
      ctx.fillStyle = '#553322';
      ctx.fillRect(rx - 2.5, ry - 2, 5, 4);
      ctx.fillStyle = '#884422';
      ctx.fillRect(rx - 1.5, ry - 1, 3, 2);
    }
    // Outline
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.strokeStyle = isLocal ? '#fff' : '#ff8844';
    ctx.lineWidth = isLocal ? 2.5 : 1.5;
    ctx.stroke();
  },

  // 1: OCEAN 🌊 — watery globe with waves, anchor symbol, bubbles
  function drawOcean(ctx, cx, cy, r, time, bob, isLocal) {
    // Water body
    const bodyG = ctx.createRadialGradient(cx - 2, cy - 3 + bob, 1, cx, cy + bob, r);
    bodyG.addColorStop(0, '#88ccff');
    bodyG.addColorStop(0.4, '#3388ee');
    bodyG.addColorStop(0.8, '#1155aa');
    bodyG.addColorStop(1, '#0a3366');
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.fillStyle = bodyG;
    ctx.fill();
    // Wave lines across body
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r - 1, 0, TWO_PI);
    ctx.clip();
    for (let w = 0; w < 3; w++) {
      const wy = cy + bob - r + (w + 1) * (r * 2 / 4);
      ctx.strokeStyle = `rgba(120,200,255,${0.3 - w * 0.08})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -r; x <= r; x += 2) {
        const yOff = Math.sin((x + time * 40 + w * 15) * 0.12) * 2.5;
        if (x === -r) ctx.moveTo(cx + x, wy + yOff);
        else ctx.lineTo(cx + x, wy + yOff);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Bubbles floating up
    for (let i = 0; i < 4; i++) {
      const bx = cx - 5 + (i * 4);
      const rawY = cy + bob + r - ((time * 20 + i * 12) % (r * 2));
      const by = rawY;
      const dist = Math.sqrt((bx - cx) ** 2 + (by - (cy + bob)) ** 2);
      if (dist < r - 2) {
        ctx.strokeStyle = 'rgba(180,220,255,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(bx, by, 1.5 + (i % 2), 0, TWO_PI);
        ctx.stroke();
      }
    }
    // Anchor symbol
    ctx.strokeStyle = 'rgba(200,230,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + bob - 4);
    ctx.lineTo(cx, cy + bob + 4);
    ctx.moveTo(cx - 4, cy + bob + 2);
    ctx.arc(cx, cy + bob + 2, 4, Math.PI, 0, true);
    ctx.stroke();
    // Outline
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.strokeStyle = isLocal ? '#fff' : '#66aaff';
    ctx.lineWidth = isLocal ? 2.5 : 1.5;
    ctx.stroke();
  },

  // 2: FUNGI 🍄 — mushroom cap with spots, stem visible below
  function drawFungi(ctx, cx, cy, r, time, bob, isLocal) {
    // Stem
    ctx.fillStyle = '#ccbb99';
    ctx.fillRect(cx - 4, cy + bob, 8, r * 0.6);
    ctx.fillStyle = '#bbaa88';
    ctx.fillRect(cx - 3, cy + bob + 2, 2, r * 0.4);
    // Mushroom cap (dome)
    const capG = ctx.createRadialGradient(cx - 2, cy - 4 + bob, 2, cx, cy + bob - 1, r + 2);
    capG.addColorStop(0, '#77ff88');
    capG.addColorStop(0.4, '#33bb44');
    capG.addColorStop(0.8, '#118822');
    capG.addColorStop(1, '#0a5518');
    ctx.beginPath();
    ctx.arc(cx, cy + bob - 1, r, Math.PI, 0, false);
    ctx.closePath();
    ctx.fillStyle = capG;
    ctx.fill();
    // Full body circle
    const bodyG = ctx.createRadialGradient(cx, cy + bob, 2, cx, cy + bob, r);
    bodyG.addColorStop(0, '#55dd66');
    bodyG.addColorStop(0.6, '#33aa44');
    bodyG.addColorStop(1, '#228833');
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.fillStyle = bodyG;
    ctx.fill();
    // Spots on cap
    const spots = [[- 5, -5, 3], [4, -7, 2.5], [-2, -2, 2], [6, -3, 2]];
    for (const [sx, sy, sr] of spots) {
      const pulse = 1 + Math.sin(time * 2 + sx) * 0.15;
      ctx.fillStyle = 'rgba(255,255,200,0.35)';
      ctx.beginPath();
      ctx.arc(cx + sx, cy + bob + sy, sr * pulse, 0, TWO_PI);
      ctx.fill();
    }
    // Tiny spores floating
    for (let i = 0; i < 3; i++) {
      const a = time * 1.5 + i * 2.1;
      const sd = r + 5 + Math.sin(time * 2 + i) * 3;
      ctx.fillStyle = 'rgba(150,255,150,0.3)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * sd, cy + bob + Math.sin(a) * sd * 0.6 - 4, 1.5, 0, TWO_PI);
      ctx.fill();
    }
    // Outline
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.strokeStyle = isLocal ? '#fff' : '#66ee77';
    ctx.lineWidth = isLocal ? 2.5 : 1.5;
    ctx.stroke();
  },

  // 3: EARTH 🌍 — earthy globe with continents, leaves orbiting
  function drawEarth(ctx, cx, cy, r, time, bob, isLocal) {
    // Earth body
    const bodyG = ctx.createRadialGradient(cx - 2, cy - 3 + bob, 1, cx, cy + bob, r);
    bodyG.addColorStop(0, '#ffcc66');
    bodyG.addColorStop(0.35, '#dd9922');
    bodyG.addColorStop(0.7, '#aa7711');
    bodyG.addColorStop(1, '#664400');
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.fillStyle = bodyG;
    ctx.fill();
    // Continent patches
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r - 1, 0, TWO_PI);
    ctx.clip();
    const continents = [[-4, -3, 5, 4], [3, 1, 4, 3], [-6, 3, 3, 3], [2, -6, 4, 3]];
    for (const [x, y, w, h] of continents) {
      ctx.fillStyle = 'rgba(100,160,60,0.4)';
      ctx.beginPath();
      ctx.ellipse(cx + x, cy + bob + y, w, h, 0.3, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
    // Orbiting leaves
    for (let i = 0; i < 3; i++) {
      const la = (i / 3) * TWO_PI + time * 1.2;
      const ld = r + 5 + Math.sin(time * 2 + i * 1.5) * 2;
      const lx = cx + Math.cos(la) * ld;
      const ly = cy + bob + Math.sin(la) * ld * 0.5 - 2;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(la + time);
      // Leaf shape
      ctx.fillStyle = i % 2 === 0 ? '#66aa33' : '#88cc44';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 2, 0, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = '#447722';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.stroke();
      ctx.restore();
    }
    // Soil dots
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TWO_PI + 0.5;
      const d = r * 0.55;
      ctx.fillStyle = 'rgba(80,50,20,0.25)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + bob + Math.sin(a) * d, 1.5, 0, TWO_PI);
      ctx.fill();
    }
    // Outline
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.strokeStyle = isLocal ? '#fff' : '#ccaa55';
    ctx.lineWidth = isLocal ? 2.5 : 1.5;
    ctx.stroke();
  },

  // 4: CRYSTAL 💎 — faceted gem body with sparkle points, prismatic light
  function drawCrystal(ctx, cx, cy, r, time, bob, isLocal) {
    // Prismatic aura
    const auraG = ctx.createRadialGradient(cx, cy + bob, r * 0.5, cx, cy + bob, r + 6);
    auraG.addColorStop(0, 'rgba(200,120,255,0)');
    auraG.addColorStop(0.7, 'rgba(200,120,255,0.08)');
    auraG.addColorStop(1, 'rgba(200,120,255,0)');
    ctx.fillStyle = auraG;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r + 6, 0, TWO_PI);
    ctx.fill();
    // Gem body (hexagonal shape inside circle)
    const bodyG = ctx.createRadialGradient(cx - 3, cy - 3 + bob, 2, cx, cy + bob, r);
    bodyG.addColorStop(0, '#eeccff');
    bodyG.addColorStop(0.3, '#cc77ff');
    bodyG.addColorStop(0.6, '#9933dd');
    bodyG.addColorStop(1, '#5511aa');
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TWO_PI - Math.PI / 6;
      const px = cx + Math.cos(a) * (r - 1);
      const py = cy + bob + Math.sin(a) * (r - 1);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = bodyG;
    ctx.fill();
    // Facet lines
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + bob + Math.sin(a) * r * 0.9);
      ctx.lineTo(cx - Math.cos(a) * r * 0.9, cy + bob - Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    // Sparkle points
    for (let i = 0; i < 4; i++) {
      const sa = time * 3 + i * 1.6;
      const flash = Math.max(0, Math.sin(sa));
      if (flash > 0.5) {
        const sx = cx + Math.cos(sa * 0.7) * r * 0.6;
        const sy = cy + bob + Math.sin(sa * 1.1) * r * 0.4;
        const sSize = 2 + flash * 2;
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
        // 4-point star
        ctx.beginPath();
        ctx.moveTo(sx, sy - sSize);
        ctx.lineTo(sx + sSize * 0.3, sy);
        ctx.lineTo(sx, sy + sSize);
        ctx.lineTo(sx - sSize * 0.3, sy);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx - sSize, sy);
        ctx.lineTo(sx, sy + sSize * 0.3);
        ctx.lineTo(sx + sSize, sy);
        ctx.lineTo(sx, sy - sSize * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Outline
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TWO_PI - Math.PI / 6;
      const px = cx + Math.cos(a) * (r - 1);
      const py = cy + bob + Math.sin(a) * (r - 1);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = isLocal ? '#fff' : '#cc88ff';
    ctx.lineWidth = isLocal ? 2.5 : 1.5;
    ctx.stroke();
  },

  // 5: FROST ❄️ — icy sphere with snowflake patterns, ice crystals orbiting
  function drawFrost(ctx, cx, cy, r, time, bob, isLocal) {
    // Frost mist
    const mistG = ctx.createRadialGradient(cx, cy + bob, r * 0.3, cx, cy + bob, r + 5);
    mistG.addColorStop(0, 'rgba(180,240,255,0)');
    mistG.addColorStop(0.6, 'rgba(180,240,255,0.1)');
    mistG.addColorStop(1, 'rgba(180,240,255,0)');
    ctx.fillStyle = mistG;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r + 5, 0, TWO_PI);
    ctx.fill();
    // Ice body
    const bodyG = ctx.createRadialGradient(cx - 2, cy - 3 + bob, 2, cx, cy + bob, r);
    bodyG.addColorStop(0, '#ccffff');
    bodyG.addColorStop(0.3, '#77ddee');
    bodyG.addColorStop(0.7, '#33aacc');
    bodyG.addColorStop(1, '#1177aa');
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.fillStyle = bodyG;
    ctx.fill();
    // Snowflake pattern inside
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r - 1, 0, TWO_PI);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI + time * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + bob + Math.sin(a) * r * 0.8);
      ctx.lineTo(cx - Math.cos(a) * r * 0.8, cy + bob - Math.sin(a) * r * 0.8);
      ctx.stroke();
      // Branch ticks
      for (let j = -1; j <= 1; j += 2) {
        const bx = cx + Math.cos(a) * r * 0.4 * j;
        const by = cy + bob + Math.sin(a) * r * 0.4 * j;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 0.8) * 3, by + Math.sin(a + 0.8) * 3);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a - 0.8) * 3, by + Math.sin(a - 0.8) * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Orbiting ice crystals
    for (let i = 0; i < 3; i++) {
      const ia = (i / 3) * TWO_PI + time * 1.8;
      const id = r + 6 + Math.sin(time * 2.5 + i) * 2;
      const ix = cx + Math.cos(ia) * id;
      const iy = cy + bob + Math.sin(ia) * id * 0.5 - 2;
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(time * 3 + i);
      ctx.fillStyle = 'rgba(180,240,255,0.5)';
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(2, 0);
      ctx.lineTo(0, 3);
      ctx.lineTo(-2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Outline
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, TWO_PI);
    ctx.strokeStyle = isLocal ? '#fff' : '#88eeff';
    ctx.lineWidth = isLocal ? 2.5 : 1.5;
    ctx.stroke();
  },
];

// ── Themed trail tile decorations per element ────────────────────────────────
const TRAIL_DECOR = [
  // 0: LAVA — lava cracks
  function(ctx, px, py, time, col, row) {
    ctx.strokeStyle = 'rgba(255,200,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 4);
    ctx.lineTo(px + 16, py + 14);
    ctx.lineTo(px + 26, py + 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,100,0,0.25)';
    ctx.beginPath();
    ctx.arc(px + 16, py + 16, 2 + Math.sin(time * 6 + col) * 1, 0, TWO_PI);
    ctx.fill();
  },
  // 1: OCEAN — ripples
  function(ctx, px, py, time, col, row) {
    const cx = px + TILE / 2, cy = py + TILE / 2;
    for (let i = 0; i < 2; i++) {
      const rr = 4 + i * 5 + Math.sin(time * 3 + col + row) * 2;
      ctx.strokeStyle = `rgba(150,210,255,${0.25 - i * 0.08})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TWO_PI);
      ctx.stroke();
    }
  },
  // 2: FUNGI — spore dots
  function(ctx, px, py, time, col, row) {
    for (let i = 0; i < 3; i++) {
      const sx = px + 8 + (i * 9);
      const sy = py + 10 + Math.sin(time * 2.5 + i + col) * 4;
      ctx.fillStyle = `rgba(150,255,150,${0.3 + Math.sin(time * 3 + i) * 0.1})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, TWO_PI);
      ctx.fill();
    }
  },
  // 3: EARTH — root lines
  function(ctx, px, py, time, col, row) {
    ctx.strokeStyle = 'rgba(120,80,30,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 16);
    ctx.quadraticCurveTo(px + 16, py + 12 + Math.sin(time + col) * 3, px + 28, py + 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(100,160,40,0.3)';
    ctx.beginPath();
    ctx.arc(px + 16, py + 10, 2, 0, TWO_PI);
    ctx.fill();
  },
  // 4: CRYSTAL — shard
  function(ctx, px, py, time, col, row) {
    const flash = Math.sin(time * 4 + col * 0.7 + row * 1.1);
    if (flash > 0) {
      ctx.fillStyle = `rgba(220,180,255,${flash * 0.35})`;
      const scx = px + 16, scy = py + 16;
      ctx.beginPath();
      ctx.moveTo(scx, scy - 4);
      ctx.lineTo(scx + 1.5, scy);
      ctx.lineTo(scx, scy + 4);
      ctx.lineTo(scx - 1.5, scy);
      ctx.closePath();
      ctx.fill();
    }
  },
  // 5: FROST — ice crystal
  function(ctx, px, py, time, col, row) {
    const scx = px + 16, scy = py + 16;
    ctx.strokeStyle = 'rgba(180,240,255,0.3)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI + time * 0.5;
      ctx.beginPath();
      ctx.moveTo(scx + Math.cos(a) * 5, scy + Math.sin(a) * 5);
      ctx.lineTo(scx - Math.cos(a) * 5, scy - Math.sin(a) * 5);
      ctx.stroke();
    }
  },
];

// ── Element-themed tile fill renderers ───────────────────────────────────────
// Each draws the tile background matching the element's character skin
const TILE_FILL = [
  // 0: LAVA — molten tile with dark crust patches, glowing cracks, ember dots
  function(ctx, px, py, col, row, time, glow, pc) {
    const seed = (col * 7 + row * 13) % 17;
    // Base molten fill — dark red with orange variation
    ctx.fillStyle = seed < 8 ? '#8b2010' : '#702018';
    ctx.globalAlpha = 0.55 + glow * 0.25;
    ctx.fillRect(px, py, TILE, TILE);
    // Hot inner glow
    ctx.fillStyle = '#cc4400';
    ctx.globalAlpha = 0.15 + Math.sin(time * 2 + col * 0.3 + row * 0.5) * 0.06;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.globalAlpha = 1;
    // Lava cracks
    if (seed < 6) {
      ctx.strokeStyle = `rgba(255,180,0,${0.2 + Math.sin(time * 3 + col + row) * 0.08})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px + 4 + seed, py + 6);
      ctx.lineTo(px + 16, py + 14 + (seed % 4));
      ctx.lineTo(px + 28, py + 10);
      ctx.stroke();
    }
    // Dark crust rock
    if (seed > 10) {
      ctx.fillStyle = 'rgba(40,15,5,0.35)';
      ctx.beginPath();
      ctx.arc(px + 10 + (seed % 5) * 3, py + 12 + (seed % 3) * 4, 3 + seed % 2, 0, TWO_PI);
      ctx.fill();
    }
    // Glowing ember dot
    if (seed % 3 === 0) {
      const flicker = Math.sin(time * 6 + col * 1.1 + row * 0.9);
      if (flicker > 0) {
        ctx.fillStyle = `rgba(255,200,50,${flicker * 0.35})`;
        ctx.beginPath();
        ctx.arc(px + 8 + (seed % 7) * 3, py + 8 + (seed % 5) * 4, 1.5, 0, TWO_PI);
        ctx.fill();
      }
    }
  },

  // 1: OCEAN — water tile with animated waves, foam, depth variation
  function(ctx, px, py, col, row, time, glow, pc) {
    const seed = (col * 7 + row * 13) % 17;
    // Deep water base
    ctx.fillStyle = seed < 9 ? '#1a4488' : '#163d7a';
    ctx.globalAlpha = 0.55 + glow * 0.25;
    ctx.fillRect(px, py, TILE, TILE);
    // Lighter water layer
    ctx.fillStyle = '#2266aa';
    ctx.globalAlpha = 0.12 + Math.sin(time * 1.5 + col * 0.4 + row * 0.6) * 0.06;
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.globalAlpha = 1;
    // Wave lines
    for (let w = 0; w < 2; w++) {
      const wy = py + 8 + w * 12;
      ctx.strokeStyle = `rgba(130,200,255,${0.15 - w * 0.04})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let x = 0; x <= TILE; x += 3) {
        const yOff = Math.sin((x + time * 30 + col * 8 + w * 20) * 0.15) * 2;
        if (x === 0) ctx.moveTo(px + x, wy + yOff);
        else ctx.lineTo(px + x, wy + yOff);
      }
      ctx.stroke();
    }
    // Foam dots near edges
    if (seed < 4) {
      ctx.fillStyle = 'rgba(200,230,255,0.18)';
      ctx.beginPath();
      ctx.arc(px + 6 + seed * 5, py + 5 + (seed % 3) * 8, 1.5, 0, TWO_PI);
      ctx.fill();
    }
    // Light shimmer
    const shimmer = Math.sin(time * 4 + col * 1.5 + row * 0.8);
    if (shimmer > 0.7) {
      ctx.fillStyle = `rgba(180,220,255,${(shimmer - 0.7) * 0.6})`;
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 1.5, 0, TWO_PI);
      ctx.fill();
    }
  },

  // 2: FUNGI — mossy tile with mushroom patches, spores, mycelium network
  function(ctx, px, py, col, row, time, glow, pc) {
    const seed = (col * 7 + row * 13) % 17;
    // Mossy green base
    ctx.fillStyle = seed < 9 ? '#1a5528' : '#1e4d25';
    ctx.globalAlpha = 0.55 + glow * 0.25;
    ctx.fillRect(px, py, TILE, TILE);
    // Lighter moss layer
    ctx.fillStyle = '#2d7840';
    ctx.globalAlpha = 0.1;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.globalAlpha = 1;
    // Mycelium threads
    if (seed < 7) {
      ctx.strokeStyle = 'rgba(180,220,160,0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px + 2, py + 10 + seed % 8);
      ctx.quadraticCurveTo(px + 16, py + 16 + Math.sin(seed) * 4, px + 30, py + 12 + seed % 6);
      ctx.stroke();
    }
    // Mini mushroom sprites
    if (seed > 11) {
      const mx = px + 8 + (seed % 4) * 5;
      const my = py + 20;
      ctx.fillStyle = 'rgba(190,170,130,0.25)';
      ctx.fillRect(mx - 1, my, 2, 5);
      ctx.fillStyle = 'rgba(100,200,100,0.25)';
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, Math.PI, 0);
      ctx.fill();
      // Cap spots
      ctx.fillStyle = 'rgba(255,255,200,0.2)';
      ctx.beginPath();
      ctx.arc(mx - 1, my - 1, 1, 0, TWO_PI);
      ctx.fill();
    }
    // Floating spore
    if (seed % 4 === 0) {
      const sy = py + 8 + Math.sin(time * 2 + col + row) * 5;
      ctx.fillStyle = `rgba(150,255,150,${0.18 + Math.sin(time * 3 + seed) * 0.06})`;
      ctx.beginPath();
      ctx.arc(px + 12 + (seed % 6) * 2, sy, 1.2, 0, TWO_PI);
      ctx.fill();
    }
  },

  // 3: EARTH — soil tile with grass tufts, pebbles, leaf litter, root veins
  function(ctx, px, py, col, row, time, glow, pc) {
    const seed = (col * 7 + row * 13) % 17;
    // Rich soil base
    ctx.fillStyle = seed < 9 ? '#7a5520' : '#6e4c1c';
    ctx.globalAlpha = 0.55 + glow * 0.25;
    ctx.fillRect(px, py, TILE, TILE);
    // Lighter soil patch
    ctx.fillStyle = '#946830';
    ctx.globalAlpha = 0.1;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.globalAlpha = 1;
    // Grass tufts on top edge
    if (seed < 6) {
      const gx = px + 5 + seed * 4;
      ctx.strokeStyle = 'rgba(80,160,40,0.3)';
      ctx.lineWidth = 1;
      const sway = Math.sin(time * 1.5 + col + seed) * 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, py + 4);
      ctx.lineTo(gx - 2 + sway, py - 2);
      ctx.moveTo(gx, py + 4);
      ctx.lineTo(gx + 1 + sway, py - 3);
      ctx.moveTo(gx, py + 4);
      ctx.lineTo(gx + 3 + sway, py - 1);
      ctx.stroke();
    }
    // Pebbles
    if (seed > 12) {
      ctx.fillStyle = 'rgba(140,120,90,0.3)';
      ctx.beginPath();
      ctx.ellipse(px + 10 + seed % 5 * 3, py + 18 + seed % 4 * 2, 2.5, 1.8, 0.3, 0, TWO_PI);
      ctx.fill();
    }
    // Root vein
    if (seed > 7 && seed < 12) {
      ctx.strokeStyle = 'rgba(100,70,30,0.18)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px, py + 16 + seed % 5);
      ctx.quadraticCurveTo(px + 16, py + 14 + Math.sin(seed * 0.5) * 4, px + TILE, py + 18);
      ctx.stroke();
    }
    // Leaf
    if (seed % 5 === 0) {
      ctx.save();
      ctx.translate(px + 20, py + 12);
      ctx.rotate(seed * 0.8 + Math.sin(time * 0.8) * 0.15);
      ctx.fillStyle = 'rgba(100,170,50,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.5, 1.8, 0, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,100,30,0.15)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.stroke();
      ctx.restore();
    }
  },

  // 4: CRYSTAL — gem faceted tile with prismatic light, sparkles, shard patterns
  function(ctx, px, py, col, row, time, glow, pc) {
    const seed = (col * 7 + row * 13) % 17;
    // Deep purple gem base
    ctx.fillStyle = seed < 9 ? '#3a1866' : '#321558';
    ctx.globalAlpha = 0.55 + glow * 0.25;
    ctx.fillRect(px, py, TILE, TILE);
    // Lighter inner facet
    ctx.fillStyle = '#5522aa';
    ctx.globalAlpha = 0.12;
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.globalAlpha = 1;
    // Facet lines (gem cut pattern)
    ctx.strokeStyle = 'rgba(200,160,255,0.1)';
    ctx.lineWidth = 0.6;
    // Diagonal facet
    ctx.beginPath();
    ctx.moveTo(px, py + (seed % 3) * 10);
    ctx.lineTo(px + TILE, py + TILE - (seed % 4) * 8);
    ctx.stroke();
    if (seed < 10) {
      ctx.beginPath();
      ctx.moveTo(px + (seed % 5) * 6, py);
      ctx.lineTo(px + TILE - (seed % 3) * 8, py + TILE);
      ctx.stroke();
    }
    // Sparkle flash
    const flash = Math.sin(time * 3 + col * 1.1 + row * 0.8);
    if (flash > 0.5 && seed % 3 === 0) {
      const sx = px + 6 + (seed % 5) * 5;
      const sy = py + 6 + (seed % 4) * 5;
      const s = 2 + (flash - 0.5) * 3;
      ctx.fillStyle = `rgba(255,255,255,${(flash - 0.5) * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy - s);
      ctx.lineTo(sx + s * 0.3, sy);
      ctx.lineTo(sx, sy + s);
      ctx.lineTo(sx - s * 0.3, sy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx - s, sy);
      ctx.lineTo(sx, sy + s * 0.3);
      ctx.lineTo(sx + s, sy);
      ctx.lineTo(sx, sy - s * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    // Prismatic rainbow shimmer strip
    if (seed < 5) {
      const prismY = py + 10 + seed * 3;
      const prismAlpha = 0.06 + Math.sin(time * 2 + col) * 0.03;
      ctx.fillStyle = `rgba(255,180,200,${prismAlpha})`;
      ctx.fillRect(px + 4, prismY, TILE - 8, 2);
    }
  },

  // 5: FROST — icy tile with frost patterns, snow specks, crystalline veins
  function(ctx, px, py, col, row, time, glow, pc) {
    const seed = (col * 7 + row * 13) % 17;
    // Ice blue base
    ctx.fillStyle = seed < 9 ? '#1a6688' : '#18607e';
    ctx.globalAlpha = 0.55 + glow * 0.25;
    ctx.fillRect(px, py, TILE, TILE);
    // Lighter ice layer
    ctx.fillStyle = '#2288aa';
    ctx.globalAlpha = 0.1;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.globalAlpha = 1;
    // Frost crystal pattern
    if (seed < 8) {
      const fcx = px + 16, fcy = py + 16;
      ctx.strokeStyle = 'rgba(200,240,255,0.12)';
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + seed * 0.5;
        ctx.beginPath();
        ctx.moveTo(fcx + Math.cos(a) * 6, fcy + Math.sin(a) * 6);
        ctx.lineTo(fcx - Math.cos(a) * 6, fcy - Math.sin(a) * 6);
        ctx.stroke();
        // Branch ticks
        const bx = fcx + Math.cos(a) * 3;
        const by = fcy + Math.sin(a) * 3;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 0.8) * 2.5, by + Math.sin(a + 0.8) * 2.5);
        ctx.stroke();
      }
    }
    // Snow specks
    if (seed > 10) {
      ctx.fillStyle = 'rgba(230,245,255,0.2)';
      ctx.beginPath();
      ctx.arc(px + 8 + seed % 5 * 4, py + 7 + seed % 4 * 5, 1.2, 0, TWO_PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 20 + seed % 3 * 3, py + 22 + seed % 2 * 4, 1, 0, TWO_PI);
      ctx.fill();
    }
    // Icicle shimmer
    const iceFlash = Math.sin(time * 2.5 + col * 0.9 + row * 1.2);
    if (iceFlash > 0.6 && seed % 4 === 0) {
      ctx.fillStyle = `rgba(220,250,255,${(iceFlash - 0.6) * 0.4})`;
      ctx.beginPath();
      ctx.arc(px + 16, py + 10, 1.5, 0, TWO_PI);
      ctx.fill();
    }
  },
];

// ── Particle system ──────────────────────────────────────────────────────────
class ParticlePool {
  constructor(max = 300) {
    this.particles = [];
    this.max = max;
  }
  emit(x, y, color, count = 6, speed = 2) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const angle = Math.random() * TWO_PI;
      const vel = 0.5 + Math.random() * speed;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: 1,
        decay: 0.015 + Math.random() * 0.025,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
  draw(ctx, camX, camY) {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.size * p.life, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ── Main component ───────────────────────────────────────────────────────────
export function GameCanvas({ roomCode, playerName, playerId, onLeaveRoom, onStatsUpdate }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const [flashCapture, setFlashCapture] = useState(false);
  const [viewportSize, setViewportSize] = useState({ w: 800, h: 600 });
  const prevScoreRef = useRef(0);
  const playerIdRef = useRef(playerId);
  const roomCodeRef = useRef(roomCode);
  const onStatsUpdateRef = useRef(onStatsUpdate);
  const gameStateRef = useRef(null);
  const animFrameRef = useRef(null);
  const frameCountRef = useRef(0);

  // Smooth camera
  const camRef = useRef({ x: -1, y: -1, initialized: false });
  // Player position interpolation
  const playerPosRef = useRef(new Map());
  // Particle systems
  const trailParticles = useRef(new ParticlePool(200));
  const captureParticles = useRef(new ParticlePool(300));
  // Previous trail sizes for detecting new trail tiles
  const prevTrailSizeRef = useRef(new Map());
  // Death animation
  const deathAnimRef = useRef({ active: false, progress: 0 });
  // Previous owned sizes for detecting capture
  const prevOwnedRef = useRef(new Map());
  // Previous owned tile sets for flip animation
  const prevOwnedSetsRef = useRef(new Map());
  // Tile flip animations: key "x,y" -> { start: timestamp, colorIndex, delay }
  const tileAnimsRef = useRef(new Map());

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate; }, [onStatsUpdate]);

  // ── Viewport resize ────────────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setViewportSize({ w: rect.width, h: rect.height - 90 });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      const moves = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
      };
      if (moves[e.key]) {
        e.preventDefault();
        socketService.emit('player:move', moves[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Socket listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleGameUpdate = (data) => {
      if (data && data.roomCode === roomCodeRef.current) {
        const gs = data.gameState;
        gameStateRef.current = gs;
        setGameState(gs);

        if (gs.players) {
          const posMap = playerPosRef.current;
          for (const p of gs.players) {
            const existing = posMap.get(p.id);
            if (existing) {
              existing.targetX = p.x;
              existing.targetY = p.y;
            } else {
              posMap.set(p.id, { x: p.x, y: p.y, targetX: p.x, targetY: p.y });
            }

            // Detect new trail tiles -> emit particles
            const prevSize = prevTrailSizeRef.current.get(p.id) || 0;
            if (p.trail && p.trail.length > prevSize && p.trail.length > 0) {
              const lastKey = p.trail[p.trail.length - 1];
              const [tx, ty] = lastKey.split(',').map(Number);
              const pc = PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0];
              trailParticles.current.emit(tx * TILE + TILE / 2, ty * TILE + TILE / 2, pc.particle, 4, 1.5);
            }
            prevTrailSizeRef.current.set(p.id, p.trail ? p.trail.length : 0);

            // Detect capture (owned size jumped) -> burst particles + flip animation
            const prevOwned = prevOwnedRef.current.get(p.id) || 0;
            if (p.owned && p.owned.length > prevOwned + 5) {
              const pc = PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0];
              captureParticles.current.emit(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, pc.particle, 20, 4);

              // Find newly captured tiles and schedule flip animations
              const prevSet = prevOwnedSetsRef.current.get(p.id);
              if (prevSet && p.owned) {
                const now = performance.now();
                let idx = 0;
                for (const k of p.owned) {
                  if (!prevSet.has(k)) {
                    tileAnimsRef.current.set(k, {
                      start: now,
                      colorIndex: p.colorIndex,
                      delay: Math.min(idx * 12, 600), // stagger up to 600ms
                    });
                    idx++;
                  }
                }
              }
            }
            prevOwnedRef.current.set(p.id, p.owned ? p.owned.length : 0);
            prevOwnedSetsRef.current.set(p.id, p.owned ? new Set(p.owned) : new Set());
          }
          const activeIds = new Set(gs.players.map(p => p.id));
          for (const id of posMap.keys()) if (!activeIds.has(id)) posMap.delete(id);
        }

        const local = gs.players?.find(p => p.id === playerIdRef.current);
        if (local) {
          if (local.score > prevScoreRef.current && prevScoreRef.current > 0) {
            setFlashCapture(true);
            setTimeout(() => setFlashCapture(false), 400);
          }
          prevScoreRef.current = local.score;
          if (local.dead && !deathAnimRef.current.active) {
            deathAnimRef.current = { active: true, progress: 0 };
          } else if (!local.dead) {
            deathAnimRef.current.active = false;
          }
          if (onStatsUpdateRef.current) {
            onStatsUpdateRef.current({
              kills: local.kills,
              deaths: local.deaths,
              score: local.score,
              playerCount: data.playerCount,
            });
          }
        }
      }
    };

    const handlePlayerJoined = (data) => {
      if (data && data.gameState) {
        gameStateRef.current = data.gameState;
        setGameState(data.gameState);
      }
    };

    socketService.on('game:update', handleGameUpdate);
    socketService.on('room:playerJoined', handlePlayerJoined);
    return () => {
      socketService.off('game:update', handleGameUpdate);
      socketService.off('room:playerJoined', handlePlayerJoined);
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // ── RENDER LOOP ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const gs = gameStateRef.current;
    const cw = canvas.width;
    const ch = canvas.height;
    const frame = frameCountRef.current++;
    const time = performance.now() / 1000;

    // ── Loading screen ───────────────────────────────────────────────────
    if (!gs) {
      ctx.fillStyle = '#f5ecd0';
      ctx.fillRect(0, 0, cw, ch);
      const dots = '.'.repeat(1 + (Math.floor(time * 2) % 3));
      ctx.fillStyle = '#555';
      ctx.font = 'bold 28px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Of Lands', cw / 2, ch / 2 - 16);
      ctx.fillStyle = '#999';
      ctx.font = '15px "Segoe UI", sans-serif';
      ctx.fillText('Connecting' + dots, cw / 2, ch / 2 + 16);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2 + 50, 12, time * 3, time * 3 + Math.PI * 1.5);
      ctx.stroke();
      animFrameRef.current = requestAnimationFrame(renderCanvas);
      return;
    }

    const gridCols = gs.cols || 90;
    const gridRows = gs.rows || 60;
    const mapW = gridCols * TILE;
    const mapH = gridRows * TILE;

    // ── Update particles ─────────────────────────────────────────────────
    trailParticles.current.update();
    captureParticles.current.update();

    // ── Interpolate player positions ─────────────────────────────────────
    const posMap = playerPosRef.current;
    for (const [, pos] of posMap) {
      pos.x = lerp(pos.x, pos.targetX, POS_LERP);
      pos.y = lerp(pos.y, pos.targetY, POS_LERP);
    }

    const localPlayer = gs.players?.find(p => p.id === playerIdRef.current);
    const localPos = posMap.get(playerIdRef.current);

    // ── Lerp camera with lookahead ───────────────────────────────────────
    let targetCamX = 0, targetCamY = 0;
    if (localPos) {
      const dir = localPlayer?.dir || { x: 0, y: 0 };
      const lookahead = TILE * 2.5;
      targetCamX = localPos.x * TILE + TILE / 2 - cw / 2 + dir.x * lookahead;
      targetCamY = localPos.y * TILE + TILE / 2 - ch / 2 + dir.y * lookahead;
    }
    targetCamX = Math.max(0, Math.min(targetCamX, mapW - cw));
    targetCamY = Math.max(0, Math.min(targetCamY, mapH - ch));

    const cam = camRef.current;
    if (!cam.initialized) {
      cam.x = targetCamX;
      cam.y = targetCamY;
      cam.initialized = true;
    } else {
      cam.x = lerp(cam.x, targetCamX, LERP_SPEED);
      cam.y = lerp(cam.y, targetCamY, LERP_SPEED);
    }
    const camX = cam.x;
    const camY = cam.y;

    // ── Visible tile range ───────────────────────────────────────────────
    const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
    const endCol = Math.min(gridCols - 1, Math.ceil((camX + cw) / TILE));
    const startRow = Math.max(0, Math.floor(camY / TILE) - 1);
    const endRow = Math.min(gridRows - 1, Math.ceil((camY + ch) / TILE));

    // ── Build lookup maps ────────────────────────────────────────────────
    const ownerMap = {};
    const trailMap = {};
    if (gs.players) {
      for (const p of gs.players) {
        if (p.owned) for (const k of p.owned) ownerMap[k] = p.colorIndex;
        if (p.trail) for (const k of p.trail) trailMap[k] = p.colorIndex;
      }
    }

    // ── Clean up expired tile animations ──────────────────────────────────
    const now = performance.now();
    const FLIP_DURATION = 500; // ms
    for (const [k, anim] of tileAnimsRef.current) {
      if (now - anim.start - anim.delay > FLIP_DURATION) {
        tileAnimsRef.current.delete(k);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── DRAW GROUND ──────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════
    ctx.fillStyle = '#d4c898';
    ctx.fillRect(0, 0, cw, ch);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const px = col * TILE - camX;
        const py = row * TILE - camY;
        const k = `${col},${row}`;

        ctx.fillStyle = (col + row) % 2 === 0 ? GROUND_A : GROUND_B;
        ctx.fillRect(px, py, TILE, TILE);

        // ── Owned territory ────────────────────────────────────────────
        const oci = ownerMap[k];
        if (oci !== undefined) {
          const pc = PLAYER_COLORS[oci];

          // Check for flip animation
          const anim = tileAnimsRef.current.get(k);
          let flipScale = 1;
          let flipGlow = 0;
          if (anim) {
            const elapsed = now - anim.start - anim.delay;
            if (elapsed < 0) {
              // Not started yet (stagger delay)
              flipScale = 0;
            } else {
              const t = Math.min(elapsed / FLIP_DURATION, 1);
              // Flip curve: scale goes 0→squeeze→overshoot→1
              if (t < 0.3) {
                // First half: ground color flips away (scale 0→1 on Y)
                flipScale = easeOutCubic(t / 0.3);
              } else if (t < 0.6) {
                // Overshoot
                flipScale = 1 + 0.15 * Math.sin(((t - 0.3) / 0.3) * Math.PI);
              } else {
                // Settle
                flipScale = 1 + 0.03 * Math.sin(((t - 0.6) / 0.4) * Math.PI);
              }
              // Glow peaks at t=0.3 and fades out
              flipGlow = t < 0.5 ? Math.sin(t / 0.5 * Math.PI) : Math.max(0, 1 - (t - 0.5) / 0.5);
            }
          }

          if (flipScale > 0.01) {
            ctx.save();
            const tileCx = px + TILE / 2;
            const tileCy = py + TILE / 2;

            if (anim && flipScale !== 1) {
              ctx.translate(tileCx, tileCy);
              ctx.scale(flipScale, flipScale);
              ctx.translate(-tileCx, -tileCy);
            }

            // Element-themed tile fill
            const tileFiller = TILE_FILL[oci];
            if (tileFiller) {
              tileFiller(ctx, px, py, col, row, time, flipGlow, pc);
            } else {
              ctx.fillStyle = pc.owned;
              ctx.globalAlpha = 0.5 + flipGlow * 0.3;
              ctx.fillRect(px, py, TILE, TILE);
              ctx.globalAlpha = 1;
            }

            // Capture glow burst
            if (flipGlow > 0.05) {
              const gr = ctx.createRadialGradient(tileCx, tileCy, 0, tileCx, tileCy, TILE * 0.7);
              gr.addColorStop(0, pc.ownedLight + Math.round(flipGlow * 100).toString(16).padStart(2, '0'));
              gr.addColorStop(1, pc.ownedLight + '00');
              ctx.fillStyle = gr;
              ctx.fillRect(px - 4, py - 4, TILE + 8, TILE + 8);
            }

            // Borders
            const hasTop = ownerMap[`${col},${row - 1}`] === oci;
            const hasBot = ownerMap[`${col},${row + 1}`] === oci;
            const hasLeft = ownerMap[`${col - 1},${row}`] === oci;
            const hasRight = ownerMap[`${col + 1},${row}`] === oci;

            ctx.fillStyle = pc.ownedEdge;
            ctx.globalAlpha = 0.6;
            const bw = 3;
            if (!hasTop) ctx.fillRect(px, py, TILE, bw);
            if (!hasBot) ctx.fillRect(px, py + TILE - bw, TILE, bw);
            if (!hasLeft) ctx.fillRect(px, py, bw, TILE);
            if (!hasRight) ctx.fillRect(px + TILE - bw, py, bw, TILE);
            ctx.globalAlpha = 1;

            ctx.restore();
          }
        }

        // ── Trail tiles (render on neutral OR enemy territory) ──────────
        const tci = trailMap[k];
        if (tci !== undefined && (oci === undefined || oci !== tci)) {
          const tc = PLAYER_COLORS[tci];

          // If on enemy territory, first darken the enemy tile before drawing trail
          if (oci !== undefined && oci !== tci) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(px, py, TILE, TILE);
          }

          const pulse = 0.35 + Math.sin(time * 4 + col * 0.5 + row * 0.7) * 0.12;
          const intensity = oci !== undefined ? pulse + 0.15 : pulse; // brighter on enemy tiles
          ctx.fillStyle = tc.trail;
          ctx.globalAlpha = intensity;
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.globalAlpha = 1;

          const dSize = 4 + Math.sin(time * 5 + col + row) * 1.5;
          const cx = px + TILE / 2;
          const cy = py + TILE / 2;
          ctx.fillStyle = tc.trailGlow;
          ctx.beginPath();
          ctx.moveTo(cx, cy - dSize);
          ctx.lineTo(cx + dSize, cy);
          ctx.lineTo(cx, cy + dSize);
          ctx.lineTo(cx - dSize, cy);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = tc.trail;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.4;
          ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.globalAlpha = 1;

          // Themed trail decoration
          const trailDecor = TRAIL_DECOR[tci];
          if (trailDecor) trailDecor(ctx, px, py, time, col, row);
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, TILE, TILE);
      }
    }

    // ── Particles behind players ─────────────────────────────────────────
    trailParticles.current.draw(ctx, camX, camY);
    captureParticles.current.draw(ctx, camX, camY);

    // ══════════════════════════════════════════════════════════════════════
    // ── MAP BORDER ───────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════
    const bx = -camX;
    const by = -camY;
    ctx.fillStyle = '#b0a878';
    if (by > 0) ctx.fillRect(0, 0, cw, by);
    if (by + mapH < ch) ctx.fillRect(0, by + mapH, cw, ch - by - mapH);
    if (bx > 0) ctx.fillRect(0, 0, bx, ch);
    if (bx + mapW < cw) ctx.fillRect(bx + mapW, 0, cw - bx - mapW, ch);

    const borderPulse = 0.5 + Math.sin(time * 2) * 0.15;
    ctx.strokeStyle = `rgba(120,100,60,${borderPulse})`;
    ctx.lineWidth = 5;
    ctx.strokeRect(bx, by, mapW, mapH);
    ctx.strokeStyle = `rgba(180,160,100,${borderPulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 3, by + 3, mapW - 6, mapH - 6);

    // ══════════════════════════════════════════════════════════════════════
    // ── DRAW PLAYER CHARACTERS ───────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════
    if (gs.players) {
      const sorted = [...gs.players].sort((a, b) => {
        if (a.id === playerIdRef.current) return 1;
        if (b.id === playerIdRef.current) return -1;
        return 0;
      });

      for (const p of sorted) {
        if (p.dead) continue;
        const pos = posMap.get(p.id);
        if (!pos) continue;

        const cx = pos.x * TILE + TILE / 2 - camX;
        const cy = pos.y * TILE + TILE / 2 - camY;
        const pc = PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0];
        const isLocal = p.id === playerIdRef.current;
        const r = TILE / 2 - 1;
        const bob = Math.sin(time * 4 + p.colorIndex * 1.2) * 1.5;
        const skinIdx = p.colorIndex ?? 0;

        // Shadow
        const shadowPulse = 1 + Math.sin(time * 3) * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + r + 4, r * 0.9 * shadowPulse, 3.5, 0, 0, TWO_PI);
        ctx.fill();

        // Draw element-specific skin
        const skinDrawer = SKIN_DRAWERS[skinIdx] || SKIN_DRAWERS[0];
        skinDrawer(ctx, cx, cy, r, time, bob, isLocal);

        // Eyes (on top of skin)
        const eyeOffsetX = 5;
        const eyeY = cy - 2 + bob;
        const eyeR = 4;
        const pupilR = 2.2;
        const dirX = p.dir?.x || 0;
        const dirY = p.dir?.y || 0;
        const pupilShift = 2;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX, eyeY, eyeR, 0, TWO_PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeOffsetX, eyeY, eyeR, 0, TWO_PI);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX, eyeY, eyeR, 0, TWO_PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + eyeOffsetX, eyeY, eyeR, 0, TWO_PI);
        ctx.stroke();

        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX + dirX * pupilShift, eyeY + dirY * pupilShift, pupilR, 0, TWO_PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeOffsetX + dirX * pupilShift, eyeY + dirY * pupilShift, pupilR, 0, TWO_PI);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX + dirX * pupilShift - 0.8, eyeY + dirY * pupilShift - 0.8, 0.9, 0, TWO_PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeOffsetX + dirX * pupilShift - 0.8, eyeY + dirY * pupilShift - 0.8, 0.9, 0, TWO_PI);
        ctx.fill();

        // Smile
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy + 3 + bob, 4, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        // Name pill
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        const nameW = ctx.measureText(p.name).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(cx - nameW / 2, cy - r - 18, nameW, 16, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, cx, cy - r - 6);

        // Score badge for local
        if (isLocal && p.score > 0) {
          const scoreText = String(p.score);
          const sw = ctx.measureText(scoreText).width + 10;
          ctx.fillStyle = pc.head;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.roundRect(cx - sw / 2, cy + r + 6, sw, 14, 7);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 9px "Segoe UI", sans-serif';
          ctx.fillText(scoreText, cx, cy + r + 16);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── DEATH OVERLAY ────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════
    if (localPlayer?.dead) {
      const da = deathAnimRef.current;
      if (da.active) da.progress = Math.min(da.progress + 0.03, 1);
      const alpha = easeOutCubic(da.progress) * 0.7;

      const vig = ctx.createRadialGradient(cw / 2, ch / 2, cw * 0.15, cw / 2, ch / 2, cw * 0.7);
      vig.addColorStop(0, `rgba(30,0,0,${alpha * 0.3})`);
      vig.addColorStop(1, `rgba(0,0,0,${alpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, cw, ch);

      for (let i = 0; i < 5; i++) {
        const gy = Math.random() * ch;
        ctx.fillStyle = `rgba(255,50,50,${0.08 * da.progress})`;
        ctx.fillRect(0, gy, cw, 2);
      }

      const shakeX = (Math.random() - 0.5) * 4 * da.progress;
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 36px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ELIMINATED', cw / 2 + shakeX, ch / 2 - 10);
      ctx.fillStyle = '#ddd';
      ctx.font = '15px "Segoe UI", sans-serif';
      const respawnDots = '.'.repeat(1 + (Math.floor(time * 3) % 3));
      ctx.fillText('Respawning' + respawnDots, cw / 2, ch / 2 + 24);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── MINIMAP ──────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════
    const mmW = 160, mmH = Math.round(160 * (gridRows / gridCols));
    const mmX = cw - mmW - 12, mmY = ch - mmH - 12;
    const mmSX = mmW / gridCols, mmSY = mmH / gridRows;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.roundRect(mmX - 5, mmY - 5, mmW + 10, mmH + 10, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6, 8);
    ctx.fill();
    ctx.fillStyle = '#e8e2c4';
    ctx.fillRect(mmX, mmY, mmW, mmH);

    if (gs.players) {
      for (const p of gs.players) {
        const pc = PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0];
        if (p.owned) {
          ctx.fillStyle = pc.owned;
          ctx.globalAlpha = 0.65;
          for (const k of p.owned) {
            const [ox, oy] = k.split(',').map(Number);
            ctx.fillRect(mmX + ox * mmSX, mmY + oy * mmSY, Math.ceil(mmSX), Math.ceil(mmSY));
          }
          ctx.globalAlpha = 1;
        }
        if (!p.dead) {
          const pos = posMap.get(p.id);
          if (pos) {
            ctx.fillStyle = pc.head;
            ctx.beginPath();
            ctx.arc(mmX + pos.x * mmSX + mmSX / 2, mmY + pos.y * mmSY + mmSY / 2, 3.5, 0, TWO_PI);
            ctx.fill();
            if (p.id === playerIdRef.current) {
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.stroke();
              const pingR = 3.5 + (time * 8 % 8);
              ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - pingR / 11)})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(mmX + pos.x * mmSX + mmSX / 2, mmY + pos.y * mmSY + mmSY / 2, pingR, 0, TWO_PI);
              ctx.stroke();
            }
          }
        }
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      mmX + (camX / TILE) * mmSX,
      mmY + (camY / TILE) * mmSY,
      (cw / TILE) * mmSX,
      (ch / TILE) * mmSY
    );
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = 'bold 8px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MAP', mmX + 4, mmY + 10);

    animFrameRef.current = requestAnimationFrame(renderCanvas);
  }, []);

  // Start/stop render loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderCanvas);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [renderCanvas]);

  // ── HUD data ───────────────────────────────────────────────────────────────
  const localPlayer = gameState?.players?.find(p => p.id === playerId);
  const gridCols = gameState?.cols || 90;
  const gridRows = gameState?.rows || 60;
  const score = localPlayer?.score || 0;
  const totalTiles = gridCols * gridRows;
  const pct = Math.round((score / totalTiles) * 100);
  const localCI = localPlayer?.colorIndex ?? 0;
  const pc = PLAYER_COLORS[localCI];
  const kills = localPlayer?.kills || 0;
  const deaths = localPlayer?.deaths || 0;

  const vpW = Math.min(viewportSize.w, 1400);
  const vpH = Math.min(viewportSize.h, 800);

  return (
    <div ref={containerRef} className="gc-root">
      {/* ── Top HUD ─────────────────────────────────────────────────────── */}
      <div className="gc-hud" style={{ width: vpW }}>
        <div className="gc-hud-left">
          <div className="gc-logo-wrap">
            <span className="gc-logo">GameOfLands</span>
          </div>
        </div>
        <div className="gc-hud-center">
          <div className="gc-bar-track">
            <div className="gc-bar-fill" style={{ width: `${Math.max(pct, 1)}%`, background: pc.bar }} />
            <div className="gc-bar-shimmer" />
          </div>
          <span className="gc-bar-label">{pct}% territory &mdash; {score} tiles</span>
        </div>
        <div className="gc-hud-stats">
          <div className="gc-stat">
            <span className="gc-stat-icon">&#x2694;</span>
            <span className="gc-stat-val">{kills}</span>
          </div>
          <div className="gc-stat">
            <span className="gc-stat-icon">&#x1F480;</span>
            <span className="gc-stat-val">{deaths}</span>
          </div>
        </div>
        <div className="gc-hud-right">
          <span className="gc-score" key={score}>{score}</span>
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div className="gc-viewport" style={{ width: vpW, height: vpH }}>
        <canvas
          ref={canvasRef}
          width={vpW}
          height={vpH}
          className="gc-canvas"
        />
        {flashCapture && <div className="gc-flash" />}
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────── */}
      <div className="gc-footer" style={{ width: vpW }}>
        <div className="gc-controls-grid">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
          <span className="gc-controls-sep">or</span>
          <kbd>&uarr;</kbd><kbd>&larr;</kbd><kbd>&darr;</kbd><kbd>&rarr;</kbd>
        </div>
        <span className="gc-hint">Capture territory by enclosing areas &middot; Avoid crossing your own trail</span>
        <button onClick={onLeaveRoom} className="gc-leave-btn">
          <span>EXIT</span>
        </button>
      </div>
    </div>
  );
}
