import { useEffect, useRef, useState, memo } from 'react';
import { socketService } from '../services/socket';
import '../styles/GameCanvas.css';

const TILE = 44;
const COLS = 20;
const ROWS = 14;

// ── Player color palettes ────────────────────────────────────────────────────
const PLAYER_COLORS = [
  { owned: 'rgba(204,34,0,0.52)', ownedDot: '#ff6644', trail: 'rgba(255,50,20,0.38)', trailLine: '#ff4422', trailGlow: 'rgba(255,60,30,0.55)', headGrad: ['#ff5533','#cc1100'], headBorder: '#ff9977', barFrom: '#cc2200', barTo: '#ff4422' },
  { owned: 'rgba(0,68,204,0.52)', ownedDot: '#4488ff', trail: 'rgba(34,102,255,0.38)', trailLine: '#2266ff', trailGlow: 'rgba(30,60,255,0.55)', headGrad: ['#5577ff','#0011cc'], headBorder: '#7799ff', barFrom: '#0044cc', barTo: '#2266ff' },
  { owned: 'rgba(0,170,68,0.52)', ownedDot: '#44ff88', trail: 'rgba(34,221,102,0.38)', trailLine: '#22dd66', trailGlow: 'rgba(30,255,60,0.55)', headGrad: ['#55ff77','#00cc11'], headBorder: '#77ff99', barFrom: '#00aa44', barTo: '#22dd66' },
  { owned: 'rgba(204,136,0,0.52)', ownedDot: '#ffaa44', trail: 'rgba(255,170,34,0.38)', trailLine: '#ffaa22', trailGlow: 'rgba(255,170,30,0.55)', headGrad: ['#ffaa55','#cc8800'], headBorder: '#ffcc77', barFrom: '#cc8800', barTo: '#ffaa22' },
  { owned: 'rgba(136,0,204,0.52)', ownedDot: '#bb44ff', trail: 'rgba(170,34,255,0.38)', trailLine: '#aa22ff', trailGlow: 'rgba(170,30,255,0.55)', headGrad: ['#bb55ff','#8800cc'], headBorder: '#cc77ff', barFrom: '#8800cc', barTo: '#aa22ff' },
  { owned: 'rgba(0,170,170,0.52)', ownedDot: '#44ffff', trail: 'rgba(34,221,221,0.38)', trailLine: '#22dddd', trailGlow: 'rgba(30,255,255,0.55)', headGrad: ['#55ffff','#00cccc'], headBorder: '#77ffff', barFrom: '#00aaaa', barTo: '#22dddd' },
];

// ── Neutral tile colors ──────────────────────────────────────────────────────
const NEUTRAL_COLORS = [
  { bg: '#e8c832', dot: '#c8a818' },
  { bg: '#d4b820', dot: '#b89a10' },
  { bg: '#f0d048', dot: '#d4b030' },
  { bg: '#c8aa18', dot: '#a88c08' },
  { bg: '#e0c030', dot: '#c4a420' },
];

function getDots(seed) {
  const rng = (n) => {
    let x = Math.sin(seed * 9301 + n * 49297 + 233720) * 43758.5453;
    return x - Math.floor(x);
  };
  const count = 2 + Math.floor(rng(0) * 3);
  return Array.from({ length: count }, (_, i) => ({
    x: 6 + rng(i * 2 + 1) * (TILE - 12),
    y: 6 + rng(i * 2 + 2) * (TILE - 12),
    r: 2 + rng(i * 3 + 3) * 4,
  }));
}

// ── Memoized neutral tile ────────────────────────────────────────────────────
const NeutralTile = memo(function NeutralTile({ col, row }) {
  const seed = col * 100 + row;
  const ci = (col + row * 3 + Math.floor(seed * 0.37)) % NEUTRAL_COLORS.length;
  const { bg, dot } = NEUTRAL_COLORS[ci];
  const brightness = 0.88 + ((seed * 17) % 23) / 100;
  const dots = getDots(seed);
  return (
    <svg width={TILE} height={TILE} viewBox={`0 0 ${TILE} ${TILE}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`ng${col}_${row}`} cx="30%" cy="25%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
        </radialGradient>
      </defs>
      <rect width={TILE} height={TILE} fill={bg} style={{ filter: `brightness(${brightness})` }} />
      <rect width={TILE} height={TILE} fill={`url(#ng${col}_${row})`} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={dot} opacity={0.6 + ((i * seed) % 10) / 40} />
      ))}
    </svg>
  );
});

// ── Main component ───────────────────────────────────────────────────────────
export function GameCanvas({ roomCode, playerName, playerId, onLeaveRoom, onStatsUpdate }) {
  const [gameState, setGameState] = useState(null);
  const [flashCapture, setFlashCapture] = useState(false);
  const prevScoreRef = useRef(0);
  const playerIdRef = useRef(playerId);
  const roomCodeRef = useRef(roomCode);
  const onStatsUpdateRef = useRef(onStatsUpdate);

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate; }, [onStatsUpdate]);

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
      if (data && data.gameState) setGameState(data.gameState);
    };

    socketService.on('game:update', handleGameUpdate);
    socketService.on('room:playerJoined', handlePlayerJoined);
    return () => {
      socketService.off('game:update', handleGameUpdate);
      socketService.off('room:playerJoined', handlePlayerJoined);
    };
  }, []);

  // ── Build render data ────────────────────────────────────────────────────
  const localPlayer = gameState?.players?.find(p => p.id === playerId);
  const score = localPlayer?.score || 0;
  const pct = Math.round((score / (COLS * ROWS)) * 100);
  const isDead = localPlayer?.dead || false;
  const localCI = localPlayer?.colorIndex ?? 0;
  const colors = PLAYER_COLORS[localCI];

  const ownershipMap = {};
  const trailMap = {};
  const headMap = {};

  if (gameState?.players) {
    for (const player of gameState.players) {
      if (player.owned) for (const k of player.owned) ownershipMap[k] = player.colorIndex;
      if (player.trail) for (const k of player.trail) trailMap[k] = player.colorIndex;
      if (!player.dead) headMap[`${player.x},${player.y}`] = player;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', background: '#0e0a00',
      fontFamily: "'Courier New', monospace", userSelect: 'none',
    }}>
      {/* ── HUD bar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: COLS * TILE + 6, marginBottom: 8, padding: '6px 14px',
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

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', display: 'inline-flex', flexDirection: 'column',
        border: '3px solid #b8960a', boxShadow: '0 4px 40px rgba(0,0,0,0.7)',
        overflow: 'hidden', borderRadius: 4,
      }}>
        {/* Pink top stripe */}
        <div style={{ height: 4, background: 'linear-gradient(90deg,#ff88bb,#ff44aa,#cc3388)', flexShrink: 0 }} />

        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} style={{ display: 'flex' }}>
            {Array.from({ length: COLS }, (_, col) => {
              const k = `${col},${row}`;
              const ownerCI = ownershipMap[k];
              const trailCI = trailMap[k];
              const headPlayer = headMap[k];

              return (
                <div key={col} style={{
                  position: 'relative', width: TILE, height: TILE, flexShrink: 0,
                  outline: '1px solid rgba(0,0,0,0.13)', outlineOffset: '-1px',
                }}>
                  <NeutralTile col={col} row={row} />

                  {/* Owned overlay */}
                  {ownerCI !== undefined && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: PLAYER_COLORS[ownerCI].owned,
                      borderTop: '1px solid rgba(255,80,60,0.25)',
                      borderLeft: '1px solid rgba(255,80,60,0.15)',
                    }}>
                      <svg width={TILE} height={TILE} viewBox={`0 0 ${TILE} ${TILE}`}
                        style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
                        <circle cx={TILE * 0.3} cy={TILE * 0.3} r={3} fill={PLAYER_COLORS[ownerCI].ownedDot} />
                        <circle cx={TILE * 0.7} cy={TILE * 0.6} r={2} fill={PLAYER_COLORS[ownerCI].ownedDot} />
                        <circle cx={TILE * 0.5} cy={TILE * 0.75} r={2.5} fill={PLAYER_COLORS[ownerCI].ownedDot} />
                      </svg>
                    </div>
                  )}

                  {/* Trail overlay */}
                  {trailCI !== undefined && ownerCI === undefined && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: PLAYER_COLORS[trailCI].trail,
                      boxShadow: `inset 0 0 8px ${PLAYER_COLORS[trailCI].trailGlow}`,
                    }}>
                      <div style={{
                        position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)',
                        height: 6, background: `linear-gradient(90deg, transparent, ${PLAYER_COLORS[trailCI].trailLine}, transparent)`, opacity: 0.85,
                      }} />
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
                        width: 6, background: `linear-gradient(180deg, transparent, ${PLAYER_COLORS[trailCI].trailLine}, transparent)`, opacity: 0.85,
                      }} />
                    </div>
                  )}

                  {/* Player head */}
                  {headPlayer && (
                    <div style={{
                      position: 'absolute', inset: 4,
                      background: `linear-gradient(135deg, ${PLAYER_COLORS[headPlayer.colorIndex].headGrad[0]}, ${PLAYER_COLORS[headPlayer.colorIndex].headGrad[1]})`,
                      borderRadius: 8, border: `2px solid ${PLAYER_COLORS[headPlayer.colorIndex].headBorder}`,
                      boxShadow: '0 0 14px rgba(255,60,30,0.85), 0 0 4px rgba(255,100,60,0.6)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <div style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', boxShadow: '0 0 2px #000', position: 'relative' }}>
                          <div style={{ width: 3, height: 3, background: '#222', borderRadius: '50%', position: 'absolute', top: '25%', left: '25%' }} />
                        </div>
                        <div style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', boxShadow: '0 0 2px #000', position: 'relative' }}>
                          <div style={{ width: 3, height: 3, background: '#222', borderRadius: '50%', position: 'absolute', top: '25%', left: '25%' }} />
                        </div>
                      </div>
                      <div style={{
                        color: '#fff', fontSize: 7, fontWeight: 'bold', marginTop: 2,
                        textShadow: '0 0 3px #000', whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis', maxWidth: TILE - 12,
                      }}>
                        {headPlayer.name}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Capture flash */}
        {flashCapture && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,80,20,0.18)',
            pointerEvents: 'none', animation: 'captureFlash 0.3s ease-out forwards',
          }} />
        )}

        {/* Death overlay */}
        {isDead && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <div style={{ color: '#ff4422', fontSize: 30, fontWeight: 'bold', letterSpacing: 5 }}>WIPED OUT</div>
            <div style={{ color: '#f0d048', fontSize: 14, letterSpacing: 2 }}>Respawning...</div>
          </div>
        )}

        {/* Waiting for data overlay */}
        {!gameState && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            width: COLS * TILE, height: ROWS * TILE + 4,
          }}>
            <div style={{ color: '#f0d048', fontSize: 22, fontWeight: 'bold', letterSpacing: 4 }}>🍄 LAND.IO</div>
            <div style={{ color: '#aa8833', fontSize: 14 }}>Waiting for game data...</div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: COLS * TILE + 6, marginTop: 8, padding: '6px 14px',
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
