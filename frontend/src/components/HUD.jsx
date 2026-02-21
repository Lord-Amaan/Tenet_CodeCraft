import '../styles/HUD.css';

export function HUD({ playerName, kills, deaths, score, playerCount, roomCode, onLeaveRoom }) {
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert('Room code copied to clipboard!');
  };

  return (
    <div className="hud-container">
      <div className="hud-section player-info">
        <h3>Player Info</h3>
        <p><strong>Name:</strong> {playerName}</p>
        <p><strong>Score:</strong> {score}</p>
        <p><strong>Kills:</strong> {kills}</p>
        <p><strong>Deaths:</strong> {deaths}</p>
      </div>

      <div className="hud-section room-info">
        <h3>Room</h3>
        <div className="room-code-display">
          <strong>{roomCode}</strong>
          <button onClick={copyRoomCode} className="copy-btn" title="Copy room code">
            📋
          </button>
        </div>
        <p><strong>Players:</strong> {playerCount}</p>
      </div>

      <div className="hud-section controls">
        <h3>Controls</h3>
        <p>↑↓←→ or WASD - Move</p>
        <button onClick={onLeaveRoom} className="leave-btn">
          Leave Room
        </button>
      </div>
    </div>
  );
}
