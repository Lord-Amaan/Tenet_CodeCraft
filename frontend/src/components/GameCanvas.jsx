import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '../services/socket';
import '../styles/GameCanvas.css';

const TILE = 32;

// ── Player color palettes ────────────────────────────────────────────────────
const PLAYER_COLORS = [
  { owned: 'rgba(204,34,0,0.55)', trail: 'rgba(255,50,20,0.45)', trailLine: '#ff4422', head: '#ff5533', headDark: '#cc1100', headBorder: '#ff9977', barFrom: '#cc2200', barTo: '#ff4422' },
  { owned: 'rgba(0,68,204,0.55)', trail: 'rgba(34,102,255,0.45)', trailLine: '#2266ff', head: '#5577ff', headDark: '#0011cc', headBorder: '#7799ff', barFrom: '#0044cc', barTo: '#2266ff' },
  { owned: 'rgba(0,170,68,0.55)', trail: 'rgba(34,221,102,0.45)', trailLine: '#22dd66', head: '#55ff77', headDark: '#00cc11', headBorder: '#77ff99', barFrom: '#00aa44', barTo: '#22dd66' },
  { owned: 'rgba(204,136,0,0.55)', trail: 'rgba(255,170,34,0.45)', trailLine: '#ffaa22', head: '#ffaa55', headDark: '#cc8800', headBorder: '#ffcc77', barFrom: '#cc8800', barTo: '#ffaa22' },
  { owned: 'rgba(136,0,204,0.55)', trail: 'rgba(170,34,255,0.45)', trailLine: '#aa22ff', head: '#bb55ff', headDark: '#8800cc', headBorder: '#cc77ff', barFrom: '#8800cc', barTo: '#aa22ff' },
  { owned: 'rgba(0,170,170,0.55)', trail: 'rgba(34,221,221,0.45)', trailLine: '#22dddd', head: '#55ffff', headDark: '#00cccc', headBorder: '#77ffff', barFrom: '#00aaaa', barTo: '#22dddd' },
];

// ── Neutral tile colors ──────────────────────────────────────────────────────
const NEUTRAL_BG = ['#e8c832', '#d4b820', '#f0d048', '#c8aa18', '#e0c030'];

function seededRng(seed, n) {
  let x = Math.sin(seed * 9301 + n * 49297 + 233720) * 43758.5453;
  return x - Math.floor(x);
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

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate; }, [onStatsUpdate]);

  // ── Viewport resize ────────────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setViewportSize({ w: rect.width, h: rect.height - 100 }); // leave room for HUD
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ── Keyboard → send direction to server ──────────────────────────────────
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
        gameStateRef.current = data.gameState;
        setGameState(data.gameState);
        const local = data.gameState.players.find(p => p.id === playerIdRef.current);
        if (local) {
          if (local.score > prevScoreRef.current && prevScoreRef.current > 0) {
            setFlashCapture(true);
            setTimeout(() => setFlashCapture(false), 300);
          }
          prevScoreRef.current = local.score;
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

  // ── Canvas render loop (60 FPS) ──────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const gs = gameStateRef.current;
    if (!gs) {
      ctx.fillStyle = '#0e0a00';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f0d048';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🍄 LAND.IO', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#aa8833';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText('Waiting for game data...', canvas.width / 2, canvas.height / 2 + 20);
      animFrameRef.current = requestAnimationFrame(renderCanvas);
      return;
    }

    const gridCols = gs.cols || 90;
    const gridRows = gs.rows || 60;
    const cw = canvas.width;
    const ch = canvas.height;

    // Find local player
    const localPlayer = gs.players?.find(p => p.id === playerIdRef.current);

    // Camera: center on player
    let camX = 0, camY = 0;
    if (localPlayer) {
      camX = localPlayer.x * TILE + TILE / 2 - cw / 2;
      camY = localPlayer.y * TILE + TILE / 2 - ch / 2;
    }
    // Clamp camera to map bounds
    const mapW = gridCols * TILE;
    const mapH = gridRows * TILE;
    camX = Math.max(0, Math.min(camX, mapW - cw));
    camY = Math.max(0, Math.min(camY, mapH - ch));

    // Visible tile range
    const startCol = Math.max(0, Math.floor(camX / TILE));
    const endCol = Math.min(gridCols - 1, Math.floor((camX + cw) / TILE));
    const startRow = Math.max(0, Math.floor(camY / TILE));
    const endRow = Math.min(gridRows - 1, Math.floor((camY + ch) / TILE));

    // Build lookup maps
    const ownerMap = {};
    const trailMap = {};
    const headMap = {};
    if (gs.players) {
      for (const p of gs.players) {
        if (p.owned) for (const k of p.owned) ownerMap[k] = p.colorIndex;
        if (p.trail) for (const k of p.trail) trailMap[k] = p.colorIndex;
        if (!p.dead) headMap[`${p.x},${p.y}`] = p;
      }
    }

    // Clear
    ctx.fillStyle = '#0e0a00';
    ctx.fillRect(0, 0, cw, ch);

    // Draw visible tiles
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const px = col * TILE - camX;
        const py = row * TILE - camY;
        const k = `${col},${row}`;

        // Neutral tile
        const seed = col * 100 + row;
        const ci = (col + row * 3 + Math.floor(seed * 0.37)) % NEUTRAL_BG.length;
        const brightness = 0.88 + ((seed * 17) % 23) / 100;
        ctx.fillStyle = NEUTRAL_BG[ci];
        ctx.globalAlpha = brightness;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.globalAlpha = 1;

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, TILE, TILE);

        // Owned overlay
        const ownerCI = ownerMap[k];
        if (ownerCI !== undefined) {
          ctx.fillStyle = PLAYER_COLORS[ownerCI].owned;
          ctx.fillRect(px, py, TILE, TILE);
        }

        // Trail overlay
        const trailCI = trailMap[k];
        if (trailCI !== undefined && ownerCI === undefined) {
          ctx.fillStyle = PLAYER_COLORS[trailCI].trail;
          ctx.fillRect(px, py, TILE, TILE);
          // Cross pattern
          ctx.strokeStyle = PLAYER_COLORS[trailCI].trailLine;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.moveTo(px, py + TILE / 2);
          ctx.lineTo(px + TILE, py + TILE / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px + TILE / 2, py);
          ctx.lineTo(px + TILE / 2, py + TILE);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Player head
        const headPlayer = headMap[k];
        if (headPlayer) {
          const hci = headPlayer.colorIndex;
          const hx = px + 4, hy = py + 4, hw = TILE - 8, hh = TILE - 8;
          // Glow
          ctx.shadowColor = PLAYER_COLORS[hci].headBorder;
          ctx.shadowBlur = 14;
          // Body
          ctx.fillStyle = PLAYER_COLORS[hci].head;
          ctx.beginPath();
          ctx.roundRect(hx, hy, hw, hh, 6);
          ctx.fill();
          ctx.shadowBlur = 0;
          // Border
          ctx.strokeStyle = PLAYER_COLORS[hci].headBorder;
          ctx.lineWidth = 2;
          ctx.stroke();
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(px + TILE / 2 - 4, py + TILE / 2 - 2, 3, 0, Math.PI * 2);
          ctx.arc(px + TILE / 2 + 4, py + TILE / 2 - 2, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#222';
          ctx.beginPath();
          ctx.arc(px + TILE / 2 - 3, py + TILE / 2 - 2, 1.5, 0, Math.PI * 2);
          ctx.arc(px + TILE / 2 + 5, py + TILE / 2 - 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
          // Name
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 7px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(headPlayer.name, px + TILE / 2, py + TILE / 2 + 9, TILE - 8);
        }
      }
    }

    // ── Map border (red glow lines) ──────────────────────────────────────
    ctx.strokeStyle = '#ff4422';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ff4422';
    ctx.shadowBlur = 12;
    ctx.strokeRect(-camX, -camY, mapW, mapH);
    ctx.shadowBlur = 0;

    // ── Death overlay ────────────────────────────────────────────────────
    if (localPlayer?.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#ff4422';
      ctx.font = 'bold 30px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WIPED OUT', cw / 2, ch / 2 - 10);
      ctx.fillStyle = '#f0d048';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText('Respawning...', cw / 2, ch / 2 + 20);
    }

    // ── Minimap ──────────────────────────────────────────────────────────
    const mmW = 140, mmH = Math.round(140 * (gridRows / gridCols));
    const mmX = cw - mmW - 12, mmY = ch - mmH - 12;
    const mmScaleX = mmW / gridCols, mmScaleY = mmH / gridRows;

    ctx.fillStyle = 'rgba(14,10,0,0.85)';
    ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
    ctx.strokeStyle = '#b8960a';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);

    // Minimap tiles
    ctx.fillStyle = 'rgba(224,192,48,0.2)';
    ctx.fillRect(mmX, mmY, mmW, mmH);

    if (gs.players) {
      for (const p of gs.players) {
        if (p.owned) {
          ctx.fillStyle = PLAYER_COLORS[p.colorIndex]?.owned || 'rgba(255,255,255,0.3)';
          for (const k of p.owned) {
            const [ox, oy] = k.split(',').map(Number);
            ctx.fillRect(mmX + ox * mmScaleX, mmY + oy * mmScaleY, Math.ceil(mmScaleX), Math.ceil(mmScaleY));
          }
        }
        // Player dot on minimap
        if (!p.dead) {
          ctx.fillStyle = PLAYER_COLORS[p.colorIndex]?.head || '#fff';
          ctx.beginPath();
          ctx.arc(mmX + p.x * mmScaleX + mmScaleX / 2, mmY + p.y * mmScaleY + mmScaleY / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Viewport rectangle on minimap
    ctx.strokeStyle = '#f0d048';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mmX + (camX / TILE) * mmScaleX,
      mmY + (camY / TILE) * mmScaleY,
      (cw / TILE) * mmScaleX,
      (ch / TILE) * mmScaleY
    );

    animFrameRef.current = requestAnimationFrame(renderCanvas);
  }, []);

  // Start/stop render loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderCanvas);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderCanvas]);

  // ── Build HUD data from state ────────────────────────────────────────────
  const localPlayer = gameState?.players?.find(p => p.id === playerId);
  const gridCols = gameState?.cols || 90;
  const gridRows = gameState?.rows || 60;
  const score = localPlayer?.score || 0;
  const pct = Math.round((score / (gridCols * gridRows)) * 100);
  const localCI = localPlayer?.colorIndex ?? 0;
  const colors = PLAYER_COLORS[localCI];

  const vpW = Math.min(viewportSize.w, 1200);
  const vpH = Math.min(viewportSize.h, 750);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', background: '#0e0a00',
      fontFamily: "'Courier New', monospace", userSelect: 'none',
    }}>
      {/* ── HUD bar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: vpW + 6, marginBottom: 8, padding: '6px 14px',
        background: '#1a1200', border: '2px solid #b8960a', borderRadius: 4, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: '#2a1e00', border: '2px solid #b8960a',
            borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🍄</div>
          <span style={{ color: '#f0d048', fontWeight: 'bold', fontSize: 16, letterSpacing: 3 }}>LAND.IO</span>
        </div>
        <div style={{ flex: 1, margin: '0 20px' }}>
          <div style={{ color: '#664400', fontSize: 9, letterSpacing: 2, marginBottom: 3 }}>TERRITORY</div>
          <div style={{ height: 10, background: '#2a1e00', borderRadius: 5, border: '1px solid #554400', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, ${colors.barFrom}, ${colors.barTo})`,
              borderRadius: 5, transition: 'width 0.15s ease',
              boxShadow: flashCapture ? '0 0 10px rgba(255,80,40,0.9)' : 'none',
            }} />
          </div>
          <div style={{ color: '#f0d048', fontSize: 10, marginTop: 2, letterSpacing: 1 }}>{pct}% ({score} tiles)</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#554400', fontSize: 9, letterSpacing: 2 }}>TILES</div>
          <div style={{
            color: flashCapture ? '#ffaa44' : '#f0d048', fontSize: 20, fontWeight: 'bold',
            letterSpacing: 2, transition: 'color 0.15s',
          }}>{String(score).padStart(3, '0')}</div>
        </div>
      </div>

      {/* ── Canvas viewport ────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        border: '3px solid #b8960a', boxShadow: '0 4px 40px rgba(0,0,0,0.7)',
        borderRadius: 4, overflow: 'hidden',
      }}>
        <canvas
          ref={canvasRef}
          width={vpW}
          height={vpH}
          style={{ display: 'block', background: '#0e0a00' }}
        />

        {/* Capture flash overlay */}
        {flashCapture && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,80,20,0.18)',
            pointerEvents: 'none', animation: 'captureFlash 0.3s ease-out forwards',
          }} />
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: vpW + 6, marginTop: 8, padding: '6px 14px',
        background: '#1a1200', border: '2px solid #b8960a', borderRadius: 4, boxSizing: 'border-box',
      }}>
        <span style={{ color: '#664400', fontSize: 10, letterSpacing: 2 }}>
          WASD / ARROWS · CAPTURE TERRITORY · AVOID YOUR TRAIL
        </span>
        <button onClick={onLeaveRoom} style={{
          padding: '6px 16px', background: 'linear-gradient(135deg, #ff4422, #cc2200)',
          border: '2px solid #ff8866', color: '#fff', borderRadius: 4, cursor: 'pointer',
          fontFamily: "'Courier New', monospace", fontWeight: 'bold', fontSize: 11, letterSpacing: 2,
        }}>
          LEAVE
        </button>
      </div>

      <style>{`
        @keyframes captureFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
