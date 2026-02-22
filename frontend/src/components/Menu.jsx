import { useState, useEffect, useRef } from 'react';
import { socketService } from '../services/socket';
import { getMyStats, getWallet } from '../services/api';
import { getGuestSummary } from '../services/guestStats';
import { Shop } from './Shop';
import { audioEngine } from '../services/audioEngine';

/* ── Load Google Fonts once ─────────────────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("gol-fonts")) {
  const l = document.createElement("link");
  l.id = "gol-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=Rajdhani:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
}

const TILE = 44;

const ELEMENTS = [
  { id:"lava",    colorIndex:0, emoji:"🔥", label:"LAVA",    color:"#ff6b35", glow:"#ff9966", bg:"rgba(255,107,53,0.22)",  textColor:"#ffb899" },
  { id:"ocean",   colorIndex:1, emoji:"🌊", label:"OCEAN",   color:"#38a8f8", glow:"#80ccff", bg:"rgba(56,168,248,0.20)",  textColor:"#a0d8ff" },
  { id:"fungi",   colorIndex:2, emoji:"🍄", label:"FUNGI",   color:"#e060cc", glow:"#f09ce0", bg:"rgba(224,96,204,0.20)",  textColor:"#f0b0e8" },
  { id:"earth",   colorIndex:3, emoji:"🌿", label:"EARTH",   color:"#5aba50", glow:"#90e080", bg:"rgba(90,186,80,0.20)",   textColor:"#aaee99" },
  { id:"crystal", colorIndex:4, emoji:"💎", label:"CRYSTAL", color:"#40dde8", glow:"#90f4f8", bg:"rgba(64,221,232,0.18)",  textColor:"#a0f0f5" },
  { id:"frost",   colorIndex:5, emoji:"❄️", label:"FROST",   color:"#99bbee", glow:"#ccdeff", bg:"rgba(153,187,238,0.18)", textColor:"#cce0ff" },
];

/* ── Seeded random for background grid ─────────────────────────────── */
function sRand(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xFFFFFFFF; };
}
const _r = sRand(1337);
const MAP_CELLS = Array.from({ length: 20 }, () =>
  Array.from({ length: 28 }, () => ({
    owned: _r() < 0.4 ? Math.floor(_r() * 4) + 1 : 0,
    shade: _r(),
  }))
);
const TERRITORY_COLORS = ["#5aba50","#ff6b35","#38a8f8","#e060cc"];

/* ── Embedded styles (animations + input classes) ──────────────────── */
const GOL_STYLES = `
  @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer   { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes borderPulse { 0%,100%{box-shadow:0 0 0 1px rgba(212,180,80,0.2),0 0 30px rgba(212,180,80,0.08)} 50%{box-shadow:0 0 0 1px rgba(212,180,80,0.55),0 0 50px rgba(212,180,80,0.2)} }
  @keyframes crownFloat  { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.07)} }
  @keyframes runeRotate  { to{transform:rotate(360deg)} }
  @keyframes trailPulse  { 0%,100%{opacity:0.5} 50%{opacity:1} }
  @keyframes pipPulse    { 0%,100%{opacity:0.85;transform:scale(1)} 50%{opacity:1;transform:scale(1.25)} }
  @keyframes readyGlow   { 0%,100%{box-shadow:0 0 16px rgba(90,186,80,0.25)} 50%{box-shadow:0 0 42px rgba(90,186,80,0.65)} }
  @keyframes errorShake  { 0%{transform:translateX(-6px)} 25%{transform:translateX(5px)} 50%{transform:translateX(-3px)} 75%{transform:translateX(2px)} 100%{transform:translateX(0)} }

  .gol-input {
    width:100%; padding:12px 16px;
    background:rgba(212,180,80,0.07);
    border:1.5px solid rgba(212,180,80,0.32); border-radius:7px;
    color:#f5e8b0; font-family:'Cinzel',serif; font-size:14px; font-weight:600;
    outline:none; letter-spacing:2px;
    transition:border-color .25s, box-shadow .25s, background .25s;
    text-shadow: 0 0 10px rgba(212,180,80,0.4);
    box-sizing:border-box;
  }
  .gol-input:focus {
    border-color:rgba(212,180,80,0.75)!important;
    box-shadow:0 0 0 3px rgba(212,180,80,0.13), 0 0 22px rgba(212,180,80,0.14)!important;
    background:rgba(212,180,80,0.11)!important;
  }
  .gol-input::placeholder { color:rgba(212,180,80,0.28); font-style:italic; font-weight:400; }

  .gol-code-input {
    width:100%; padding:14px 20px;
    background:rgba(212,180,80,0.07);
    border:1.5px solid rgba(212,180,80,0.3); border-radius:7px;
    color:#ffd060; font-family:'Cinzel',serif;
    font-size:28px; font-weight:700; letter-spacing:14px;
    text-transform:uppercase; text-align:center; outline:none;
    transition:border-color .25s, box-shadow .25s;
    text-shadow:0 0 20px rgba(255,200,60,0.65);
    box-sizing:border-box;
  }
  .gol-code-input:focus { border-color:rgba(212,180,80,0.7)!important; box-shadow:0 0 0 3px rgba(212,180,80,0.13)!important; }
  .gol-code-input::placeholder { color:rgba(212,180,80,0.2); letter-spacing:12px; }

  .el-btn { transition:all .22s cubic-bezier(.4,0,.2,1); cursor:pointer; position:relative; overflow:hidden; }
  .el-btn::after { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.07) 0%,transparent 60%); pointer-events:none; }
  .el-btn:hover { transform:scale(1.07) translateY(-3px)!important; }

  .room-row { transition:all .2s; cursor:pointer; border-radius:8px; }
  .room-row:hover { background:rgba(212,180,80,0.09)!important; border-color:rgba(212,180,80,0.38)!important; transform:translateX(4px); }

  .join-btn { transition:all .22s cubic-bezier(.4,0,.2,1); }
  .join-btn:hover:not(:disabled) { filter:brightness(1.2); transform:scale(1.07) translateY(-2px); }

  .tab-btn { transition:all .2s; }
  .tab-btn:hover { color:rgba(212,180,80,0.92)!important; }

  .play-btn { transition:all .3s cubic-bezier(.4,0,.2,1); position:relative; overflow:hidden; cursor:pointer; }
  .play-btn::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 50%); pointer-events:none; }
  .play-btn:hover:not(:disabled) { transform:translateY(-4px) scale(1.02)!important; box-shadow:0 0 70px rgba(212,180,80,0.65),0 14px 45px rgba(0,0,0,0.75)!important; }
  .play-btn:active { transform:scale(0.97)!important; }
  .play-btn:disabled { opacity:0.45; cursor:not-allowed; }

  .create-btn-gol { transition:all .22s; cursor:pointer; }
  .create-btn-gol:hover { transform:translateY(-3px); box-shadow:0 0 44px rgba(212,180,80,0.45)!important; }

  .stats-btn-gol { transition:all .22s; cursor:pointer; }
  .stats-btn-gol:hover { transform:translateY(-2px); box-shadow:0 0 30px rgba(212,180,80,0.35)!important; border-color:rgba(212,180,80,0.55)!important; }

  .auth-bar-btn { transition:all .22s; cursor:pointer; }
  .auth-bar-btn:hover { transform:translateY(-1px); filter:brightness(1.15); }

  .back-btn-gol { transition:all .2s; cursor:pointer; }
  .back-btn-gol:hover { color:#f0d060!important; }

  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:rgba(212,180,80,0.28); border-radius:3px; }

  /* ── Compact base styles (consistent across all screen sizes) ── */
  .gol-input { padding:10px 12px; font-size:12px; letter-spacing:1px; }
  .gol-code-input { font-size:22px; padding:12px 14px; letter-spacing:10px; }
  .gol-hero-crown { font-size:28px!important; margin-bottom:4px!important; }
  .gol-hero-tagline { font-size:8px!important; letter-spacing:4px!important; margin-bottom:6px!important; }
  .gol-hero-title { font-size:clamp(26px,8vw,42px)!important; letter-spacing:1px!important; }
  .gol-hero-subtitle { font-size:8px!important; letter-spacing:3px!important; }
  .gol-divider { margin:8px 0 6px!important; gap:6px!important; }
  .gol-card { padding:14px 12px 14px!important; }
  .gol-main-scroll { padding:12px 10px 52px!important; }
  .gol-el-grid { grid-template-columns:repeat(3,1fr)!important; gap:6px!important; }
  .gol-el-btn-inner { padding:10px 4px 7px!important; }
  .gol-el-emoji { font-size:20px!important; }
  .gol-el-label { font-size:8px!important; letter-spacing:2px!important; }
  .gol-auth-bar { padding:8px 10px!important; gap:6px!important; flex-wrap:wrap!important; }
  .gol-auth-name { font-size:11px!important; }
  .gol-section-label { font-size:9px!important; letter-spacing:3px!important; }
  .gol-stats-btn { padding:9px!important; font-size:11px!important; letter-spacing:3px!important; }
  .gol-tab-btn { font-size:10px!important; letter-spacing:2px!important; padding:8px 0!important; }
  .gol-play-btn { padding:13px!important; font-size:13px!important; letter-spacing:5px!important; }
  .gol-bottom-bar { font-size:8px!important; letter-spacing:1px!important; padding:6px 10px!important; }
  .gol-bottom-bar span { white-space:normal!important; text-align:center; }
  .gol-hero { margin-bottom:10px!important; }
  .gol-bloodline-tag { font-size:9px!important; letter-spacing:2px!important; margin-top:8px!important; }

  @media (max-width: 400px) {
    .gol-el-grid { grid-template-columns:repeat(2,1fr)!important; }
    .gol-hero-title { font-size:clamp(22px,7vw,34px)!important; }
    .gol-auth-bar { flex-direction:column!important; align-items:stretch!important; text-align:center; }
    .gol-play-btn { font-size:11px!important; letter-spacing:3px!important; }
  }

  @media (max-height: 700px) {
    .gol-hero-crown { font-size:24px!important; margin-bottom:2px!important; }
    .gol-hero-tagline { display:none!important; }
    .gol-hero { margin-bottom:6px!important; }
    .gol-divider { margin:6px 0 4px!important; }
    .gol-hero-subtitle { display:none!important; }
    .gol-card { padding:12px 14px 12px!important; }
    .gol-el-btn-inner { padding:8px 4px 6px!important; }
    .gol-el-emoji { font-size:18px!important; }
  }
`;

export function Menu({ onJoinRoom, isSignedIn, user, getToken, signOut, openSignIn, openSignUp }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const mouseRef  = useRef({ x: 500, y: 300 });

  const [playerName, setPlayerName]     = useState('');
  const [roomCode, setRoomCode]         = useState('');
  const [rooms, setRooms]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [selectedElement, setSelectedElement] = useState(3); // earth default
  const [tab, setTab]                   = useState('BROWSE');
  const [error, setError]               = useState('');
  const [ready, setReady]               = useState(false);
  const [glitch, setGlitch]             = useState(false);
  const [particles, setParticles]       = useState([]);
  const [joinedRoom, setJoinedRoom]     = useState(null);
  const [isPrivate, setIsPrivate]       = useState(false);

  // Stats / auth views
  const [view, setView]                 = useState('main'); // 'main' | 'stats'
  const [stats, setStats]               = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Wallet / shop
  const [coins, setCoins]               = useState(0);
  const [unlockedSkins, setUnlockedSkins] = useState(['lava','ocean','fungi','earth']);
  const [showShop, setShowShop]         = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const selEl = ELEMENTS.find(e => e.colorIndex === selectedElement);

  // ── Auto-fill name from Clerk user ──────────────────────────────
  useEffect(() => {
    if (isSignedIn && user && !playerName) {
      setPlayerName(user.fullName || user.username || user.firstName || '');
    }
  }, [isSignedIn, user]);

  // ── Fetch wallet when signed in ────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !getToken) return;
    getWallet(getToken).then(data => {
      if (data && data.success) {
        setCoins(data.coins ?? 0);
        setUnlockedSkins(data.unlockedSkins || ['lava','ocean','fungi','earth']);
      }
    }).catch(() => {});
  }, [isSignedIn, getToken]);

  const handleWalletUpdate = (newCoins, newSkins) => {
    if (newCoins !== undefined) setCoins(newCoins);
    if (newSkins) setUnlockedSkins(newSkins);
  };

  // ── Load rooms via socket ──────────────────────────────────────
  useEffect(() => {
    const loadRooms = async () => {
      try {
        await socketService.connect();
        socketService.emit('room:list', (data) => {
          setRooms(data.rooms || []);
        });
      } catch (err) {
        console.error('Failed to load rooms:', err);
      }
    };
    loadRooms();
  }, []);

  // ── Intro animation ────────────────────────────────────────────
  useEffect(() => { setTimeout(() => setReady(true), 80); }, []);

  // ── Menu BGM ───────────────────────────────────────────────────
  useEffect(() => {
    audioEngine.loadAll();
    audioEngine.startBGM(0.18);
    return () => { audioEngine.stopBGM(); };
  }, []);

  // ── Random glitch effect ───────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() < 0.07) { setGlitch(true); setTimeout(() => setGlitch(false), 100); }
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // ── Floating dust particles ────────────────────────────────────
  useEffect(() => {
    const pts = Array.from({ length: 45 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      speed: 0.01 + Math.random() * 0.022,
      opacity: 0.15 + Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 0.018,
      hue: Math.random() < 0.5 ? "#d4b050" : "#70bb60",
    }));
    setParticles(pts);
    const id = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        y: p.y - p.speed < -2 ? 102 : p.y - p.speed,
        x: (p.x + p.drift + 100) % 100,
      })));
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ── Canvas background ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const onMouse = e => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMouse);

    let t0 = null;
    const draw = ts => {
      if (!t0) t0 = ts;
      const t = (ts - t0) * 0.001;
      const W = canvas.width, H = canvas.height;
      const { x: mx, y: my } = mouseRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#060809";
      ctx.fillRect(0, 0, W, H);

      const offX = (t * 8) % TILE, offY = (t * 5) % TILE;
      const cols = Math.ceil(W / TILE) + 2, rows = Math.ceil(H / TILE) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const mc = MAP_CELLS[r % MAP_CELLS.length][c % MAP_CELLS[0].length];
          const x = c * TILE - offX, y = r * TILE - offY;
          const shade = 9 + mc.shade * 12;
          ctx.fillStyle = `rgb(${shade},${shade+4},${shade+2})`;
          ctx.fillRect(x, y, TILE, TILE);
          if (mc.owned > 0) {
            ctx.fillStyle = TERRITORY_COLORS[mc.owned - 1] + "30";
            ctx.fillRect(x, y, TILE, TILE);
          }
          ctx.strokeStyle = "rgba(80,110,70,0.1)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, TILE, TILE);
        }
      }
      const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 300);
      grd.addColorStop(0, "rgba(110,180,90,0.1)");
      grd.addColorStop(0.5, "rgba(200,168,74,0.05)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      const fog = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.85);
      fog.addColorStop(0, "rgba(6,8,9,0.35)");
      fog.addColorStop(0.5, "rgba(6,8,9,0.65)");
      fog.addColorStop(1, "rgba(6,8,9,0.97)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, W, H);
      for (let y2 = 0; y2 < H; y2 += 3) {
        ctx.fillStyle = "rgba(0,0,0,0.055)";
        ctx.fillRect(0, y2, W, 1);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  // ── Stats loader ───────────────────────────────────────────────
  const openStats = async () => {
    setView('stats');
    setStatsLoading(true);
    try {
      if (isSignedIn && getToken) {
        const data = await getMyStats(getToken);
        if (data && data.summary) {
          setStats({ ...data.summary, recentGames: data.recentGames || [] });
        } else {
          setStats(data);
        }
      } else {
        setStats(getGuestSummary());
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  // ── Room actions ───────────────────────────────────────────────
  const handleCreateRoom = () => {
    if (!playerName.trim()) { setError('Enter your name to play'); return; }
    setLoading(true); setError('');
    socketService.emit('room:create', { isPrivate }, (data) => {
      if (!data || !data.roomCode) { setError('Failed to create room'); setLoading(false); return; }
      socketService.emit('room:join', data.roomCode, playerName, selectedElement, (joinData) => {
        if (joinData && joinData.success) {
          onJoinRoom(joinData.roomCode, playerName, joinData.playerId);
        } else { setError(joinData?.error || 'Failed to join created room'); setLoading(false); }
      });
    });
  };

  const handleJoinByCode = () => {
    if (!playerName.trim()) { setError('Enter your name to play'); return; }
    if (!roomCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true); setError('');
    socketService.emit('room:join', roomCode.toUpperCase(), playerName, selectedElement, (data) => {
      if (data && data.success) {
        onJoinRoom(data.roomCode, playerName, data.playerId);
      } else { setError(data?.error || 'Failed to join room'); setLoading(false); }
    });
  };

  const handleQuickJoin = (code) => {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    setLoading(true); setError('');
    socketService.emit('room:join', code, playerName, selectedElement, (data) => {
      if (data && data.success) {
        onJoinRoom(data.roomCode, playerName, data.playerId);
      } else { setError(data?.error || 'Failed to join room'); setLoading(false); }
    });
  };

  // helpers
  const pingColor = ms => ms < 60 ? "#5aba50" : ms < 100 ? "#e8b830" : "#e84040";

  const sectionLabel = (icon, text) => (
    <div style={{
      fontFamily:"'Rajdhani',sans-serif",fontSize:10,
      letterSpacing:5,textTransform:"uppercase",fontWeight:700,
      marginBottom:9,color:"#e8c860",
      textShadow:"0 0 14px rgba(232,200,96,0.65)",
    }}>{icon} {text}</div>
  );

  /* ═══════════════════════════════════════════════════════════════
     Background layers (shared by all views)
     ═══════════════════════════════════════════════════════════════ */
  const backgroundLayers = (
    <>
      <style>{GOL_STYLES}</style>
      <canvas ref={canvasRef} style={{
        position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:0,display:"block",
      }}/>
      <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",overflow:"hidden"}}>
        {particles.map(p => (
          <div key={p.id} style={{
            position:"absolute",left:`${p.x}%`,top:`${p.y}%`,
            width:p.size,height:p.size,borderRadius:"50%",
            background:p.hue,opacity:p.opacity,
            boxShadow:`0 0 ${p.size*4}px ${p.hue}`,
          }}/>
        ))}
      </div>
      <div style={{
        position:"fixed",inset:0,zIndex:2,pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 45%, rgba(6,8,9,0.1) 0%, rgba(6,8,9,0.6) 50%, rgba(6,8,9,0.97) 100%)",
      }}/>
      <div style={{position:"fixed",top:18,left:22,zIndex:5,opacity:0.55,fontSize:22,
        animation:"runeRotate 20s linear infinite",color:"#d4b450",
        filter:"drop-shadow(0 0 10px #d4b450)"}}>⚔</div>
      <div style={{position:"fixed",top:18,right:22,zIndex:5,opacity:0.55,fontSize:22,
        animation:"runeRotate 20s linear infinite reverse",color:"#d4b450",
        filter:"drop-shadow(0 0 10px #d4b450)"}}>🛡</div>

      {/* ── Coin display + Shop button (top-right) ── */}
      <div style={{
        position:"fixed",top:52,right:14,zIndex:12,
        display:"flex",alignItems:"center",gap:8,
      }}>
        <div style={{
          display:"flex",alignItems:"center",gap:6,
          padding:"6px 14px",borderRadius:20,
          background:"rgba(255,215,0,0.08)",
          border:"1px solid rgba(255,215,0,0.2)",
          backdropFilter:"blur(12px)",
        }}>
          <span style={{fontSize:14}}>🪙</span>
          <span style={{
            fontFamily:"'Cinzel',serif",fontSize:14,fontWeight:900,
            color:"#ffd700",textShadow:"0 0 10px rgba(255,215,0,0.5)",
          }}>{coins}</span>
        </div>
        <button className="auth-bar-btn" onClick={()=>{
          if (isSignedIn) setShowShop(true);
          else setShowLoginPrompt(true);
        }} style={{
          padding:"6px 14px",borderRadius:20,
          background:"rgba(212,180,80,0.08)",
          border:"1px solid rgba(212,180,80,0.25)",
          fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,
          color:"#f0d060",letterSpacing:2,textTransform:"uppercase",
          backdropFilter:"blur(12px)",
        }}>🏪 Shop</button>
      </div>

      {/* ── Shop overlay ── */}
      {showShop && isSignedIn && (
        <Shop
          getToken={getToken}
          coins={coins}
          unlockedSkins={unlockedSkins}
          onClose={()=>setShowShop(false)}
          onWalletUpdate={handleWalletUpdate}
        />
      )}

      {/* ── Login prompt overlay ── */}
      {showLoginPrompt && (
        <div style={{
          position:'fixed',inset:0,zIndex:110,
          background:'rgba(4,6,4,0.92)',backdropFilter:'blur(12px)',
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <div style={{
            width:'92%',maxWidth:380,padding:'28px 24px',
            background:'linear-gradient(160deg,rgba(16,14,8,0.98),rgba(9,11,7,0.99))',
            border:'1.5px solid rgba(212,180,80,0.28)',borderRadius:14,
            boxShadow:'0 0 80px rgba(212,180,80,0.1),0 30px 90px rgba(0,0,0,0.9)',
            textAlign:'center',
          }}>
            <div style={{fontSize:42,marginBottom:12,filter:'drop-shadow(0 0 18px rgba(212,180,80,0.8))'}}>🔒</div>
            <div style={{
              fontFamily:"'Cinzel Decorative',serif",fontWeight:900,
              fontSize:22,color:'#f0d060',letterSpacing:2,
              textShadow:'0 0 22px rgba(240,208,96,0.6)',marginBottom:10,
            }}>Sign In Required</div>
            <p style={{
              fontFamily:"'Rajdhani',sans-serif",fontSize:13,lineHeight:1.7,
              color:'rgba(255,255,255,0.5)',letterSpacing:1,marginBottom:22,
            }}>
              Sign in to access the Shop, purchase premium skins, and earn coins by playing.
            </p>
            <button onClick={()=>{setShowLoginPrompt(false);openSignIn&&openSignIn();}} style={{
              width:'100%',maxWidth:260,padding:'12px',margin:'0 auto 10px',display:'block',
              background:'linear-gradient(135deg,#a87818,#d4a828 35%,#ffe068 55%,#d4a828 75%,#8a6018)',
              backgroundSize:'200% auto',animation:'shimmer 4s linear infinite',
              border:'none',borderRadius:8,fontFamily:"'Cinzel',serif",fontSize:13,
              letterSpacing:5,color:'#1c0e00',fontWeight:900,textTransform:'uppercase',cursor:'pointer',
            }}>🔑 Sign In</button>
            <button onClick={()=>{setShowLoginPrompt(false);openSignUp&&openSignUp();}} style={{
              width:'100%',maxWidth:260,padding:'10px',margin:'0 auto 10px',display:'block',
              background:'rgba(212,180,80,0.08)',
              border:'1.5px solid rgba(212,180,80,0.3)',borderRadius:8,
              fontFamily:"'Cinzel',serif",fontSize:12,letterSpacing:4,
              color:'#f0d060',fontWeight:600,textTransform:'uppercase',cursor:'pointer',
            }}>✨ Create Account</button>
            <button onClick={()=>setShowLoginPrompt(false)} style={{
              background:'none',border:'none',marginTop:6,
              fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,
              color:'rgba(212,180,80,0.45)',letterSpacing:2,cursor:'pointer',
            }}>✕ Close</button>
          </div>
        </div>
      )}
    </>
  );

  /* card wrapper */
  const cardStyle = {
    background:"linear-gradient(160deg,rgba(16,14,8,0.97) 0%,rgba(9,11,7,0.98) 100%)",
    border:"1.5px solid rgba(212,180,80,0.28)",
    borderRadius:12, backdropFilter:"blur(32px)",
    padding:"14px 12px 14px",
    boxShadow:"0 0 0 1px rgba(212,180,80,0.07),0 0 80px rgba(212,180,80,0.08),0 30px 90px rgba(0,0,0,0.9),inset 0 1px 0 rgba(255,245,180,0.08)",
    animation:"fadeUp 0.85s ease 0.3s both, borderPulse 4s ease-in-out 2s infinite",
    position:"relative", overflow:"hidden",
  };

  const cardCorners = (
    <>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,
        background:"linear-gradient(90deg,transparent,rgba(255,245,160,0.2),transparent)",pointerEvents:"none"}}/>
      {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h],i)=>(
        <div key={i} style={{
          position:"absolute",[v]:8,[h]:8,width:16,height:16,
          [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]:"1.5px solid rgba(212,180,80,0.55)",
          [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]:"1.5px solid rgba(212,180,80,0.55)",
          pointerEvents:"none",
        }}/>
      ))}
    </>
  );

  /* ═══════════════════════════════════════════════════════════════
     STATS VIEW
     ═══════════════════════════════════════════════════════════════ */
  if (view === 'stats') {
    // Guest: sign-in prompt
    if (!isSignedIn) {
      return (
        <>
          {backgroundLayers}
          <div className="gol-main-scroll" style={{position:"fixed",inset:0,zIndex:3,display:"flex",flexDirection:"column",alignItems:"center",
            overflowY:"auto",padding:"12px 10px 52px",WebkitOverflowScrolling:"touch"}}>
            <div style={{width:"100%",maxWidth:520}}>
              <div className="gol-card" style={cardStyle}>
                {cardCorners}
                <button className="back-btn-gol" onClick={()=>setView('main')} style={{
                  background:"none",border:"none",fontFamily:"'Rajdhani',sans-serif",
                  fontSize:13,fontWeight:700,color:"rgba(212,180,80,0.6)",
                  letterSpacing:2,padding:"4px 0",marginBottom:16,
                }}>← Back</button>

                <div style={{textAlign:"center",marginBottom:20}}>
                  <div style={{fontSize:38,marginBottom:8,filter:"drop-shadow(0 0 18px rgba(212,180,80,0.8))"}}>🔒</div>
                  <div style={{
                    fontFamily:"'Cinzel Decorative',serif",fontWeight:900,
                    fontSize:28,color:"#f0d060",letterSpacing:3,
                    textShadow:"0 0 22px rgba(240,208,96,0.6)",
                  }}>My Stats</div>
                  <div style={{
                    fontSize:9,letterSpacing:5,color:"rgba(212,180,80,0.6)",
                    fontFamily:"'Rajdhani',sans-serif",fontWeight:600,marginTop:6,textTransform:"uppercase",
                  }}>Sign in to track progress</div>
                </div>

                <div style={{textAlign:"center",padding:"10px 0 6px"}}>
                  <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,lineHeight:1.7,marginBottom:20,
                    fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>
                    Sign in to save your game stats to the cloud and track your progress across sessions.
                  </p>
                  <button className="auth-bar-btn" onClick={()=>openSignIn&&openSignIn()} style={{
                    width:"100%",maxWidth:280,padding:"13px",margin:"0 auto",display:"block",
                    background:"linear-gradient(135deg,#a87818,#d4a828 35%,#ffe068 55%,#d4a828 75%,#8a6018)",
                    backgroundSize:"200% auto",animation:"shimmer 4s linear infinite",
                    border:"none",borderRadius:8,fontFamily:"'Cinzel',serif",fontSize:13,
                    letterSpacing:5,color:"#1c0e00",fontWeight:900,textTransform:"uppercase",
                  }}>🔑 Sign In</button>
                  <button className="auth-bar-btn" onClick={()=>openSignUp&&openSignUp()} style={{
                    width:"100%",maxWidth:280,padding:"11px",margin:"10px auto 0",display:"block",
                    background:"rgba(212,180,80,0.08)",
                    border:"1.5px solid rgba(212,180,80,0.3)",borderRadius:8,
                    fontFamily:"'Cinzel',serif",fontSize:12,letterSpacing:4,
                    color:"#f0d060",fontWeight:600,textTransform:"uppercase",
                  }}>✨ Create Account</button>
                  <button className="back-btn-gol" onClick={()=>setView('main')} style={{
                    background:"none",border:"none",marginTop:18,
                    fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,
                    color:"rgba(212,180,80,0.5)",letterSpacing:2,
                  }}>← Continue as Guest</button>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

    // Signed-in stats
    return (
      <>
        {backgroundLayers}
        <div className="gol-main-scroll" style={{position:"fixed",inset:0,zIndex:3,display:"flex",flexDirection:"column",alignItems:"center",
          overflowY:"auto",padding:"12px 10px 52px",WebkitOverflowScrolling:"touch"}}>
          <div style={{width:"100%",maxWidth:520}}>
            <div className="gol-card" style={cardStyle}>
              {cardCorners}
              <button className="back-btn-gol" onClick={()=>setView('main')} style={{
                background:"none",border:"none",fontFamily:"'Rajdhani',sans-serif",
                fontSize:13,fontWeight:700,color:"rgba(212,180,80,0.6)",
                letterSpacing:2,padding:"4px 0",marginBottom:16,
              }}>← Back</button>

              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:38,marginBottom:8,filter:"drop-shadow(0 0 18px rgba(212,180,80,0.8))"}}>📊</div>
                <div style={{
                  fontFamily:"'Cinzel Decorative',serif",fontWeight:900,
                  fontSize:28,color:"#f0d060",letterSpacing:3,
                  textShadow:"0 0 22px rgba(240,208,96,0.6)",
                }}>My Stats</div>
                <div style={{
                  fontSize:9,letterSpacing:5,color:"rgba(212,180,80,0.6)",
                  fontFamily:"'Rajdhani',sans-serif",fontWeight:600,marginTop:6,textTransform:"uppercase",
                }}>Cloud Stats</div>
              </div>

              {statsLoading ? (
                <div style={{textAlign:"center",padding:"30px 0",color:"rgba(212,180,80,0.5)",
                  fontFamily:"'Rajdhani',sans-serif",fontSize:13,letterSpacing:2}}>Loading stats...</div>
              ) : !stats || stats.totalGames === 0 ? (
                <div style={{textAlign:"center",padding:"30px 0",color:"rgba(212,180,80,0.4)",
                  fontFamily:"'Rajdhani',sans-serif",fontSize:13,letterSpacing:2,fontStyle:"italic"}}>
                  No stats yet — play some games!</div>
              ) : (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                    {[
                      {val:stats.totalGames??0,lbl:"Games"},
                      {val:stats.bestScore??0,lbl:"Best Score"},
                      {val:stats.totalKills??0,lbl:"Kills"},
                      {val:stats.totalDeaths??0,lbl:"Deaths"},
                      {val:Number(stats.kd??0).toFixed(2),lbl:"K/D"},
                      {val:`${Number(stats.avgTerritory??0).toFixed(1)}%`,lbl:"Avg Territory"},
                      {val:`🪙 ${coins}`,lbl:"Coins"},
                      {val:unlockedSkins.length,lbl:"Skins"},
                      {val:`${6-unlockedSkins.length}`,lbl:"Locked"},
                    ].map((s,i)=>(
                      <div key={i} style={{
                        display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                        padding:"14px 8px",background:"rgba(212,180,80,0.05)",
                        border:"1px solid rgba(212,180,80,0.12)",borderRadius:10,
                      }}>
                        <span style={{fontSize:22,fontWeight:900,color:"#f0d060",
                          fontFamily:"'Cinzel',serif",textShadow:"0 0 14px rgba(240,208,96,0.5)"}}>{s.val}</span>
                        <span style={{fontSize:9,letterSpacing:2,color:"rgba(212,180,80,0.5)",
                          fontFamily:"'Rajdhani',sans-serif",fontWeight:700,textTransform:"uppercase"}}>{s.lbl}</span>
                      </div>
                    ))}
                  </div>

                  {stats.recentGames && stats.recentGames.length > 0 && (
                    <>
                      {sectionLabel("🗡","Recent Battles")}
                      <div style={{maxHeight:200,overflowY:"auto"}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,
                          padding:"8px 12px",fontSize:9,color:"rgba(212,180,80,0.5)",
                          letterSpacing:2,fontWeight:700,fontFamily:"'Rajdhani',sans-serif",textTransform:"uppercase",
                          borderBottom:"1px solid rgba(212,180,80,0.1)"}}>
                          <span>Score</span><span>Kills</span><span>Deaths</span><span>Territory</span>
                        </div>
                        {stats.recentGames.map((g,i)=>(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,
                            padding:"8px 12px",fontSize:13,color:"rgba(255,255,255,0.6)",fontWeight:600,
                            background:i%2===0?"rgba(212,180,80,0.03)":"transparent",borderRadius:6,
                            fontFamily:"'Rajdhani',sans-serif"}}>
                            <span>{g.score}</span><span>{g.kills}</span><span>{g.deaths}</span>
                            <span>{Number(g.territoryPercent??0).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     MAIN MENU VIEW
     ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      {backgroundLayers}

      {/* ── MAIN LAYOUT ── */}
      <div className="gol-main-scroll" style={{
        position:"fixed",inset:0,zIndex:3,
        display:"flex",flexDirection:"column",alignItems:"center",
        overflowY:"auto",overflowX:"hidden",
        padding:"12px 10px 52px",
        WebkitOverflowScrolling:"touch",
      }}>
        <div style={{
          width:"100%",maxWidth:520,
          opacity:ready?1:0,
          transform:ready?"translateY(0)":"translateY(28px)",
          transition:"opacity 0.75s ease, transform 0.75s ease",
        }}>

          {/* ═══ HERO ═══ */}
          <div className="gol-hero" style={{textAlign:"center",marginBottom:10}}>
            {/* <div className="gol-hero-crown" style={{
              fontSize:28,marginBottom:4,lineHeight:1,
              animation:"crownFloat 4s ease-in-out infinite",
              filter:"drop-shadow(0 0 24px rgba(212,180,80,1)) drop-shadow(0 0 48px rgba(200,100,10,0.6))",
            }}>👑</div> */}

            <div className="gol-hero-tagline" style={{
              fontSize:8,letterSpacing:4,textTransform:"uppercase",
              fontFamily:"'Rajdhani',sans-serif",fontWeight:700,marginBottom:6,
              color:"rgba(212,180,80,0.9)",
              textShadow:"0 0 18px rgba(212,180,80,0.6)",
              animation:"fadeUp 0.6s ease 0.2s both",
            }}>⚔ Conquer · Fortify · Dominate ⚔</div>

            {/* TITLE */}
            <div style={{animation:"fadeUp 0.8s ease 0.4s both",overflow:"hidden"}}>
              <div aria-hidden className="gol-hero-title" style={{
                fontFamily:"'Cinzel Decorative',serif",fontWeight:900,
                fontSize:"clamp(26px,8vw,42px)",letterSpacing:1,lineHeight:1.05,
                color:"transparent",
                WebkitTextStroke:"1px rgba(90,50,0,0.5)",
                position:"relative",top:5,left:4,
                userSelect:"none",pointerEvents:"none",
                marginBottom:"-1.1em",
              }}>Game of Lands</div>
              <div className="gol-hero-title" style={{
                fontFamily:"'Cinzel Decorative',serif",fontWeight:900,
                fontSize:"clamp(26px,8vw,42px)",letterSpacing:1,lineHeight:1.05,
                backgroundImage:"linear-gradient(170deg,#fff8d8 0%,#ffe080 18%,#d4a828 40%,#f5d040 58%,#b07818 78%,#7a5218 100%)",
                backgroundSize:"200% auto",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
                filter: glitch
                  ? "drop-shadow(3px 0 0 rgba(220,60,0,0.9)) drop-shadow(-3px 0 0 rgba(0,160,220,0.6))"
                  : "drop-shadow(0 0 28px rgba(212,180,80,0.95)) drop-shadow(0 0 55px rgba(190,130,10,0.5))",
                animation:"shimmer 6s linear infinite",
                position:"relative",
              }}>Game of Lands</div>
            </div>

            {/* divider */}
            <div className="gol-divider" style={{display:"flex",alignItems:"center",gap:6,margin:"8px 0 6px",animation:"fadeUp 0.7s ease 0.85s both"}}>
              <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(212,180,80,0.7))"}}/>
              <span style={{color:"rgba(212,180,80,0.85)",fontSize:14,textShadow:"0 0 8px rgba(212,180,80,0.6)"}}>✦</span>
              <span style={{color:"#d4b450",fontSize:20,lineHeight:1,textShadow:"0 0 14px rgba(212,180,80,0.9)"}}>⚜</span>
              <span style={{color:"rgba(212,180,80,0.85)",fontSize:14,textShadow:"0 0 8px rgba(212,180,80,0.6)"}}>✦</span>
              <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(212,180,80,0.7),transparent)"}}/>
            </div>

            {/* <div className="gol-hero-subtitle" style={{
              fontSize:8,letterSpacing:3,color:"rgba(212,180,80,0.72)",
              textTransform:"uppercase",fontFamily:"'Rajdhani',sans-serif",fontWeight:500,
              textShadow:"0 0 14px rgba(212,180,80,0.38)",
              animation:"fadeUp 0.7s ease 1.05s both",
            }}>Claim Every Land. Leave No Enemy Standing.</div> */}
          </div>

          {/* ═══ MAIN CARD ═══ */}
          <div className="gol-card" style={cardStyle}>
            {cardCorners}

            {/* ── AUTH SECTION ── */}
            <div style={{marginBottom:18}}>
              {isSignedIn ? (
                <div className="gol-auth-bar" style={{
                  display:"flex",alignItems:"center",gap:6,padding:"8px 10px",
                  background:"rgba(90,186,80,0.08)",
                  border:"1px solid rgba(90,186,80,0.2)",borderRadius:9,
                  flexWrap:"wrap",
                }}>
                  {user?.imageUrl && (
                    <img src={user.imageUrl} alt="" style={{
                      width:28,height:28,borderRadius:"50%",
                      border:"2px solid rgba(90,186,80,0.4)",objectFit:"cover",flexShrink:0,
                    }}/>
                  )}
                  <span className="gol-auth-name" style={{flex:1,minWidth:0,fontFamily:"'Rajdhani',sans-serif",fontSize:11,
                    color:"rgba(255,255,255,0.55)",letterSpacing:1,fontWeight:600,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    Welcome, <strong style={{color:"#f0d060"}}>{user?.firstName||user?.username||'Warrior'}</strong>
                  </span>
                  <span style={{
                    fontSize:9,padding:"3px 8px",borderRadius:20,fontWeight:700,letterSpacing:1,
                    background:"rgba(90,186,80,0.12)",color:"#66ff66",
                    border:"1px solid rgba(90,186,80,0.25)",textTransform:"uppercase",
                    fontFamily:"'Rajdhani',sans-serif",flexShrink:0,
                  }}>✓ Saved</span>
                  <button className="auth-bar-btn" onClick={()=>signOut&&signOut()} style={{
                    padding:"5px 12px",background:"rgba(232,64,64,0.1)",
                    border:"1px solid rgba(232,64,64,0.25)",color:"#ff6b6b",borderRadius:6,
                    fontFamily:"'Rajdhani',sans-serif",fontSize:10,fontWeight:700,
                    letterSpacing:1,textTransform:"uppercase",flexShrink:0,
                  }}>Sign Out</button>
                </div>
              ) : (
                <div style={{
                  display:"flex",flexDirection:"column",alignItems:"center",gap:10,
                  padding:"12px 14px",
                  background:"rgba(212,180,80,0.04)",
                  border:"1px solid rgba(212,180,80,0.12)",borderRadius:9,
                }}>
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600,
                    color:"rgba(212,180,80,0.55)",letterSpacing:2,textTransform:"uppercase"}}>
                    🎮 Playing as Guest — sign in to save progress
                  </span>
                  <div style={{display:"flex",gap:8}}>
                    <button className="auth-bar-btn" onClick={()=>openSignIn&&openSignIn()} style={{
                      padding:"7px 18px",
                      background:"linear-gradient(135deg,rgba(212,180,80,0.2),rgba(212,180,80,0.08))",
                      border:"1.5px solid rgba(212,180,80,0.4)",borderRadius:7,
                      fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,
                      color:"#f0d060",letterSpacing:2,textTransform:"uppercase",
                    }}>Sign In</button>
                    <button className="auth-bar-btn" onClick={()=>openSignUp&&openSignUp()} style={{
                      padding:"7px 18px",background:"transparent",
                      border:"1.5px solid rgba(212,180,80,0.2)",borderRadius:7,
                      fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,
                      color:"rgba(212,180,80,0.55)",letterSpacing:2,textTransform:"uppercase",
                    }}>Sign Up</button>
                  </div>
                </div>
              )}
            </div>

            {/* ── WARRIOR NAME ── */}
            <div className="gol-section-label">{sectionLabel("⚔","Warrior Name")}</div>
            <input className="gol-input" value={playerName}
              onChange={e=>setPlayerName(e.target.value)}
              placeholder="Enter your name, warrior…" maxLength={16}/>

            {/* ── BLOODLINE ── */}
            <div className="gol-section-label" style={{marginTop:14}}>{sectionLabel("🩸","Choose Your Bloodline")}</div>
            <div className="gol-el-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
              {ELEMENTS.map(e=>{
                const isLocked = !unlockedSkins.includes(e.id);
                return (
                <button key={e.id} className="el-btn gol-el-btn-inner" onClick={()=>{
                  if (isLocked) {
                    if (isSignedIn) setShowShop(true);
                    else setShowLoginPrompt(true);
                    return;
                  }
                  setSelectedElement(e.colorIndex);
                }} style={{
                  padding:"10px 4px 7px",
                  background: selectedElement===e.colorIndex && !isLocked
                    ? `linear-gradient(160deg,${e.bg},rgba(16,14,8,0.94))`
                    : "rgba(255,255,255,0.03)",
                  border:`1.5px solid ${selectedElement===e.colorIndex && !isLocked ? e.color+"99" : "rgba(212,180,80,0.12)"}`,
                  borderRadius:8,
                  display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                  boxShadow: selectedElement===e.colorIndex && !isLocked
                    ? `0 0 28px ${e.glow}44,0 4px 20px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07)`
                    : "0 2px 10px rgba(0,0,0,0.5)",
                  transform: selectedElement===e.colorIndex && !isLocked ? "scale(1.05) translateY(-2px)" : "scale(1)",
                  outline:"none",
                  opacity: isLocked ? 0.5 : 1,
                  position:"relative",
                }}>
                  {isLocked && (
                    <div style={{
                      position:"absolute",top:4,right:6,fontSize:12,
                      filter:"drop-shadow(0 0 4px rgba(0,0,0,0.8))",
                    }}>🔒</div>
                  )}
                  <span className="gol-el-emoji" style={{fontSize:20,lineHeight:1,filter: selectedElement===e.colorIndex && !isLocked ?`drop-shadow(0 0 10px ${e.glow})`:"grayscale(0.4)"}}>{e.emoji}</span>
                  <span className="gol-el-label" style={{
                    fontSize:9,letterSpacing:3,fontWeight:700,
                    fontFamily:"'Rajdhani',sans-serif",textTransform:"uppercase",
                    color: selectedElement===e.colorIndex && !isLocked ? e.textColor : "rgba(212,180,80,0.38)",
                    textShadow: selectedElement===e.colorIndex && !isLocked ? `0 0 10px ${e.glow}` : "none",
                  }}>{isLocked ? `🪙 ${e.id==='crystal'?50:100}` : e.label}</span>
                </button>
                );
              })}
            </div>

            {/* ── STATS BUTTON ── */}
            <button className="stats-btn-gol gol-stats-btn" onClick={openStats} style={{
              width:"100%",marginTop:14,padding:"9px",
              background:"rgba(212,180,80,0.06)",
              border:"1.5px solid rgba(212,180,80,0.22)",borderRadius:8,
              fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:3,
              color:"#f0d060",fontWeight:600,textTransform:"uppercase",
              textShadow:"0 0 12px rgba(240,208,96,0.4)",
            }}>📊 &nbsp; My Stats</button>

            {/* ── ERROR ── */}
            {error && (
              <div style={{
                marginTop:12,padding:"10px 14px",
                background:"rgba(232,64,64,0.08)",
                border:"1px solid rgba(232,64,64,0.3)",borderRadius:8,
                color:"#ff6b6b",fontSize:12,fontWeight:600,letterSpacing:1,
                fontFamily:"'Rajdhani',sans-serif",
                animation:"errorShake 0.4s ease-out",
              }}>{error}</div>
            )}

            {/* ── TABS ── */}
            <div style={{display:"flex",borderBottom:"1px solid rgba(212,180,80,0.15)",marginTop:14}}>
              {["BROWSE","CREATE","CODE"].map(t=>(
                <button key={t} className="tab-btn gol-tab-btn" onClick={()=>setTab(t)} style={{
                  flex:1,padding:"8px 0",fontFamily:"'Rajdhani',sans-serif",
                  fontSize:10,letterSpacing:2,fontWeight:tab===t?700:500,
                  color:tab===t?"#f0d060":"rgba(212,180,80,0.35)",
                  background:"none",border:"none",cursor:"pointer",
                  borderBottom:tab===t?"2px solid #d4b450":"2px solid transparent",
                  textTransform:"uppercase",marginBottom:-1,
                  textShadow:tab===t?"0 0 12px rgba(212,180,80,0.65)":"none",
                }}>{t}</button>
              ))}
            </div>

            {/* ── TAB CONTENT ── */}
            <div style={{marginTop:10,minHeight:100}}>

              {tab==="BROWSE" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,letterSpacing:4,
                      color:"rgba(212,180,80,0.6)",textTransform:"uppercase",fontWeight:600}}>
                      {rooms.length} Warcamp{rooms.length!==1?"s":""} Open
                    </span>
                  </div>

                  {rooms.length > 0 ? rooms.map(room => (
                    <div key={room.code} className="room-row" style={{
                      display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"11px 13px",marginBottom:8,
                      background:joinedRoom===room.code?"rgba(90,186,80,0.08)":"rgba(212,180,80,0.04)",
                      border:joinedRoom===room.code?"1.5px solid rgba(90,186,80,0.45)":"1px solid rgba(212,180,80,0.11)",
                      animation:joinedRoom===room.code?"readyGlow 2s ease-in-out infinite":"none",
                    }}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:4}}>
                          <span style={{
                            fontFamily:"'Cinzel',serif",fontSize:14,
                            color:"#f5d040",letterSpacing:2,fontWeight:700,
                            textShadow:"0 0 12px rgba(245,208,64,0.6)",
                          }}>{room.code}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{display:"flex",gap:3}}>
                            {Array.from({length:4}).map((_,i)=>(
                              <div key={i} style={{
                                width:7,height:7,borderRadius:2,
                                background:i<room.playerCount?"#5aba50":"rgba(255,255,255,0.12)",
                                boxShadow:i<room.playerCount?"0 0 6px #5aba5099":"none",
                                animation:i<room.playerCount?"pipPulse 2s ease-in-out infinite":"none",
                                animationDelay:`${i*0.28}s`,
                              }}/>
                            ))}
                          </div>
                          <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,fontWeight:600,letterSpacing:1}}>
                            <span style={{color:"rgba(212,180,80,0.75)"}}>{room.playerCount}/4</span>
                            <span style={{color:"rgba(255,255,255,0.18)"}}> · </span>
                            <span style={{color:"#5aba50",fontWeight:700,textShadow:"0 0 8px #5aba5066"}}>OPEN FOR RECRUITS</span>
                          </span>
                        </div>
                      </div>
                      <button className="join-btn" disabled={loading}
                        onClick={()=>handleQuickJoin(room.code)} style={{
                        padding:"8px 16px",
                        background:"linear-gradient(135deg,#4a9e44,#2e7228)",
                        border:"1.5px solid rgba(74,158,68,0.55)",
                        borderRadius:6,
                        fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,letterSpacing:3,
                        color:"#d4ffd0",textTransform:"uppercase",
                        textShadow:"0 0 8px rgba(90,186,80,0.7)",
                        boxShadow:"0 0 18px rgba(74,158,68,0.4)",
                        whiteSpace:"nowrap",cursor:"pointer",
                      }}>{loading?"...":"JOIN"}</button>
                    </div>
                  )) : (
                    <div style={{textAlign:"center",padding:"30px 0",
                      fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:"rgba(212,180,80,0.4)",
                      letterSpacing:2,fontStyle:"italic"}}>
                      No warcamps yet — raise your banner!</div>
                  )}
                </div>
              )}

              {tab==="CREATE" && (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",
                  justifyContent:"center",gap:14,padding:"20px 0 12px"}}>
                  <div style={{
                    fontSize:11,fontFamily:"'Rajdhani',sans-serif",fontWeight:600,
                    color:"rgba(212,180,80,0.72)",letterSpacing:2,
                    textAlign:"center",lineHeight:2.2,textTransform:"uppercase",
                    textShadow:"0 0 10px rgba(212,180,80,0.3)",
                  }}>Raise your banner &amp; summon<br/>allies to your cause.</div>

                  {/* Private / Public toggle */}
                  <div style={{display:"flex",alignItems:"center",gap:0,
                    background:"rgba(212,180,80,0.05)",borderRadius:8,
                    border:"1.5px solid rgba(212,180,80,0.18)",overflow:"hidden"}}>
                    <button onClick={()=>setIsPrivate(false)} style={{
                      padding:"9px 18px",border:"none",cursor:"pointer",
                      fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,
                      letterSpacing:2,textTransform:"uppercase",
                      background:!isPrivate?"rgba(90,186,80,0.18)":"transparent",
                      color:!isPrivate?"#5aba50":"rgba(212,180,80,0.4)",
                      borderRight:"1px solid rgba(212,180,80,0.12)",
                      textShadow:!isPrivate?"0 0 10px rgba(90,186,80,0.5)":"none",
                      transition:"all 0.2s",
                    }}>🌍 Public</button>
                    <button onClick={()=>setIsPrivate(true)} style={{
                      padding:"9px 18px",border:"none",cursor:"pointer",
                      fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,
                      letterSpacing:2,textTransform:"uppercase",
                      background:isPrivate?"rgba(232,64,64,0.12)":"transparent",
                      color:isPrivate?"#ff6b6b":"rgba(212,180,80,0.4)",
                      textShadow:isPrivate?"0 0 10px rgba(232,64,64,0.4)":"none",
                      transition:"all 0.2s",
                    }}>🔒 Private</button>
                  </div>

                  <div style={{
                    fontSize:10,fontFamily:"'Rajdhani',sans-serif",
                    color:"rgba(212,180,80,0.4)",letterSpacing:2,textAlign:"center",
                  }}>{isPrivate
                    ? "Only players with the room code can join"
                    : "Room will be listed in Browse for anyone to join"
                  }</div>
                  {/* <button className="create-btn-gol" onClick={handleCreateRoom} disabled={loading} style={{
                    padding:"13px 44px",fontFamily:"'Cinzel',serif",fontSize:13,
                    letterSpacing:5,color:"#f0d060",textTransform:"uppercase",
                    background:"linear-gradient(135deg,rgba(212,180,80,0.15),rgba(212,180,80,0.07))",
                    border:"1.5px solid rgba(212,180,80,0.42)",borderRadius:8,
                    boxShadow:"0 0 30px rgba(212,180,80,0.18)",fontWeight:600,
                    textShadow:"0 0 14px rgba(240,208,96,0.6)",
                    opacity:loading?0.5:1,cursor:loading?"not-allowed":"pointer",
                  }}>{loading?"Creating...":"⚑   Raise Banner"}</button> */}
                </div>
              )}

              {tab==="CODE" && (
                <div style={{paddingTop:8}}>
                  <div style={{
                    fontSize:11,fontFamily:"'Rajdhani',sans-serif",fontWeight:600,
                    color:"rgba(212,180,80,0.68)",letterSpacing:2,
                    marginBottom:14,lineHeight:2,textTransform:"uppercase",textAlign:"center",
                    textShadow:"0 0 10px rgba(212,180,80,0.3)",
                  }}>Speak the secret word to enter the warcamp</div>
                  <input className="gol-code-input" value={roomCode}
                    onChange={e=>setRoomCode(e.target.value.toUpperCase())}
                    placeholder="······" maxLength={6}/>
                  {roomCode.length===6 && (
                    <div style={{
                      marginTop:10,textAlign:"center",
                      fontFamily:"'Rajdhani',sans-serif",fontSize:11,letterSpacing:3,
                      color:"#5aba50",textShadow:"0 0 12px rgba(90,186,80,0.75)",textTransform:"uppercase",
                      fontWeight:700,
                    }}>✓ Code accepted — warcamp found</div>
                  )}
                </div>
              )}
            </div>

            {/* ── MARCH TO WAR ── */}
            <button className="play-btn gol-play-btn" disabled={loading}
              onClick={()=>{
                if (tab==="CREATE") handleCreateRoom();
                else if (tab==="CODE" && roomCode.length>=4) handleJoinByCode();
                else if (tab==="BROWSE" && rooms.length>0) handleQuickJoin(rooms[0].code);
                else if (!playerName.trim()) setError("Enter your name to play");
                else handleCreateRoom();
              }}
              style={{
                marginTop:14,width:"100%",padding:"13px",
                background:"linear-gradient(135deg,#a87818,#d4a828 35%,#ffe068 55%,#d4a828 75%,#8a6018)",
                backgroundSize:"200% auto",
                border:"none",borderRadius:8,
                fontFamily:"'Cinzel',serif",fontSize:13,
                letterSpacing:5,color:"#1c0e00",fontWeight:900,textTransform:"uppercase",
                boxShadow:"0 0 44px rgba(212,180,80,0.45),0 6px 34px rgba(0,0,0,0.75),inset 0 1px 0 rgba(255,255,255,0.28)",
                animation:"shimmer 4s linear infinite",
              }}>
              ⚔ &nbsp; March to War
            </button>
          </div>

          {/* ── Bloodline indicator ── */}
          <div className="gol-bloodline-tag" style={{
            display:"flex",alignItems:"center",justifyContent:"center",gap:9,
            marginTop:8,fontSize:9,
            letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",textTransform:"uppercase",
            color:selEl.textColor,fontWeight:600,
            textShadow:`0 0 12px ${selEl.glow}88`,
            animation:"fadeUp 0.7s ease 1.55s both",
          }}>
            <span style={{
              display:"inline-block",width:9,height:9,borderRadius:"50%",
              background:selEl.color,boxShadow:`0 0 11px ${selEl.glow}`,
              animation:"trailPulse 2s ease-in-out infinite",
            }}/>
            {selEl.label} Bloodline Chosen &nbsp;{selEl.emoji}
          </div>
        </div>
      </div>

      {/* ── BOTTOM HUD BAR ── */}
      <div className="gol-bottom-bar" style={{
        position:"fixed",bottom:0,left:0,right:0,zIndex:10,
        padding:"6px 10px",
        background:"rgba(4,6,4,0.97)",
        borderTop:"1px solid rgba(212,180,80,0.15)",
        backdropFilter:"blur(20px)",
        display:"flex",alignItems:"center",justifyContent:"center",gap:6,
        fontFamily:"'Rajdhani',sans-serif",fontSize:9,letterSpacing:1,
        textTransform:"uppercase",color:"rgba(212,180,80,0.58)",
        textShadow:"0 0 8px rgba(212,180,80,0.25)",
        overflow:"hidden",
        flexWrap:"wrap",
      }}>
        {/* <span style={{
          display:"inline-block",width:6,height:6,borderRadius:"50%",
          background:selEl.color,boxShadow:`0 0 8px ${selEl.glow}`,
          animation:"trailPulse 2s ease-in-out infinite",flexShrink:0,
        }}/> */}
        {/* <span style={{whiteSpace:"nowrap"}}>
          WASD / Arrows · Capture territory · Defeat enemy trails · Dominate the realm
        </span> */}
      </div>
    </>
  );
}
