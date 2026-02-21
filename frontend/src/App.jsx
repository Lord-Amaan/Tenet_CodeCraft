import { useState, useEffect, useRef } from 'react';
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

  // Store join info in refs so the effect listener can access latest values
  const roomCodeRef = useRef(null);
  const playerIdRef = useRef(null);

  // Single persistent listener for game updates (stats for HUD)
  useEffect(() => {
    const handleGameUpdate = (data) => {
      if (data && data.roomCode === roomCodeRef.current) {
        const player = data.gameState.players.find((p) => p.id === playerIdRef.current);
        if (player) {
          setPlayerStats({
            kills: player.kills,
            deaths: player.deaths,
            score: player.score,
            playerCount: data.playerCount,
          });
        }
      }
    };

    socketService.on('game:update', handleGameUpdate);
    return () => socketService.off('game:update', handleGameUpdate);
  }, []);

  const handleJoinRoom = (code, name, id) => {
    console.log('📍 handleJoinRoom called:', { code, name, id });
    roomCodeRef.current = code;
    playerIdRef.current = id;
    setRoomCode(code);
    setPlayerName(name);
    setPlayerId(id);
    setGameState('playing');
  };

  const handleLeaveRoom = () => {
    socketService.emit('room:leave');
    roomCodeRef.current = null;
    playerIdRef.current = null;
    setGameState('menu');
    setRoomCode(null);
    setPlayerName(null);
    setPlayerId(null);
  };

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
            />
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
            <Leaderboard />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
