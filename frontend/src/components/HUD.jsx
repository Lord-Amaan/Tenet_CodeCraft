import '../styles/HUD.css';

export function HUD({ playerName, kills, deaths, score, playerCount, roomCode, onLeaveRoom }) {
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const kd = deaths > 0 ? (kills / deaths).toFixed(1) : kills.toFixed(1);

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

      {/* Controls card */}
      <div className="hud-card hud-controls">
        <div className="hud-card-header">
          <span className="hud-card-icon">&#x2328;</span>
          <span className="hud-card-title">CONTROLS</span>
        </div>
        <div className="hud-keys-grid">
          <div className="hud-key-row">
            <kbd>W</kbd>
            <span>Move Up</span>
          </div>
          <div className="hud-key-row">
            <kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
            <span>Left / Down / Right</span>
          </div>
        </div>
        <button onClick={onLeaveRoom} className="hud-leave-btn">
          EXIT GAME
        </button>
      </div>
    </div>
  );
}
