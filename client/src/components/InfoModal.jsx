import React from 'react';
import { X, Film, CheckCircle2, Zap, Heart, ShieldCheck, HelpCircle, Users } from 'lucide-react';

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
            <div className="info-badge-icon">
              <Film size={24} color="#ff2a6d" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                How CineBee Works
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Everything you and your partner need to know before starting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ctrl-btn"
            style={{ width: '32px', height: '32px' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="info-sections">
          {/* Section 1: Crucial Requirement */}
          <div className="info-box requirement">
            <div className="info-box-header">
              <CheckCircle2 size={18} color="#ff2a6d" />
              <strong>Requirement: Identical Movie Files</strong>
            </div>
            <p>
              Both you and your partner must have the <strong>exact same video file</strong> (same duration, release, and cut) saved locally on your own devices (computer, laptop).
            </p>
          </div>

          {/* Section 2: Why it's Zero Lag */}
          <div className="info-step">
            <div className="step-num">1</div>
            <div className="step-content">
              <h4>Zero Upload & Zero Lag</h4>
              <p>
                When you drag or select your video, it is read directly from your computer's disk using the HTML5 File API. <strong>The video file is never uploaded to the server.</strong> This means 100% original full HD/4K quality, instant scrubbing, zero buffering, and zero bandwidth costs.
              </p>
            </div>
          </div>

          {/* Section 3: Bi-directional sync */}
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

          {/* Section 4: Auto-Drift & Resync */}
          <div className="info-step">
            <div className="step-num">3</div>
            <div className="step-content">
              <h4>Heartbeat Drift Correction</h4>
              <p>
                Every 3 seconds, the app checks if both players are on the exact same frame. If anyone drifts by more than 1.5 seconds, the player automatically snaps back into sync. You can also tap <strong>"Resync"</strong> at any time.
              </p>
            </div>
          </div>

          {/* Section 5: Chat, Subtitles & Reactions */}
          <div className="info-step">
            <div className="step-num">4</div>
            <div className="step-content">
              <h4>Subtitles, Timecodes & Reactions</h4>
              <p>
                Drop your <code>.srt</code> or <code>.vtt</code> subtitle file right into the player. Click any <code>@MM:SS</code> timecode in chat to jump to favorite scenes, and tap emoji reactions to send floating celebrations!
              </p>
            </div>
          </div>

          {/* Quick Summary Checklist */}
          <div className="info-checklist">
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', marginBottom: '8px' }}>
              Quick 3-Step Routine:
            </div>
            <ol style={{ paddingLeft: '20px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <li>Create a room and send the invite link or code to your partner.</li>
              <li>Both of you choose your identical local video file (or use the test reel).</li>
              <li>Hit play and enjoy movie night together in perfect harmony!</li>
            </ol>
          </div>
        </div>

        <button
          onClick={onClose}
          className="submit-btn"
          style={{ width: '100%', marginTop: '20px', background: 'var(--accent-gradient)' }}
        >
          Got it, let's watch! 🍿
        </button>
      </div>
    </div>
  );
}
