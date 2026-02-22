import { useState, useCallback, useEffect, useRef } from 'react';
import { Menu } from './components/Menu';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { Leaderboard } from './components/Leaderboard';
import { socketService } from './services/socket';
import { getGuestGames, saveGuestGame, clearGuestStats, hasGuestStats } from './services/guestStats';
import { saveScore, syncGuestStats } from './services/api';
import './App.css';

// Safely import Clerk hooks — returns fallbacks if ClerkProvider not present
let useUser, useAuth, useClerk;
try {
  const clerk = await import('@clerk/clerk-react');
  if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    useUser = clerk.useUser;
    useAuth = clerk.useAuth;
    useClerk = clerk.useClerk;
  }
} catch {
  // Clerk not available
}
if (!useUser) useUser = () => ({ isSignedIn: false, user: null, isLoaded: true });
if (!useAuth) useAuth = () => ({ getToken: null, signOut: null });
if (!useClerk) useClerk = () => ({ openSignIn: null, openSignUp: null });

function App() {
  const [gameState, setGameState] = useState('menu'); // 'menu' or 'playing'
  const [roomCode, setRoomCode] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerStats, setPlayerStats] = useState({
    kills: 0,
    deaths: 0,
    score: 0,
    coins: 0,
    playerCount: 0,
    minimapData: null,
  });

  // Auth state
  const { isSignedIn, user, isLoaded } = useUser();
  const { getToken, signOut } = useAuth();
  const { openSignIn, openSignUp } = useClerk();
  const [guestSynced, setGuestSynced] = useState(false);

  // Session tracking for periodic saves
  const sessionIdRef = useRef(null);
  const autoSaveRef = useRef(null);
  const playerStatsRef = useRef(playerStats);
  const playerNameRef = useRef(playerName);

  // Keep refs in sync
  useEffect(() => { playerStatsRef.current = playerStats; }, [playerStats]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

  // ── Sync guest stats to backend when user signs in ─────────────────
  useEffect(() => {
    if (!isSignedIn || !user || guestSynced || !getToken) return;

    const doSync = async () => {
      if (hasGuestStats()) {
        try {
          const games = getGuestGames();
          const result = await syncGuestStats(getToken, games, user.fullName || user.username || 'Player');
          if (result.success) {
            clearGuestStats();
            console.log(`✅ Synced ${result.synced} guest game(s) to your account`);
          }
        } catch (err) {
          console.error('Failed to sync guest stats:', err);
        }
      }
      setGuestSynced(true);
    };

    doSync();
  }, [isSignedIn, user, guestSynced, getToken]);

  const handleJoinRoom = (code, name, id) => {
    // Generate a unique session ID for this game session
    sessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setRoomCode(code);
    setPlayerName(name);
    setPlayerId(id);
    setGameState('playing');

    // Start periodic auto-save every 15 seconds
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    autoSaveRef.current = setInterval(() => {
      const stats = playerStatsRef.current;
      const pName = playerNameRef.current;
      const sid = sessionIdRef.current;

      if (isSignedIn && getToken && sid) {
        saveScore(getToken, {
          score: stats.score,
          kills: stats.kills,
          deaths: stats.deaths,
          territoryPercent: 0,
          username: pName,
          sessionId: sid,
        })
          .then(() => console.log('🔄 Auto-saved to DB'))
          .catch(err => console.warn('Auto-save failed:', err));
      } else if (sid) {
        // Guest auto-save to localStorage (overwrite latest)
        saveGuestGame({
          score: stats.score,
          kills: stats.kills,
          deaths: stats.deaths,
          territoryPercent: 0,
        });
        console.log('🔄 Auto-saved locally');
      }
    }, 15000);
  };

  const handleLeaveRoom = () => {
    // Stop auto-save interval
    if (autoSaveRef.current) {
      clearInterval(autoSaveRef.current);
      autoSaveRef.current = null;
    }

    // Final save with session ID
    const stats = {
      score: playerStats.score,
      kills: playerStats.kills,
      deaths: playerStats.deaths,
      territoryPercent: 0,
      username: playerName,
      sessionId: sessionIdRef.current,
    };

    if (isSignedIn && getToken) {
      // Authenticated — final save to backend (upserts same session record)
      saveScore(getToken, stats)
        .then(r => console.log('✅ Final stats saved to DB'))
        .catch(err => console.error('Failed to save score:', err));
    } else {
      // Guest — save to localStorage
      saveGuestGame(stats);
      console.log('✅ Guest stats saved locally');
    }

    sessionIdRef.current = null;
    socketService.emit('room:leave');
    setGameState('menu');
    setRoomCode(null);
    setPlayerName(null);
    setPlayerId(null);
  };

  const handleStatsUpdate = useCallback((stats) => {
    setPlayerStats(stats);
  }, []);

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  return (
    <div className="app">
      {gameState === 'menu' ? (
        <Menu
          onJoinRoom={handleJoinRoom}
          isSignedIn={isSignedIn}
          user={user}
          getToken={getToken}
          signOut={signOut}
          openSignIn={openSignIn}
          openSignUp={openSignUp}
        />
      ) : (
        <div className="game-layout">
          <div className="game-main">
            <GameCanvas
              roomCode={roomCode}
              playerName={playerName}
              playerId={playerId}
              onLeaveRoom={handleLeaveRoom}
              onStatsUpdate={handleStatsUpdate}
              getToken={getToken}
              isSignedIn={isSignedIn}
            />
            <Leaderboard />
          </div>
          <div className="game-sidebar">
            <HUD
              playerName={playerName}
              kills={playerStats.kills}
              deaths={playerStats.deaths}
              score={playerStats.score}
              coins={playerStats.coins}
              playerCount={playerStats.playerCount}
              roomCode={roomCode}
              onLeaveRoom={handleLeaveRoom}
              playerId={playerId}
              minimapData={playerStats.minimapData}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
