import React, { useEffect, useState, useRef } from 'react';
import { Film, Sparkles, Star, Ticket } from 'lucide-react';
import logoMini from '/logo_mini.png';

// 1. Clapperboard Snap & Stamp Sound (At 0ms when VIP ticket stamps down)
function playStampSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.007));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  } catch (err) {
    console.debug('Cinema audio note:', err);
  }
}

// 2. Warm Vintage Theater Chime (At 1000ms when curtains part)
function playCurtainChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    const playTone = (freq, startTime, duration, volume = 0.2) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Harmonic chord (F5 -> C6)
    playTone(698.46, now, 0.7, 0.22); // F5
    playTone(1046.5, now + 0.1, 0.85, 0.18); // C6
    playTone(349.23, now, 0.6, 0.12); // F4 undertone
  } catch (err) {
    console.debug('Cinema audio note:', err);
  }
}

export default function CinemaTransition({
  roomId,
  username,
  isHost,
  onComplete,
}) {
  // Phase: 'holding' (0 - 1000ms: stays on screen for immersion) -> 'parting' (1000ms - 1850ms) -> 'done'
  const [phase, setPhase] = useState('holding');
  const stampPlayedRef = useRef(false);

  useEffect(() => {
    // 1. Play ticket stamp sound on initial mount
    if (!stampPlayedRef.current) {
      stampPlayedRef.current = true;
      playStampSound();
    }

    // 2. Stay there for 1 full second (1000ms) for immersion, then part the curtains
    const partingTimer = setTimeout(() => {
      setPhase('parting');
      playCurtainChime();
    }, 1000);

    // 3. Once curtains have fully opened (~850ms later), complete the transition
    const completeTimer = setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, 1850);

    return () => {
      clearTimeout(partingTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const isParting = phase === 'parting' || phase === 'done';

  return (
    <div className={`cinema-transition-overlay ${isParting ? 'curtains-parting' : ''}`} aria-hidden="true">
      {/* ── Background Projector Light Beam ── */}
      <div className="cinema-projector-beam">
        <div className="cinema-projector-dust">
          {[...Array(12)].map((_, i) => (
            <span key={i} className={`dust-particle dust-p${i + 1}`} />
          ))}
        </div>
      </div>

      {/* ── Left Velvet Curtain ── */}
      <div className={`cinema-curtain cinema-curtain-left ${isParting ? 'open-left' : ''}`}>
        <div className="curtain-gold-fringe" />
        <div className="curtain-tassel-rope left" />
      </div>

      {/* ── Right Velvet Curtain ── */}
      <div className={`cinema-curtain cinema-curtain-right ${isParting ? 'open-right' : ''}`}>
        <div className="curtain-gold-fringe" />
        <div className="curtain-tassel-rope right" />
      </div>

      {/* ── Top Scalloped Theater Valance (Pelmet) ── */}
      <div className={`cinema-valance ${isParting ? 'valance-lift' : ''}`}>
        <div className="valance-scallops">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="valance-scallop" />
          ))}
        </div>
      </div>

      {/* ── Center Stage: Stamped VIP Ticket ── */}
      <div className={`cinema-ticket-container ${isParting ? 'ticket-part-zoom' : 'ticket-stamp-in'}`}>
        <div className="cinema-ticket-card">
          {/* Perforated Notches on Left & Right */}
          <div className="ticket-notch notch-left" />
          <div className="ticket-notch notch-right" />

          {/* Ticket Header */}
          <div className="ticket-header">
            <div className="ticket-brand">
              <img src={logoMini} alt="Meowvie Logo" className="ticket-logo" />
              <div>
                <span className="ticket-brand-name">MEOWVIE CINEMA</span>
                <span className="ticket-brand-tag">SHOWTIME PREMIERE</span>
              </div>
            </div>
            <div className="ticket-badge-admit">
              <Ticket size={12} style={{ marginRight: '4px' }} />
              ADMIT ONE
            </div>
          </div>

          {/* Perforated Divider Line */}
          <div className="ticket-divider" />

          {/* Ticket Body Content */}
          <div className="ticket-body">
            <div className="ticket-room-section">
              <span className="ticket-label">WATCH ROOM CODE</span>
              <div className="ticket-code-display">
                {roomId ? roomId.toUpperCase() : 'MEOW'}
              </div>
            </div>

            <div className="ticket-details-grid">
              <div className="ticket-detail-item">
                <span className="ticket-label">GUEST / VIEWER</span>
                <span className="ticket-val">{username || 'Movie Lover'}</span>
              </div>
              <div className="ticket-detail-item">
                <span className="ticket-label">SEAT ROLE</span>
                <span className="ticket-val role-highlight">
                  {isHost ? '🎬 Room Host' : '🍿 Party Co-op'}
                </span>
              </div>
            </div>

            {/* Rubber Stamp Badge */}
            <div className="ticket-rubber-stamp">
              <div className="stamp-inner">
                <Sparkles size={14} className="stamp-sparkle" />
                <span>VERIFIED</span>
                <Star size={10} className="stamp-star" />
              </div>
            </div>
          </div>

          {/* Ticket Footer / Barcode */}
          <div className="ticket-footer">
            <div className="ticket-barcode">
              <span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
              <span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
            </div>
            <span className="ticket-slogan">SYNCED • BUFFER-FREE • ZERO UPLOAD</span>
          </div>
        </div>

        {/* Decorative Particle Sparks around the ticket */}
        <div className="ticket-sparks">
          <span className="spark spark-1">✦</span>
          <span className="spark spark-2">★</span>
          <span className="spark spark-3">✨</span>
          <span className="spark spark-4">✦</span>
        </div>
      </div>
    </div>
  );
}
