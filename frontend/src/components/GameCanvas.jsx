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

            // Detect capture (owned size jumped) -> burst particles
            const prevOwned = prevOwnedRef.current.get(p.id) || 0;
            if (p.owned && p.owned.length > prevOwned + 5) {
              const pc = PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0];
              captureParticles.current.emit(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, pc.particle, 20, 4);
            }
            prevOwnedRef.current.set(p.id, p.owned ? p.owned.length : 0);
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
      ctx.fillText('LAND.IO', cw / 2, ch / 2 - 16);
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
          ctx.fillStyle = pc.owned;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(px, py, TILE, TILE);

          ctx.fillStyle = pc.ownedLight;
          ctx.globalAlpha = 0.12;
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.globalAlpha = 1;

          const hasTop = ownerMap[`${col},${row - 1}`] === oci;
          const hasBot = ownerMap[`${col},${row + 1}`] === oci;
          const hasLeft = ownerMap[`${col - 1},${row}`] === oci;
          const hasRight = ownerMap[`${col + 1},${row}`] === oci;

          ctx.fillStyle = pc.ownedEdge;
          ctx.globalAlpha = 0.5;
          const bw = 3;
          if (!hasTop) ctx.fillRect(px, py, TILE, bw);
          if (!hasBot) ctx.fillRect(px, py + TILE - bw, TILE, bw);
          if (!hasLeft) ctx.fillRect(px, py, bw, TILE);
          if (!hasRight) ctx.fillRect(px + TILE - bw, py, bw, TILE);
          ctx.globalAlpha = 1;

          if (!hasTop && !hasLeft) {
            ctx.fillStyle = pc.ownedLight;
            ctx.globalAlpha = 0.15;
            ctx.fillRect(px, py, 6, 6);
            ctx.globalAlpha = 1;
          }
        }

        // ── Trail tiles ────────────────────────────────────────────────
        const tci = trailMap[k];
        if (tci !== undefined && oci === undefined) {
          const tc = PLAYER_COLORS[tci];
          const pulse = 0.35 + Math.sin(time * 4 + col * 0.5 + row * 0.7) * 0.12;
          ctx.fillStyle = tc.trail;
          ctx.globalAlpha = pulse;
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

        // Shadow
        const shadowPulse = 1 + Math.sin(time * 3) * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + r + 3, r * 0.85 * shadowPulse, 3, 0, 0, TWO_PI);
        ctx.fill();

        // Glow ring
        const glowR = r + 4 + Math.sin(time * 3 + p.colorIndex) * 2;
        const glowGrad = ctx.createRadialGradient(cx, cy, r, cx, cy, glowR + 4);
        glowGrad.addColorStop(0, pc.ring + '40');
        glowGrad.addColorStop(1, pc.ring + '00');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR + 4, 0, TWO_PI);
        ctx.fill();

        // Body gradient
        const bodyGrad = ctx.createRadialGradient(cx - 3, cy - 4, 2, cx, cy, r);
        bodyGrad.addColorStop(0, pc.ring);
        bodyGrad.addColorStop(0.6, pc.head);
        bodyGrad.addColorStop(1, pc.headGrad);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TWO_PI);
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        ctx.strokeStyle = isLocal ? '#fff' : pc.ring;
        ctx.lineWidth = isLocal ? 2.5 : 1.8;
        ctx.stroke();

        // Bob animation
        const bob = Math.sin(time * 4 + p.colorIndex * 1.2) * 1.5;

        // Eyes
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
            <span className="gc-logo">LAND<span className="gc-logo-dot">.</span>IO</span>
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
