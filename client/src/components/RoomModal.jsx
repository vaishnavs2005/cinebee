import React, { useState, useEffect } from 'react';
import { Film, LogIn, PlusCircle, Sparkles, Users, Shield, Radio, HelpCircle } from 'lucide-react';
import logoImg from '../assets/logo.png';
import titleImg from '../assets/title.png';
import rtitleImg from '../assets/rtitle.png';
import FloatingCatCanvas from './FloatingCatCanvas';

const RANDOM_NAMES = [
  'CinemaStar', 'NightDirector', 'FilmBuff', 'CozyViewer', 'MidnightReel',
  'ScreenPartner', 'IndieFan', 'SilverSeat', 'MovieLover', 'Cinephile'
];

function generateRandomCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function RoomModal({
  initialRoomId = '',
  onJoinRoom,
  onOpenInfo,
}) {
  const [activeTab, setActiveTab] = useState(initialRoomId ? 'join' : 'create');
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('cine_username') || '';
    } catch {
      return '';
    }
  });
  const [roomCode, setRoomCode] = useState(initialRoomId || '');
  const [roomMode, setRoomMode] = useState('co-op');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialRoomId) {
      setActiveTab('join');
      setRoomCode(initialRoomId);
    }
  }, [initialRoomId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = username.trim();
    if (!cleanName) {
      setError('Please enter your nickname');
      return;
    }

    let targetRoom = roomCode.trim().toLowerCase();
    if (activeTab === 'create') {
      targetRoom = generateRandomCode();
    } else if (!targetRoom) {
      setError('Please enter a room code');
      return;
    }

    localStorage.setItem('cine_username', cleanName);
    try {
      await onJoinRoom(targetRoom, cleanName, activeTab === 'create' ? roomMode : null);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    }
  };

  const handleRandomizeName = () => {
    const rand = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setUsername(rand);
  };

  return (
    <div className="landing-page-wrapper">
      <FloatingCatCanvas />
      <div className="landing-container">
        
        {/* Hero Section */}
        <div className="landing-hero">
          {/* Logo & Brand Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '8px' }}>
            <div className="brand-logo" style={{ width: '64px', height: '64px' }}>
              <img src={logoImg} alt="Meowvie Logo" className="brand-logo-img" />
            </div>
            {/* ── Wordmark Title & Stamped Ticket Badge ── */}
            <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
              <img
                src={titleImg}
                alt="Meowvie"
                className="brand-title-img-landing"
                style={{
                  height: '60px',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(3px 3px 0px #1A1A1A)',
                  display: 'block',
                }}
              />

              {/* ── Stamped & Tilted Ticket Badge ── */}
              <img
                src={rtitleImg}
                alt="Watch Party"
                className="landing-ticket-img"
                style={{
                  height: '42px',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(3px 3px 0px #1A1A1A)',
                  display: 'block',
                  transform: 'rotate(-6.5deg)',
                  marginLeft: '-16px',
                  transformOrigin: 'center center',
                }}
              />
            </div>
          </div>

          {/* Oversized Main Title */}
          <h1 className="landing-main-title">
            WATCH MOVIES TOGETHER.
          </h1>

          {/* Subtitle */}
          <p className="landing-subtitle">
            Synchronized private movie nights for up to 5 people. 
            Play identical local files in lockstep with <strong>zero video upload</strong>, <strong>zero buffering</strong>, and real-time walkie-talkie audio.
          </p>
        </div>

        {/* Interactive Center Card (Room Access Box) */}
        <div className="landing-order-card">
          {/* Tabs */}
          <div className="modal-tabs">
            <button
              type="button"
              className={`modal-tab ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              <PlusCircle size={16} style={{ marginRight: '6px' }} />
              Create Room
            </button>
            <button
              type="button"
              className={`modal-tab ${activeTab === 'join' ? 'active' : ''}`}
              onClick={() => setActiveTab('join')}
            >
              <LogIn size={16} style={{ marginRight: '6px' }} />
              Join Room
            </button>
          </div>

          {/* Form */}
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Your Nickname</label>
                <button
                  type="button"
                  onClick={handleRandomizeName}
                  style={{
                    background: 'var(--bg-cream-tint)',
                    border: '1.5px solid var(--border-olive)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 8px',
                    color: 'var(--accent-red)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '1px 1px 0px #1A1A1A',
                  }}
                >
                  <Sparkles size={11} /> Random
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. CinemaStar"
                maxLength={20}
                required
              />
            </div>

            <div className="modal-tab-content-slot">
              {activeTab === 'create' && (
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px' }}>
                    Playback Control Mode
                  </label>
                  <div className="modal-mode-selector">
                    <button
                      type="button"
                      className={`modal-mode-card ${roomMode === 'co-op' ? 'selected' : ''}`}
                      onClick={() => setRoomMode('co-op')}
                    >
                      <div className="modal-mode-card-header">
                        <Users size={16} color={roomMode === 'co-op' ? 'var(--accent-red)' : 'var(--text-muted)'} />
                        <span>Co-op Mode</span>
                      </div>
                      <span className="modal-mode-card-desc">
                        Both you and your partner can play, pause, and seek freely
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`modal-mode-card ${roomMode === 'host-only' ? 'selected' : ''}`}
                      onClick={() => setRoomMode('host-only')}
                    >
                      <div className="modal-mode-card-header">
                        <Shield size={16} color={roomMode === 'host-only' ? 'var(--accent-red)' : 'var(--text-muted)'} />
                        <span>Host-Only Mode</span>
                      </div>
                      <span className="modal-mode-card-desc">
                        Only you (the room host) control playback for both
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'join' && (
                <div className="form-group">
                  <label className="form-label">Room Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toLowerCase())}
                    placeholder="e.g. xk4p9"
                    style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', fontWeight: 800 }}
                    required
                  />
                  <span className="room-code-hint">Enter the 5-character room code shared by your partner</span>
                </div>
              )}
            </div>

            {error && (
              <div style={{ color: 'var(--status-error)', fontSize: '0.85rem', fontWeight: 700 }}>
                {error}
              </div>
            )}

            <button type="submit" className="submit-btn">
              {activeTab === 'create' ? '🎬 CREATE WATCH ROOM' : '🎟️ JOIN WATCH ROOM'}
            </button>
          </form>

          {/* Quick Footer Notes inside card */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '36px' }}>
            <button
              type="button"
              onClick={onOpenInfo}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-red)',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <HelpCircle size={14} /> How does Meowvie work? (Quick Guide)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
