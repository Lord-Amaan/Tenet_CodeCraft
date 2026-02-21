import { useState, useEffect } from 'react';
import { socketService } from '../services/socket';
import '../styles/Menu.css';

// Safely import Clerk components — no-ops if Clerk isn't loaded
let SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser;
try {
  const clerk = await import('@clerk/clerk-react');
  SignedIn = clerk.SignedIn;
  SignedOut = clerk.SignedOut;
  SignInButton = clerk.SignInButton;
  SignUpButton = clerk.SignUpButton;
  UserButton = clerk.UserButton;
  useUser = clerk.useUser;
} catch {
  // Fallback components when Clerk is not available
  SignedIn = ({ children }) => null;
  SignedOut = ({ children }) => children;
  SignInButton = ({ children }) => null;
  SignUpButton = ({ children }) => null;
  UserButton = () => null;
  useUser = () => ({ isSignedIn: false, user: null, isLoaded: true });
}

const ELEMENTS = [
  { name: 'LAVA', colorIndex: 0, emoji: '🔥', bg: '#cc2200', border: '#ff4422', glow: 'rgba(255,68,34,0.4)' },
  { name: 'OCEAN', colorIndex: 1, emoji: '🌊', bg: '#0044cc', border: '#4488ff', glow: 'rgba(68,136,255,0.4)' },
  { name: 'FUNGI', colorIndex: 2, emoji: '🍄', bg: '#00aa44', border: '#44ff88', glow: 'rgba(68,255,136,0.4)' },
  { name: 'EARTH', colorIndex: 3, emoji: '🌍', bg: '#cc8800', border: '#ffaa44', glow: 'rgba(255,170,68,0.4)' },
  { name: 'CRYSTAL', colorIndex: 4, emoji: '💎', bg: '#8800cc', border: '#bb44ff', glow: 'rgba(187,68,255,0.4)' },
  { name: 'FROST', colorIndex: 5, emoji: '❄️', bg: '#00aaaa', border: '#44ffff', glow: 'rgba(68,255,255,0.4)' },
];

export function Menu({ onJoinRoom }) {
  const { isSignedIn, user, isLoaded } = useUser();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState(0);
  const [activeTab, setActiveTab] = useState('select');
  const [error, setError] = useState('');

  // Auto-fill name from Clerk user
  useEffect(() => {
    if (isSignedIn && user && !playerName) {
      setPlayerName(user.fullName || user.username || user.firstName || '');
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    const loadRooms = async () => {
      try {
        await socketService.connect();
        socketService.emit('room:list', (data) => {
          setRooms(data.rooms);
        });
      } catch (err) {
        console.error('Failed to load rooms:', err);
      }
    };
    loadRooms();
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) { setError('Enter your name to play'); return; }
    setLoading(true);
    setError('');
    try {
      socketService.emit('room:create', (data) => {
        if (!data || !data.roomCode) { setError('Failed to create room'); setLoading(false); return; }
        socketService.emit('room:join', data.roomCode, playerName, selectedElement, (joinData) => {
          if (joinData && joinData.success) {
            onJoinRoom(joinData.roomCode, playerName, joinData.playerId);
          } else {
            setError(joinData?.error || 'Failed to join created room');
            setLoading(false);
          }
        });
      });
    } catch (err) { setError('Failed to create room'); setLoading(false); }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) { setError('Enter your name to play'); return; }
    if (!roomCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true);
    setError('');
    try {
      socketService.emit('room:join', roomCode.toUpperCase(), playerName, selectedElement, (data) => {
        if (data && data.success) {
          onJoinRoom(data.roomCode, playerName, data.playerId);
        } else {
          setError(data?.error || 'Failed to join room');
          setLoading(false);
        }
      });
    } catch (err) { setError('Failed to join room'); setLoading(false); }
  };

  const handleQuickJoin = (code) => {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    setLoading(true);
    setError('');
    socketService.emit('room:join', code, playerName, selectedElement, (data) => {
      if (data && data.success) {
        onJoinRoom(data.roomCode, playerName, data.playerId);
      } else {
        setError(data?.error || 'Failed to join room');
        setLoading(false);
      }
    });
  };

  return (
    <div className="menu-container">
      <div className="menu-bg-grid" />

      <div className="menu-card">
        {/* Title */}
        <div className="menu-title">
          <span className="title-icon">🍄</span>
          <h1>GameOfLands</h1>
          <p className="subtitle">TERRITORY WARS</p>
        </div>

        {/* Auth Section */}
        <div className="auth-section">
          <SignedIn>
            <div className="auth-signed-in">
              <UserButton afterSignOutUrl="/" />
              <span className="auth-welcome">
                Welcome, <strong>{user?.firstName || user?.username || 'Player'}</strong>
              </span>
              <span className="auth-badge auth-badge-pro">✓ Stats saved</span>
            </div>
          </SignedIn>
          <SignedOut>
            <div className="auth-guest-banner">
              <span className="guest-banner-text">
                🎮 Playing as Guest — sign in to save progress
              </span>
              <div className="auth-buttons">
                <SignInButton mode="modal">
                  <button className="auth-btn auth-signin-btn">Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="auth-btn auth-signup-btn">Sign Up</button>
                </SignUpButton>
              </div>
            </div>
          </SignedOut>
        </div>

        {/* Player Name */}
        <div className="name-section">
          <label className="field-label">PLAYER NAME</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength="20"
            className="name-input"
            autoFocus
          />
        </div>

        {/* Element Selection */}
        <div className="element-section">
          <label className="field-label">CHOOSE YOUR ELEMENT</label>
          <div className="element-grid">
            {ELEMENTS.map((el) => (
              <button
                key={el.colorIndex}
                className={`element-card ${selectedElement === el.colorIndex ? 'selected' : ''}`}
                onClick={() => setSelectedElement(el.colorIndex)}
                style={{
                  '--el-bg': el.bg,
                  '--el-border': el.border,
                  '--el-glow': el.glow,
                }}
              >
                <span className="element-emoji">{el.emoji}</span>
                <span className="element-name">{el.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <div className="menu-error">{error}</div>}

        {/* Room Tabs */}
        <div className="room-tabs">
          <button className={`room-tab ${activeTab === 'select' ? 'active' : ''}`} onClick={() => setActiveTab('select')}>
            BROWSE
          </button>
          <button className={`room-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
            CREATE
          </button>
          <button className={`room-tab ${activeTab === 'join' ? 'active' : ''}`} onClick={() => setActiveTab('join')}>
            CODE
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-body">
          {activeTab === 'select' && (
            <div>
              {rooms.length > 0 ? (
                <div className="room-list">
                  {rooms.map((room) => (
                    <div key={room.code} className="room-item">
                      <div>
                        <span className="room-code-badge">{room.code}</span>
                        <span className="room-players">{room.playerCount} player{room.playerCount !== 1 ? 's' : ''}</span>
                      </div>
                      <button onClick={() => handleQuickJoin(room.code)} disabled={loading} className="join-btn">
                        JOIN
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-msg">No rooms yet — create one!</p>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateRoom} className="tab-form">
              <p className="form-desc">Create a new room and invite friends</p>
              <button type="submit" disabled={loading} className="action-btn create-btn">
                {loading ? 'CREATING...' : '⚡ CREATE ROOM'}
              </button>
            </form>
          )}

          {activeTab === 'join' && (
            <form onSubmit={handleJoinRoom} className="tab-form">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength="6"
                className="code-input"
              />
              <button type="submit" disabled={loading} className="action-btn join-action-btn">
                {loading ? 'JOINING...' : '🚀 JOIN ROOM'}
              </button>
            </form>
          )}
        </div>

        {/* Controls hint */}
        <div className="controls-hint">
          <span>⌨️ WASD / ARROWS to move</span>
          <span>·</span>
          <span>Capture territory · Avoid trails</span>
        </div>
      </div>
    </div>
  );
}
