import React, { useState } from 'react';
import { Share2, Check, Users, Shield, Radio, Copy, HelpCircle } from 'lucide-react';

export default function Header({
  roomId,
  currentUser,
  usersCount = 1,
  isConnected,
  controlMode,
  isHost,
  onToggleControlMode,
  onShowToast,
  onOpenInfo,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      if (onShowToast) onShowToast('Room link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">🐝</div>
        <div>
          <h1 className="brand-title">CineBee</h1>
        </div>
      </div>

      <div className="header-center">
        {roomId && (
          <div className="room-pill" title="Click to copy invite link" onClick={handleCopyLink} style={{ cursor: 'pointer' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ROOM:</span>
            <span className="room-code">{roomId.toUpperCase()}</span>
            <button className="copy-btn" aria-label="Copy Room Link">
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        )}

        <div className="sync-badge" title={isConnected ? 'Connected to Relay Server' : 'Disconnected'}>
          <span className={`pulse-dot ${isConnected ? 'connected' : 'waiting'}`} />
          <span style={{ fontSize: '0.8rem', color: isConnected ? 'var(--text-secondary)' : 'var(--status-warning)' }}>
            {isConnected ? `${usersCount} ${usersCount === 1 ? 'Person' : 'People'}` : 'Offline'}
          </span>
        </div>

        <button
          onClick={onOpenInfo}
          className="info-header-btn"
          title="How Cine Nightly works & requirements"
        >
          <HelpCircle size={15} />
          <span>How It Works</span>
        </button>
      </div>

      <div className="header-right">
        {isHost ? (
          <div className="mode-toggle" title="Playback Control Permission">
            <button
              className={`mode-btn ${controlMode === 'co-op' ? 'active' : ''}`}
              onClick={() => onToggleControlMode('co-op')}
            >
              <Users size={12} /> Co-op
            </button>
            <button
              className={`mode-btn ${controlMode === 'host-only' ? 'active' : ''}`}
              onClick={() => onToggleControlMode('host-only')}
            >
              <Shield size={12} /> Host Only
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Mode: <span style={{ color: '#fff', fontWeight: 600 }}>{controlMode === 'host-only' ? 'Host Only' : 'Co-op'}</span>
          </div>
        )}

        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: '#fff'
            }}>
              {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}
            </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {currentUser.username} {isHost && <span style={{ color: '#a5b4fc', fontSize: '0.75rem' }}>(Host)</span>}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
