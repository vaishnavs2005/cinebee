import React from 'react';
import { X, Film, CheckCircle2, Zap, Heart, ShieldCheck, HelpCircle, Users } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function InfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div
        className="modal-card info-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-logo" style={{ width: '48px', height: '48px' }}>
              <img src={logoImg} alt="Meowvie Logo" className="brand-logo-img" />
            </div>
            <div>
              <h2 className="sticker-title-red" style={{ fontSize: '1.6rem' }}>
                How Meowvie Works
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Everything you and your movie partner need to know
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ctrl-btn"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--bg-cream-tint)',
              border: '2px solid var(--border-olive)',
              boxShadow: '1px 1px 0px #1A1A1A'
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="info-sections">
          {/* Crucial Requirement */}
          <div className="info-box requirement">
            <div className="info-box-header">
              <CheckCircle2 size={18} color="var(--accent-red)" />
              <strong style={{ color: 'var(--text-dark)' }}>Requirement: Identical Movie Files</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', lineHeight: 1.45 }}>
              Both you and your partner must have the <strong>exact same video file</strong> (same duration, release, and cut) saved locally on your own devices.
            </p>
          </div>

          {/* Section 1: Why it's Zero Lag */}
          <div className="info-step">
            <div className="step-num">1</div>
            <div className="step-content">
              <h4>Zero Upload & Zero Lag</h4>
              <p>
                When you choose your video file, it is read directly from your device storage via the HTML5 File API. <strong>Your video is never uploaded to any server.</strong> Enjoy 100% original full HD/4K quality, instant scrubbing, and zero buffering.
              </p>
            </div>
          </div>

          {/* Section 2: Bi-directional sync */}
          <div className="info-step">
            <div className="step-num">2</div>
            <div className="step-content">
              <h4>Shared Playback Controls</h4>
              <p>
                Only tiny millisecond control signals (play, pause, seek, and drift checks) travel over the network. 
                Whether <strong>you</strong> pause or <strong>your partner</strong> jumps ahead, both screens mirror each other instantly.
              </p>
            </div>
          </div>

          {/* Section 3: Auto-Drift & Resync */}
          <div className="info-step">
            <div className="step-num">3</div>
            <div className="step-content">
              <h4>Heartbeat Drift Correction</h4>
              <p>
                Every 3 seconds, the app checks if both players are on the exact same frame. If anyone drifts by more than 1.5 seconds, the player automatically snaps back into sync. You can also tap <strong>"Resync"</strong> at any time.
              </p>
            </div>
          </div>

          {/* Section 4: Voice Chat, Subtitles & Reactions */}
          <div className="info-step">
            <div className="step-num">4</div>
            <div className="step-content">
              <h4>Walkie-Talkie Voice Chat & Subtitles</h4>
              <p>
                Hold <strong>'Z'</strong> on your keyboard to speak through the built-in push-to-talk walkie-talkie! Drop your <code>.srt</code> subtitle file into the player, and click any <code>@MM:SS</code> timecode in chat to jump right to the scene.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="submit-btn"
          style={{ width: '100%', marginTop: '20px' }}
        >
          🎬 GOT IT, LET'S WATCH!
        </button>
      </div>
    </div>
  );
}
