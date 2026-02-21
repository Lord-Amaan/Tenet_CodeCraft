import { useState, useEffect } from 'react';
import { socketService } from '../services/socket';
import '../styles/Leaderboard.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const updateLeaderboard = () => {
      socketService.emit('leaderboard:get', (data) => {
        setLeaderboard(data.leaderboard);
      });
    };
    updateLeaderboard();
    const interval = setInterval(updateLeaderboard, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`lb ${expanded ? 'lb-open' : 'lb-closed'}`}>
      <button className="lb-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="lb-toggle-icon">{expanded ? '▾' : '▸'}</span>
        <span className="lb-toggle-text">LEADERBOARD</span>
        <span className="lb-count">{leaderboard.length}</span>
      </button>

      {expanded && (
        <div className="lb-body">
          {leaderboard.length > 0 ? (
            <div className="lb-list">
              {leaderboard.map((entry, i) => (
                <div key={entry.name} className={`lb-row ${i === 0 ? 'lb-first' : ''} ${i < 3 ? 'lb-top3' : ''}`}>
                  <span className="lb-rank">{i < 3 ? MEDALS[i] : `#${i + 1}`}</span>
                  <span className="lb-name">{entry.name}</span>
                  <div className="lb-kd">
                    <span className="lb-k">{entry.kills}</span>
                    <span className="lb-sep">/</span>
                    <span className="lb-d">{entry.deaths}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="lb-empty">No players yet</p>
          )}
        </div>
      )}
    </div>
  );
}
