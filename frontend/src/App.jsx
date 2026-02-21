import { useState, useCallback, useEffect } from 'react';
import { Menu } from './components/Menu';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { Leaderboard } from './components/Leaderboard';
import { socketService } from './services/socket';
import { guestStats } from './services/guestStats';
import { api } from './services/api';
import './App.css';

// Safely import Clerk hooks — returns nulls if ClerkProvider not present
let useUser, useAuth;
try {
  const clerk = await import('@clerk/clerk-react');
  useUser = clerk.useUser;
  useAuth = clerk.useAuth;
} catch {
  useUser = () => ({ isSignedIn: false, user: null, isLoaded: true });
  useAuth = () => ({ getToken: null });
}

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

  // Auth state
  const { isSignedIn, user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [guestSynced, setGuestSynced] = useState(false);

  // ── Sync guest stats to backend when user signs in ─────────────────
  useEffect(() => {
    if (!isSignedIn || !user || guestSynced || !getToken) return;

    const syncGuestData = async () => {
      if (guestStats.hasStats()) {
        try {
          const games = guestStats.getAll();
          await api.syncGuest(games, user.fullName || user.username || 'Player', getToken);
          guestStats.clear();
          console.log(`✅ Synced ${games.length} guest game(s) to your account`);
        } catch (err) {
          console.error('Failed to sync guest stats:', err);
        }
      }
      setGuestSynced(true);
    };

    syncGuestData();
  }, [isSignedIn, user, guestSynced, getToken]);

  const handleJoinRoom = (code, name, id) => {
    console.log('📍 handleJoinRoom called:', { code, name, id });
    setRoomCode(code);
    setPlayerName(name);
    setPlayerId(id);
    setGameState('playing');
  };

  const handleLeaveRoom = () => {
    // Save game stats
    const stats = {
      score: playerStats.score,
      kills: playerStats.kills,
      deaths: playerStats.deaths,
      territoryPercent: 0,
    };

    if (isSignedIn && getToken) {
      // Authenticated — save to backend
      api.saveScore({ ...stats, username: user?.fullName || user?.username || playerName }, getToken)
        .catch(err => console.error('Failed to save score:', err));
    } else {
      // Guest — save to localStorage
      guestStats.save(stats);
    }

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
