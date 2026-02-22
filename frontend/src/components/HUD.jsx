import { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/HUD.css';

/* ── Load Google Fonts (same as Menu) ──────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("gol-fonts")) {
  const l = document.createElement("link");
  l.id = "gol-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=Rajdhani:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
}

const MINIMAP_COLORS = [
  { owned: '#e84040', trail: '#ff6060' },
  { owned: '#4080e8', trail: '#60a0ff' },
  { owned: '#40c860', trail: '#60e880' },
  { owned: '#e8a030', trail: '#ffc050' },
  { owned: '#a050e0', trail: '#c070ff' },
  { owned: '#40c8c8', trail: '#60e8e8' },
];

export function HUD({ playerName, kills, deaths, score, coins, playerCount, roomCode, onLeaveRoom, playerId, minimapData }) {
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const kd = deaths > 0 ? (kills / deaths).toFixed(1) : kills.toFixed(1);

  // ── Minimap canvas rendering ───────────────────────────────────────────
  const minimapCanvasRef = useRef(null);

  const drawMinimap = useCallback(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas || !minimapData) return;

    const ctx = canvas.getContext('2d');
    const { cols, rows, players } = minimapData;
    const cw = canvas.width;
    const ch = canvas.height;
    const scaleX = cw / cols;
    const scaleY = ch / rows;

    // Background
    ctx.fillStyle = 'rgba(12,10,6,0.95)';
    ctx.fillRect(0, 0, cw, ch);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(212,180,80,0.06)';
    ctx.lineWidth = 0.5;
    const gridStep = Math.max(Math.floor(cols / 10), 1);
    for (let c = 0; c <= cols; c += gridStep) {
      const x = c * scaleX;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    const gridStepY = Math.max(Math.floor(rows / 8), 1);
    for (let r = 0; r <= rows; r += gridStepY) {
      const y = r * scaleY;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }

    // Draw owned territories and trails
    for (const p of players) {
      const pc = MINIMAP_COLORS[p.colorIndex] || MINIMAP_COLORS[0];
      const isLocal = p.id === playerId;

      // Owned tiles
      if (p.owned.length > 0) {
        ctx.fillStyle = isLocal ? pc.owned : pc.owned + '99';
        for (const k of p.owned) {
          const [cx, cy] = k.split(',').map(Number);
          ctx.fillRect(cx * scaleX, cy * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
        }
      }

      // Trail tiles
      if (p.trail.length > 0) {
        ctx.fillStyle = pc.trail + 'aa';
        for (const k of p.trail) {
          const [cx, cy] = k.split(',').map(Number);
          ctx.fillRect(cx * scaleX, cy * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
        }
      }
    }

    // Draw player positions (dots)
    for (const p of players) {
      const pc = MINIMAP_COLORS[p.colorIndex] || MINIMAP_COLORS[0];
      const isLocal = p.id === playerId;
      const px = p.x * scaleX + scaleX / 2;
      const py = p.y * scaleY + scaleY / 2;
      const dotR = isLocal ? 4 : 3;

      // Glow
      ctx.beginPath();
      ctx.arc(px, py, dotR + 3, 0, Math.PI * 2);
      ctx.fillStyle = isLocal ? 'rgba(255,255,255,0.25)' : `${pc.owned}44`;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fillStyle = isLocal ? '#ffffff' : pc.owned;
      ctx.fill();
      ctx.strokeStyle = isLocal ? '#f0d048' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = isLocal ? 1.5 : 1;
      ctx.stroke();
    }

    // Border glow
    ctx.strokeStyle = 'rgba(212,180,80,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, cw, ch);
  }, [minimapData, playerId]);

  useEffect(() => {
    drawMinimap();
  }, [drawMinimap]);

  return (
    <div className="hud-container">
      {/* Player card */}
      <div className="hud-card hud-player">
        <div className="hud-card-header">
          <span className="hud-card-icon">&#x1F3AE;</span>
          <span className="hud-card-title">PLAYER</span>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div className="hud-player-name" style={{marginBottom:0}}>{playerName}</div>
          <div style={{
            display:'flex',alignItems:'center',gap:5,
            padding:'3px 10px',borderRadius:14,
            background:'rgba(255,215,0,0.08)',
            border:'1px solid rgba(255,215,0,0.18)',
          }}>
            <span style={{fontSize:12}}>🪙</span>
            <span style={{
              fontFamily:"'Cinzel',serif",fontSize:14,fontWeight:700,
              color:'#ffd700',textShadow:'0 0 10px rgba(255,215,0,0.5)',
            }}>{coins ?? 0}</span>
          </div>
        </div>
        <div className="hud-stats-row">
          <div className="hud-stat-box">
            <span className="hud-stat-label">SCORE</span>
            <span className="hud-stat-value hud-score-val">{score}</span>
          </div>
          <div className="hud-stat-box">
            <span className="hud-stat-label">K/D</span>
            <span className="hud-stat-value">{kd}</span>
          </div>
        </div>
        <div className="hud-stats-row">
          <div className="hud-stat-box hud-kills">
            <span className="hud-stat-label">KILLS</span>
            <span className="hud-stat-value">{kills}</span>
          </div>
          <div className="hud-stat-box hud-deaths">
            <span className="hud-stat-label">DEATHS</span>
            <span className="hud-stat-value">{deaths}</span>
          </div>
        </div>
      </div>

      {/* Room card */}
      <div className="hud-card hud-room">
        <div className="hud-card-header">
          <span className="hud-card-icon">&#x1F310;</span>
          <span className="hud-card-title">ROOM</span>
          <span className="hud-player-count">{playerCount} online</span>
        </div>
        <div className="hud-room-code-row">
          <span className="hud-room-code">{roomCode}</span>
          <button onClick={copyRoomCode} className="hud-copy-btn" title="Copy room code">
            &#x1F4CB;
          </button>
        </div>
      </div>

      {/* Minimap card */}
      <div className="hud-card hud-minimap">
        <div className="hud-card-header">
          <span className="hud-card-icon">&#x1F5FA;</span>
          <span className="hud-card-title">MAP</span>
        </div>
        <div className="hud-minimap-wrap">
          <canvas
            ref={minimapCanvasRef}
            width={240}
            height={160}
            className="hud-minimap-canvas"
          />
          {!minimapData && (
            <div className="hud-minimap-loading">Waiting for data...</div>
          )}
        </div>
        <button onClick={onLeaveRoom} className="hud-leave-btn">
          EXIT GAME
        </button>
      </div>
    </div>
  );
}
