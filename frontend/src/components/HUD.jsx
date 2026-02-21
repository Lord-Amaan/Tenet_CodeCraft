import { useState, useEffect } from 'react';
import '../styles/HUD.css';

/* ── Load Google Fonts (same as Menu) ──────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("gol-fonts")) {
  const l = document.createElement("link");
  l.id = "gol-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=Rajdhani:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
}

const SLIDES = [
  {
    num: 1,
    title: "CLAIM LAND",
    icon: "🏴",
    desc: "Move outside your territory to draw a trail, then return to claim all enclosed land as yours.",
    visual: (
      <div className="slide-visual slide-claim">
        <div className="slide-grid">
          {Array.from({ length: 35 }, (_, i) => {
            const r = Math.floor(i / 7), c = i % 7;
            const owned = (r >= 2 && r <= 4 && c >= 1 && c <= 3);
            const trail = (r === 2 && c === 4) || (r === 1 && c === 4) || (r === 1 && c === 5);
            const player = (r === 1 && c === 5);
            return (
              <div key={i} className={`slide-cell${owned ? " owned" : ""}${trail ? " trail" : ""}${player ? " player" : ""}`}>
                {player && <div className="slide-player-icon">▶</div>}
              </div>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    num: 2,
    title: "KNOCKOUT PLAYERS",
    icon: "⚔️",
    desc: "Cross an opponent's trail before they close it to eliminate them and steal their territory.",
    visual: (
      <div className="slide-visual slide-knockout">
        <div className="slide-grid">
          {Array.from({ length: 35 }, (_, i) => {
            const r = Math.floor(i / 7), c = i % 7;
            const enemyTrail = (r === 2 && c >= 1 && c <= 5);
            const enemy = (r === 2 && c === 5);
            const player = (r === 2 && c === 3);
            const enemyBase = (r >= 1 && r <= 3 && c === 6);
            return (
              <div key={i} className={`slide-cell${enemyTrail ? " enemy-trail" : ""}${enemy ? " enemy" : ""}${enemyBase ? " enemy-base" : ""}${player ? " attacker" : ""}`}>
                {player && <div className="slide-player-icon attack">💥</div>}
                {enemy && !player && <div className="slide-player-icon enemy-icon">◀</div>}
              </div>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    num: 3,
    title: "GROW TERRITORY",
    icon: "👑",
    desc: "The more land you claim, the higher your score. Dominate the map to top the leaderboard!",
    visual: (
      <div className="slide-visual slide-grow">
        <div className="slide-grid">
          {Array.from({ length: 35 }, (_, i) => {
            const r = Math.floor(i / 7), c = i % 7;
            const zone1 = (r >= 0 && r <= 2 && c >= 0 && c <= 2);
            const zone2 = (r >= 2 && r <= 4 && c >= 4 && c <= 6);
            const crown = (r === 1 && c === 1);
            return (
              <div key={i} className={`slide-cell${zone1 ? " owned" : ""}${zone2 ? " enemy-base" : ""}${crown ? " crown" : ""}`}>
                {crown && <div className="slide-player-icon">👑</div>}
              </div>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    num: 4,
    title: "CONTROLS",
    icon: "🎮",
    desc: null,
    visual: (
      <div className="slide-visual slide-controls-visual">
        <div className="slide-keys-group">
          <div className="slide-keys-label">‹TO MOVE›</div>
          <div className="slide-keys-row">
            <div className="slide-keys-wasd">
              <div className="slide-key-grid">
                <span /><kbd>W</kbd><span />
                <kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
              </div>
            </div>
            <span className="slide-keys-or">OR</span>
            <div className="slide-keys-arrows">
              <div className="slide-key-grid">
                <span /><kbd>↑</kbd><span />
                <kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function HUD({ playerName, kills, deaths, score, playerCount, roomCode, onLeaveRoom }) {
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const kd = deaths > 0 ? (kills / deaths).toFixed(1) : kills.toFixed(1);

  const [slideIndex, setSlideIndex] = useState(0);

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex(prev => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[slideIndex];

  return (
    <div className="hud-container">
      {/* Player card */}
      <div className="hud-card hud-player">
        <div className="hud-card-header">
          <span className="hud-card-icon">&#x1F3AE;</span>
          <span className="hud-card-title">PLAYER</span>
        </div>
        <div className="hud-player-name">{playerName}</div>
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

      {/* Instructions slideshow card */}
      <div className="hud-card hud-controls">
        <div className="hud-slide-header">
          <span className="hud-slide-num">{slide.num}</span>
          <span className="hud-slide-title">{slide.title}</span>
        </div>
        <div className="hud-slide-content" key={slideIndex}>
          {slide.visual}
          {slide.desc && <div className="hud-slide-desc">{slide.desc}</div>}
        </div>
        {/* Dots */}
        <div className="hud-slide-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`hud-slide-dot${i === slideIndex ? " active" : ""}`}
              onClick={() => setSlideIndex(i)}
            />
          ))}
        </div>
        <button onClick={onLeaveRoom} className="hud-leave-btn">
          EXIT GAME
        </button>
      </div>
    </div>
  );
}
