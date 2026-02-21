import { useState, useEffect } from 'react';
import { socketService } from '../services/socket';
import '../styles/Leaderboard.css';

const ELEMENT_META = [
  { name: 'LAVA',    emoji: '🔥', color: '#ff4444' },
  { name: 'OCEAN',   emoji: '🌊', color: '#4488ff' },
  { name: 'FUNGI',   emoji: '🍄', color: '#44dd66' },
  { name: 'EARTH',   emoji: '🌍', color: '#ffaa33' },
  { name: 'CRYSTAL', emoji: '💎', color: '#bb55ff' },
  { name: 'FROST',   emoji: '❄️',  color: '#44dddd' },
];

const RANK_LABELS = ['1st', '2nd', '3rd'];

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);

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

  if (leaderboard.length === 0) return null;

  return (
    <div className="lb-overlay">
      {leaderboard.map((entry, i) => {
        const meta = ELEMENT_META[entry.colorIndex] || ELEMENT_META[0];
        return (
          <div
            key={entry.name}
            className={`lb-entry ${i === 0 ? 'lb-entry-first' : ''}`}
            style={{ '--entry-color': meta.color, animationDelay: `${i * 0.06}s` }}
          >
            <span className="lb-entry-rank">{i < 3 ? RANK_LABELS[i] : `${i + 1}th`}</span>
            <span className="lb-entry-emoji">{meta.emoji}</span>
            <span className="lb-entry-name">{entry.name}</span>
            <span className="lb-entry-pct">{entry.territory}%</span>
          </div>
        );
      })}
    </div>
  );
}
