import { useState, useEffect } from 'react';
import { getShopCatalog, getWallet, buySkin, buyCoins } from '../services/api';

const SKIN_EMOJIS = {
  lava: '🔥', ocean: '🌊', fungi: '🍄', earth: '🌿', crystal: '💎', frost: '❄️',
};
const SKIN_COLORS = {
  lava:    { color: '#ff6b35', glow: '#ff9966', bg: 'rgba(255,107,53,0.15)', text: '#ffb899' },
  ocean:   { color: '#38a8f8', glow: '#80ccff', bg: 'rgba(56,168,248,0.15)',  text: '#a0d8ff' },
  fungi:   { color: '#e060cc', glow: '#f09ce0', bg: 'rgba(224,96,204,0.15)',  text: '#f0b0e8' },
  earth:   { color: '#5aba50', glow: '#90e080', bg: 'rgba(90,186,80,0.15)',   text: '#aaee99' },
  crystal: { color: '#40dde8', glow: '#90f4f8', bg: 'rgba(64,221,232,0.15)',  text: '#a0f0f5' },
  frost:   { color: '#99bbee', glow: '#ccdeff', bg: 'rgba(153,187,238,0.15)', text: '#cce0ff' },
};
const PACK_EMOJIS = { pack_small: '🪙', pack_medium: '💰', pack_large: '👑' };

export function Shop({ getToken, coins, unlockedSkins, onClose, onWalletUpdate }) {
  const [skins, setSkins] = useState([]);
  const [coinPacks, setCoinPacks] = useState([]);
  const [tab, setTab] = useState('skins'); // 'skins' | 'coins'
  const [busy, setBusy] = useState(null); // id of item being purchased
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getShopCatalog().then(data => {
      if (data.success) {
        setSkins(data.skins || []);
        setCoinPacks(data.coinPacks || []);
      }
    }).catch(() => {});
  }, []);

  const handleBuySkin = async (skinId) => {
    setBusy(skinId); setMsg('');
    try {
      const res = await buySkin(getToken, skinId);
      if (res.success) {
        onWalletUpdate(res.coins, res.unlockedSkins);
        setMsg(res.already ? 'Already owned!' : '✓ Skin unlocked!');
      } else {
        setMsg(res.error || 'Purchase failed');
      }
    } catch { setMsg('Network error'); }
    setBusy(null);
  };

  const handleBuyCoins = async (packId) => {
    setBusy(packId); setMsg('');
    try {
      const res = await buyCoins(getToken, packId);
      if (res.success) {
        onWalletUpdate(res.coins, unlockedSkins);
        setMsg(`+${res.added} coins added!`);
      } else {
        setMsg(res.error || 'Purchase failed');
      }
    } catch { setMsg('Network error'); }
    setBusy(null);
  };

  const owned = new Set(unlockedSkins || []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(4,6,4,0.92)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '94%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(160deg,rgba(16,14,8,0.98),rgba(9,11,7,0.99))',
        border: '1.5px solid rgba(212,180,80,0.28)', borderRadius: 14,
        padding: '20px 18px 24px',
        boxShadow: '0 0 80px rgba(212,180,80,0.1),0 30px 90px rgba(0,0,0,0.9)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{
              fontFamily: "'Cinzel Decorative', serif", fontWeight: 900,
              fontSize: 24, color: '#f0d060', letterSpacing: 2,
              textShadow: '0 0 22px rgba(240,208,96,0.6)',
            }}>🏪 Shop</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)',
            }}>
              <span style={{ fontSize: 16 }}>🪙</span>
              <span style={{
                fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 900,
                color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.5)',
              }}>{coins ?? 0}</span>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: '1.5px solid rgba(212,180,80,0.25)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              fontFamily: "'Rajdhani', sans-serif", fontSize: 13, fontWeight: 700,
              color: 'rgba(212,180,80,0.6)', letterSpacing: 1,
            }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,180,80,0.15)', marginBottom: 16 }}>
          {[['skins', '🎨 Skins'], ['coins', '🪙 Buy Coins']].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setMsg(''); }} style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Rajdhani', sans-serif", fontSize: 12, letterSpacing: 2, fontWeight: tab === id ? 700 : 500,
              color: tab === id ? '#f0d060' : 'rgba(212,180,80,0.35)', textTransform: 'uppercase',
              borderBottom: tab === id ? '2px solid #d4b450' : '2px solid transparent', marginBottom: -1,
              textShadow: tab === id ? '0 0 12px rgba(212,180,80,0.65)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            marginBottom: 12, padding: '8px 12px', borderRadius: 8, textAlign: 'center',
            background: msg.startsWith('✓') || msg.startsWith('+') ? 'rgba(90,186,80,0.1)' : 'rgba(232,64,64,0.08)',
            border: `1px solid ${msg.startsWith('✓') || msg.startsWith('+') ? 'rgba(90,186,80,0.3)' : 'rgba(232,64,64,0.3)'}`,
            color: msg.startsWith('✓') || msg.startsWith('+') ? '#66ff66' : '#ff6b6b',
            fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 1,
          }}>{msg}</div>
        )}

        {/* Skins tab */}
        {tab === 'skins' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {skins.map(skin => {
              const sc = SKIN_COLORS[skin.id] || SKIN_COLORS.earth;
              const isOwned = owned.has(skin.id);
              const isFree = skin.price === 0;
              const canAfford = coins >= skin.price;
              return (
                <div key={skin.id} style={{
                  padding: '16px 12px', borderRadius: 12, textAlign: 'center',
                  background: isOwned ? sc.bg : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${isOwned ? sc.color + '55' : 'rgba(212,180,80,0.12)'}`,
                  boxShadow: isOwned ? `0 0 20px ${sc.glow}22` : 'none',
                  opacity: !isOwned && !canAfford && !isFree ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    fontSize: 32, marginBottom: 6, lineHeight: 1,
                    filter: isOwned ? `drop-shadow(0 0 8px ${sc.glow})` : 'grayscale(0.5)',
                  }}>{SKIN_EMOJIS[skin.id] || '❓'}</div>
                  <div style={{
                    fontFamily: "'Rajdhani', sans-serif", fontSize: 13, fontWeight: 700,
                    letterSpacing: 2, textTransform: 'uppercase',
                    color: isOwned ? sc.text : 'rgba(212,180,80,0.5)',
                    marginBottom: 8,
                  }}>{skin.label}</div>
                  {isOwned ? (
                    <div style={{
                      padding: '5px 0', fontFamily: "'Rajdhani', sans-serif", fontSize: 10,
                      fontWeight: 700, letterSpacing: 2, color: '#66ff66', textTransform: 'uppercase',
                    }}>✓ OWNED</div>
                  ) : isFree ? (
                    <div style={{
                      padding: '5px 0', fontFamily: "'Rajdhani', sans-serif", fontSize: 10,
                      fontWeight: 700, letterSpacing: 2, color: '#66ff66', textTransform: 'uppercase',
                    }}>FREE</div>
                  ) : (
                    <button
                      disabled={!canAfford || busy === skin.id}
                      onClick={() => handleBuySkin(skin.id)}
                      style={{
                        width: '100%', padding: '7px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                        background: canAfford
                          ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))'
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${canAfford ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 700,
                        letterSpacing: 1,
                        color: canAfford ? '#ffd700' : 'rgba(255,255,255,0.3)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {busy === skin.id ? '...' : `🪙 ${skin.price}`}
                    </button>
                  )}
                  {!isOwned && !isFree && !canAfford && (
                    <div style={{
                      marginTop: 4, fontFamily: "'Rajdhani', sans-serif", fontSize: 9,
                      color: 'rgba(232,64,64,0.6)', letterSpacing: 1,
                    }}>Need {skin.price - coins} more</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Coin packs tab */}
        {tab === 'coins' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coinPacks.map(pack => (
              <div key={pack.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,215,0,0.04)',
                border: '1px solid rgba(255,215,0,0.15)',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 28 }}>{PACK_EMOJIS[pack.id] || '🪙'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 700,
                    color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.4)',
                  }}>{pack.label}</div>
                  <div style={{
                    fontFamily: "'Rajdhani', sans-serif", fontSize: 10, fontWeight: 600,
                    color: 'rgba(212,180,80,0.5)', letterSpacing: 2, textTransform: 'uppercase',
                  }}>{pack.coins} coins added to wallet</div>
                </div>
                <button
                  disabled={busy === pack.id}
                  onClick={() => handleBuyCoins(pack.id)}
                  style={{
                    padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: 'linear-gradient(135deg,#a87818,#d4a828 35%,#ffe068 55%,#d4a828 75%,#8a6018)',
                    fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 900,
                    color: '#1c0e00', letterSpacing: 2, textTransform: 'uppercase',
                    boxShadow: '0 0 20px rgba(212,180,80,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {busy === pack.id ? '...' : pack.price}
                </button>
              </div>
            ))}
            <div style={{
              marginTop: 8, padding: '10px', borderRadius: 8, textAlign: 'center',
              background: 'rgba(212,180,80,0.04)', border: '1px solid rgba(212,180,80,0.1)',
              fontFamily: "'Rajdhani', sans-serif", fontSize: 10, color: 'rgba(212,180,80,0.4)',
              letterSpacing: 2, lineHeight: 1.6,
            }}>
              💡 You also earn coins by playing!<br/>
              Kill = +2 🪙 &nbsp; Win round = +10 🪙 &nbsp; Death = -1 🪙
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
