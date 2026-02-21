import { useEffect, useRef, useState } from 'react';
import { socketService } from '../services/socket';
import '../styles/GameCanvas.css';

export function GameCanvas({ roomCode, playerName, playerId, onLeaveRoom }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState({ players: [] });
  const [playerCount, setPlayerCount] = useState(1);
  const [localPlayer, setLocalPlayer] = useState(null);
  const keysPressed = useRef({});

  // Create refs to store latest state without triggering re-renders
  const gameStateRef = useRef(gameState);
  const localPlayerRef = useRef(localPlayer);
  const playerCountRef = useRef(playerCount);
  const playerNameRef = useRef(playerName);
  const playerIdRef = useRef(playerId);
  const roomCodeRef = useRef(roomCode);

  const CELL_SIZE = 32; // pixels per cell
  const GRID_SIZE = 100; // 100x100 grid
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Tile colors
  const TILE_COLORS = {
    grass: '#90EE90',
    water: '#4192FF',
    stone: '#A9A9A9',
  };

  // Sync refs when state changes (don't depend on these in effects!)
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    localPlayerRef.current = localPlayer;
  }, [localPlayer]);

  useEffect(() => {
    playerCountRef.current = playerCount;
  }, [playerCount]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  // Send movement to server
  const sendMovement = () => {
    const direction = {
      up: keysPressed.current['w'] || keysPressed.current['arrowup'],
      down: keysPressed.current['s'] || keysPressed.current['arrowdown'],
      left: keysPressed.current['a'] || keysPressed.current['arrowleft'],
      right: keysPressed.current['d'] || keysPressed.current['arrowright'],
    };

    socketService.emit('player:move', direction);
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;

      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.current[key] = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;

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

  // Continuous movement loop
  useEffect(() => {
    const movementInterval = setInterval(() => {
      sendMovement();
    }, 50);

    return () => clearInterval(movementInterval);
  }, []);

  // Socket events
  useEffect(() => {
    const handleGameUpdate = (data) => {
      if (data && data.roomCode === roomCodeRef.current) {
        setGameState(data.gameState);
        setPlayerCount(data.playerCount);

        // Find local player by stable ID
        const local = data.gameState.players.find(
          (p) => p.id === playerIdRef.current
        );
        // NEVER reset to null - keep previous value if temporarily missing
        if (local) {
          console.log('✅ Local player found:', local);
          setLocalPlayer(local);
        } else {
          console.warn('⚠️ Local player NOT found in update. Looking for ID:', playerIdRef.current, 'Available players:', data.gameState.players.map(p => p.id));
        }
      }
    };

    const handlePlayerJoined = (data) => {
      if (data && data.gameState) {
        setGameState(data.gameState);
        setPlayerCount(data.playerCount);
        
        // Find local player by stable ID
        const local = data.gameState.players.find(
          (p) => p.id === playerIdRef.current
        );
        // NEVER reset to null - keep previous value if temporarily missing
        if (local) {
          setLocalPlayer(local);
        }
      }
    };

    const handlePlayerLeft = (data) => {
      if (data && data.playerCount !== undefined) {
        setPlayerCount(data.playerCount);
      }
    };

    socketService.on('game:update', handleGameUpdate);
    socketService.on('room:playerJoined', handlePlayerJoined);
    socketService.on('room:playerLeft', handlePlayerLeft);

    // Cleanup for these specific handlers
    return () => {
      socketService.off('game:update', handleGameUpdate);
      socketService.off('room:playerJoined', handlePlayerJoined);
      socketService.off('room:playerLeft', handlePlayerLeft);
    };
  }, []);

  // Game rendering - runs only ONCE
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;

    const renderGame = () => {
      // Read from refs - always get latest state
      const gameState = gameStateRef.current;
      const localPlayer = localPlayerRef.current;
      const playerCount = playerCountRef.current;
      const playerName = playerNameRef.current;

      // Clear canvas with default background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (!localPlayer) {
        // Loading state
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for game data...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        animationId = requestAnimationFrame(renderGame);
        return;
      }

      // Calculate camera position (center on local player)
      const cameraX = Math.max(0, Math.min(
        (GRID_SIZE * CELL_SIZE) - CANVAS_WIDTH,
        (localPlayer.gridX * CELL_SIZE) - (CANVAS_WIDTH / 2)
      ));

      const cameraY = Math.max(0, Math.min(
        (GRID_SIZE * CELL_SIZE) - CANVAS_HEIGHT,
        (localPlayer.gridY * CELL_SIZE) - (CANVAS_HEIGHT / 2)
      ));

      // Draw grid background
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw grid cells (visible area only)
      const startGridX = Math.floor(cameraX / CELL_SIZE);
      const startGridY = Math.floor(cameraY / CELL_SIZE);
      const endGridX = Math.ceil((cameraX + CANVAS_WIDTH) / CELL_SIZE);
      const endGridY = Math.ceil((cameraY + CANVAS_HEIGHT) / CELL_SIZE);

      for (let y = startGridY; y < endGridY && y < GRID_SIZE; y++) {
        for (let x = startGridX; x < endGridX && x < GRID_SIZE; x++) {
          const screenX = (x * CELL_SIZE) - cameraX;
          const screenY = (y * CELL_SIZE) - cameraY;

          // Randomize tile colors based on position (for visual variety)
          let tileColor = TILE_COLORS.grass;
          const seed = (x * 73856093) ^ (y * 19349663);
          const rand = Math.abs(Math.sin(seed)) % 1;

          if (rand > 0.85) {
            tileColor = TILE_COLORS.water;
          } else if (rand > 0.7) {
            tileColor = TILE_COLORS.stone;
          }

          ctx.fillStyle = tileColor;
          ctx.fillRect(screenX, screenY, CELL_SIZE, CELL_SIZE);

          // Draw grid lines
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(screenX, screenY, CELL_SIZE, CELL_SIZE);
        }
      }

      // Draw players
      gameState.players.forEach((player) => {
        const screenX = (player.gridX * CELL_SIZE) - cameraX;
        const screenY = (player.gridY * CELL_SIZE) - cameraY;

        // Draw player box
        ctx.fillStyle = player.color;
        ctx.fillRect(screenX + 2, screenY + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        // Draw border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX + 2, screenY + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        // Draw player name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2);

        // Highlight local player
        if (player.name === playerName) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 3;
          ctx.strokeRect(screenX + 1, screenY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        }
      });

      // Draw HUD (top-left)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(5, 5, 200, 100);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Player: ${playerName}`, 15, 25);

      ctx.font = '12px Arial';
      ctx.fillText(`Kills: ${localPlayer.kills}`, 15, 45);
      ctx.fillText(`Deaths: ${localPlayer.deaths}`, 15, 60);
      ctx.fillText(`Score: ${localPlayer.score}`, 15, 75);
      ctx.fillText(`Players: ${playerCount}`, 15, 90);

      animationId = requestAnimationFrame(renderGame);
    };

    renderGame();

    // Cleanup - cancel animation frame
    return () => cancelAnimationFrame(animationId);
  }, []); // Empty dependency array - runs only ONCE

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>Land.io - Room {roomCode}</h2>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="game-canvas"
      />
      <div className="game-footer">
        <p>Use ↑↓←→ or WASD to move around the grid</p>
        <button onClick={onLeaveRoom} className="leave-btn">
          Leave Game
        </button>
      </div>
    </div>
  );
}
