import { useState, useCallback } from 'react';
import { Menu } from './components/Menu';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { Leaderboard } from './components/Leaderboard';
import { socketService } from './services/socket';
import './App.css';

function App() {
  const [gameState, setGameState] = useState('menu'); // 'menu' or 'playing'
  const [roomCode, setRoomCode] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerStats, setPlayerStats] = useState({
    kills: 0,
    deaths: 0,
    score: 0,
    playerCount: 0,
  });

  const handleJoinRoom = (code, name, id) => {
    console.log('📍 handleJoinRoom called:', { code, name, id });
    setRoomCode(code);
    setPlayerName(name);
    setPlayerId(id);
    setGameState('playing');
  };

  const handleLeaveRoom = () => {
    socketService.emit('room:leave');
    setGameState('menu');
    setRoomCode(null);
    setPlayerName(null);
    setPlayerId(null);
  };

  const handleStatsUpdate = useCallback((stats) => {
    setPlayerStats(stats);
  }, []);

  return (
    <div className="app">
      {gameState === 'menu' ? (
        <Menu onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="game-layout">
          <div className="game-main">
            <GameCanvas
              roomCode={roomCode}
              playerName={playerName}
              playerId={playerId}
              onLeaveRoom={handleLeaveRoom}
              onStatsUpdate={handleStatsUpdate}
            />
            <Leaderboard />
          </div>
          <div className="game-sidebar">
            <HUD
              playerName={playerName}
              kills={playerStats.kills}
              deaths={playerStats.deaths}
              score={playerStats.score}
              playerCount={playerStats.playerCount}
              roomCode={roomCode}
              onLeaveRoom={handleLeaveRoom}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
