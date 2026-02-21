import { useEffect, useRef, useState } from 'react';
import { socketService } from '../services/socket';

export function GameCanvas() {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState({ players: [] });
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const keysPressed = useRef({});

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
        keysPressed.current[key] = true;
        sendMovement();
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Send movement to server
  const sendMovement = () => {
    if (!joined) return;

    const direction = {
      up: keysPressed.current['arrowup'] || keysPressed.current['w'],
      down: keysPressed.current['arrowdown'] || keysPressed.current['s'],
      left: keysPressed.current['arrowleft'] || keysPressed.current['a'],
      right: keysPressed.current['arrowright'] || keysPressed.current['d'],
    };

    socketService.emit('player:move', direction);
  };

  // Game loop for rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const gameWidth = 800;
    const gameHeight = 600;

    const renderGame = () => {
      // Clear canvas
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, gameWidth, gameHeight);

      // Draw border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, gameWidth, gameHeight);

      // Draw players
      gameState.players.forEach((player) => {
        // Draw circle
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw name
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, player.x, player.y);

        // Draw score
        ctx.font = '10px Arial';
        ctx.fillText(`${player.score}`, player.x, player.y + player.radius + 12);
      });

      requestAnimationFrame(renderGame);
    };

    renderGame();
  }, [gameState]);

  // Socket events
  useEffect(() => {
    socketService.on('game:update', (state) => {
      setGameState(state);
    });

    socketService.on('game:state', (state) => {
      setGameState(state);
    });

    socketService.on('player:joined', (data) => {
      console.log('Player joined:', data.player.name);
    });

    socketService.on('player:left', (data) => {
      console.log('Player left. Total:', data.totalPlayers);
    });

    return () => {
      socketService.off('game:update', null);
      socketService.off('game:state', null);
      socketService.off('player:joined', null);
      socketService.off('player:left', null);
    };
  }, []);

  // Join game
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    try {
      await socketService.connect();
      socketService.emit('player:join', playerName);
      setJoined(true);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <h1>Tenet CodeCraft - Territory Wars</h1>
        <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
          />
          <button type="submit">Join Game</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1>Tenet CodeCraft - Territory Wars</h1>
      <div style={{ marginBottom: '10px' }}>
        <p>Player: <strong>{playerName}</strong> | Total Players: <strong>{gameState.players.length}</strong></p>
        <p>Controls: Arrow Keys or WASD</p>
      </div>
      <canvas ref={canvasRef} width={800} height={600} style={{ border: '2px solid #333' }} />
    </div>
  );
}
