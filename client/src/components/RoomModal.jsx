import React, { useState, useEffect } from 'react';
import { Film, LogIn, PlusCircle, Sparkles, Users, Shield } from 'lucide-react';
import logoImg from '../assets/logo.png';

const RANDOM_NAMES = [
  'PopcornLover', 'CinemaStar', 'NightDirector', 'FilmBuff', 'CozyViewer',
  'MidnightReel', 'VelvetScreen', 'ScreenPartner', 'IndieFan', 'SilverSeat'
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
    // Keep username empty by default as requested
    if (initialRoomId) {
      setActiveTab('join');
      setRoomCode(initialRoomId);
    }
  }, [initialRoomId]);

  const handleSubmit = (e) => {
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
    onJoinRoom(targetRoom, cleanName, activeTab === 'create' ? roomMode : null);
  };

  const handleRandomizeName = () => {
    const rand = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setUsername(rand);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-icon">
            <img src={logoImg} alt="CineBee Logo" className="modal-logo-img" />
          </div>
          <h2 className="modal-title">CineBee</h2>
          <p className="modal-subtitle">Movie parties for two</p>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <PlusCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Create Room
          </button>
          <button
            type="button"
            className={`modal-tab ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            <LogIn size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Join Room
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Your Nickname</label>
              <button
                type="button"
                onClick={handleRandomizeName}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
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
              placeholder="e.g. CinemaLover"
              maxLength={20}
              required
            />
          </div>

          {activeTab === 'create' && (
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                Playback Control Mode
              </label>
              <div className="modal-mode-selector">
                <button
                  type="button"
                  className={`modal-mode-card ${roomMode === 'co-op' ? 'selected' : ''}`}
                  onClick={() => setRoomMode('co-op')}
                >
                  <div className="modal-mode-card-header">
                    <Users size={16} color={roomMode === 'co-op' ? '#ff2a6d' : 'var(--text-muted)'} />
                    <strong>Co-op Mode</strong>
                  </div>
                  <span className="modal-mode-card-desc">Both you and your partner can play, pause, and seek</span>
                </button>
                <button
                  type="button"
                  className={`modal-mode-card ${roomMode === 'host-only' ? 'selected' : ''}`}
                  onClick={() => setRoomMode('host-only')}
                >
                  <div className="modal-mode-card-header">
                    <Shield size={16} color={roomMode === 'host-only' ? '#ff2a6d' : 'var(--text-muted)'} />
                    <strong>Host-Only Mode</strong>
                  </div>
                  <span className="modal-mode-card-desc">Only you (the room host) can control playback</span>
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
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
                required
              />
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--status-error)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="submit-btn">
            {activeTab === 'create' ? 'Create Watch Room' : 'Join Watch Room'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <div>🔒 Video files are loaded 100% locally. Zero server upload.</div>
          <button
            type="button"
            onClick={onOpenInfo}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            How does CineBee work? (What you need to know)
          </button>
        </div>
      </div>
    </div>
  );
}
