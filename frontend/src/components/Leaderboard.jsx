import { useState, useEffect } from 'react';
import { socketService } from '../services/socket';
import '../styles/Leaderboard.css';

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const updateLeaderboard = () => {
      socketService.emit('leaderboard:get', (data) => {
        setLeaderboard(data.leaderboard);
      });
    };

    // Update leaderboard initially
    updateLeaderboard();

    // Update every 2 seconds
    const interval = setInterval(updateLeaderboard, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`leaderboard ${expanded ? 'expanded' : 'collapsed'}`}>
      <button className="toggle-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▼' : '▲'} Leaderboard
      </button>

      {expanded && (
        <div className="leaderboard-content">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Kills</th>
                <th>Deaths</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => (
                  <tr key={entry.name} className={index === 0 ? 'top' : ''}>
                    <td>{index + 1}</td>
                    <td>{entry.name}</td>
                    <td className="kills">{entry.kills}</td>
                    <td className="deaths">{entry.deaths}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">No leaderboard data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
