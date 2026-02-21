import { useState, useEffect } from 'react';
import { socketService } from '../services/socket';
import '../styles/Menu.css';

export function Menu({ onJoinRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('select'); // 'select', 'create', 'join'
  const [error, setError] = useState('');

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
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      socketService.emit('room:create', (data) => {
        console.log('🎨 Room created:', data);
        if (!data || !data.roomCode) {
          setError('Failed to create room');
          setLoading(false);
          return;
        }
        
        // Now join the created room
        socketService.emit('room:join', data.roomCode, playerName, (joinData) => {
          console.log('🚪 Join response:', joinData);
          if (joinData && joinData.success) {
            onJoinRoom(joinData.roomCode, playerName, joinData.playerId);
          } else {
            setError(joinData?.error || 'Failed to join created room');
            setLoading(false);
          }
        });
      });
    } catch (err) {
      setError('Failed to create room');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      socketService.emit('room:join', roomCode.toUpperCase(), playerName, (data) => {
        if (data && data.success) {
          onJoinRoom(data.roomCode, playerName, data.playerId);
        } else {
          setError(data?.error || 'Failed to join room');
          setLoading(false);
        }
      });
    } catch (err) {
      console.error('Join room error:', err);
      setError('Failed to join room');
      setLoading(false);
    }
  };

  const handleQuickJoin = (code) => {
    setRoomCode(code);
    setActiveTab('join');
  };

  return (
    <div className="menu-container">
      <div className="menu-header">
        <h1>Land.io - Territory Wars</h1>
        <p>Claim your territory and dominate the grid!</p>
      </div>

      <div className="menu-content">
        <div className="player-input">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your player name"
            maxLength="20"
            autoFocus
          />
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTab('select')}
          >
            Join Room
          </button>
          <button
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Room
          </button>
          <button
            className={`tab ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Enter Code
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {activeTab === 'select' && (
          <div className="tab-content">
            <h3>Available Rooms ({rooms.length})</h3>
            {rooms.length > 0 ? (
              <div className="rooms-list">
                {rooms.map((room) => (
                  <div key={room.code} className="room-card">
                    <div className="room-info">
                      <strong className="room-code">{room.code}</strong>
                      <span className="player-count">
                        {room.playerCount} player{room.playerCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => handleQuickJoin(room.code)}
                      disabled={loading}
                      className="join-btn"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No rooms available. Create one!</p>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="tab-content">
            <form onSubmit={handleCreateRoom}>
              <p>Create a new room and invite your friends!</p>
              <button type="submit" disabled={loading} className="primary-btn">
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'join' && (
          <div className="tab-content">
            <form onSubmit={handleJoinRoom}>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code (e.g., ABC123)"
                maxLength="6"
              />
              <button type="submit" disabled={loading} className="primary-btn">
                {loading ? 'Joining...' : 'Join Room'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
