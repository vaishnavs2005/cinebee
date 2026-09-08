import React, { useState } from 'react';
import { Share2, Check, Users, Shield, Radio, Copy, HelpCircle, Upload, Mic, MicOff, Settings2 } from 'lucide-react';
import logoImg from '../assets/logo.png';

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
  onChangeVideo,
  voiceMode = 'ptt',
  isOpenMicActive = false,
  onToggleVoiceMode,
  onToggleMic,
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
        <div className="brand-logo">
          <img src={logoImg} alt="CineBee Logo" className="brand-logo-img" />
        </div>
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

        {roomId && (
          <button
            onClick={onChangeVideo}
            className="header-change-video-btn"
            title="Choose or switch video file"
          >
            <Upload size={14} />
            <span>Change Video</span>
          </button>
        )}

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
        {/* Voice Chat Controls */}
        <div className="voice-chat-controls" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '4px',
          borderRadius: '20px',
          marginRight: '12px',
        }}>
          <button
            onClick={onToggleVoiceMode}
            className="ctrl-btn"
            title={`Current Voice Mode: ${voiceMode === 'ptt' ? 'Push-To-Talk' : 'Open Mic'} (Click to change)`}
            style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '12px' }}
          >
            <Settings2 size={12} style={{ marginRight: '4px' }} />
            {voiceMode === 'ptt' ? 'PTT' : 'OPEN'}
          </button>
          
          <button
            onClick={onToggleMic}
            className={`ctrl-btn ${isOpenMicActive ? 'active' : ''}`}
            title={
              voiceMode === 'ptt' 
                ? "Push-To-Talk: Hold 'Z' to speak" 
                : "Open Mic: Click or press 'Z' to toggle mute"
            }
            style={{ 
              borderRadius: '50%', 
              width: '28px', 
              height: '28px', 
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isOpenMicActive ? 'var(--accent-primary)' : 'transparent',
              color: isOpenMicActive ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {isOpenMicActive ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
        </div>

        {isHost ? (
          <div className="mode-toggle" title="Playback Control Permission">
            <button
              className={`mode-btn ${controlMode === 'co-op' ? 'active' : ''}`}
              onClick={() => onToggleControlMode('co-op')}
              title="Both partners can play, pause, and seek"
            >
              <Users size={12} /> Co-op
            </button>
            <button
              className={`mode-btn ${controlMode === 'host-only' ? 'active' : ''}`}
              onClick={() => onToggleControlMode('host-only')}
              title="Only you (the host) can play, pause, and seek"
            >
              <Shield size={12} /> Host Only
            </button>
          </div>
        ) : (
          <div
            className={`mode-badge-guest ${controlMode === 'host-only' ? 'host-only' : 'co-op'}`}
            title={controlMode === 'host-only' ? 'Only the room host can play/pause/seek' : 'Both partners can control playback'}
          >
            {controlMode === 'host-only' ? <Shield size={12} color="#ec4899" /> : <Users size={12} color="#05d9e8" />}
            <span>{controlMode === 'host-only' ? 'Host-Only Mode' : 'Co-op Mode'}</span>
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
