import React, { useState, useEffect } from 'react';
import { preloadAllAppAssets } from '../services/assetPreloader';

export default function AppPreloader({ onReady, onLoaded }) {
  const [progress, setProgress] = useState(0.08);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    preloadAllAppAssets((p) => {
      if (!isCancelled) {
        setProgress((prev) => Math.max(prev, p));
      }
    }).then(() => {
      if (isCancelled) return;
      setProgress(1.0);
      // Reveal the home page DOM right now so it renders while preloader is still opaque
      if (onReady) onReady();

      // Brief moment at 100%, then fade out smoothly
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        const finishTimer = setTimeout(() => {
          if (onLoaded) onLoaded();
        }, 360);
        return () => clearTimeout(finishTimer);
      }, 180);

      return () => clearTimeout(timer);
    });

    return () => {
      isCancelled = true;
    };
  }, [onReady, onLoaded]);

  const percentage = Math.round(progress * 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0DFC9',
        backgroundImage: `
          radial-gradient(#E2CFB4 1.5px, transparent 1.5px),
          radial-gradient(rgba(231, 162, 39, 0.08) 1.5px, transparent 1.5px)
        `,
        backgroundSize: '24px 24px, 48px 48px',
        backgroundPosition: '0 0, 12px 12px',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.015)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
        transition: 'opacity 0.36s cubic-bezier(0.2, 0, 0, 1), transform 0.36s cubic-bezier(0.2, 0, 0, 1)',
        userSelect: 'none',
      }}
    >
      {/* Animated Center Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
          maxWidth: '340px',
          width: '90%',
        }}
      >
        {/* Bouncing Logo */}
        <div
          style={{
            position: 'relative',
            animation: 'preloaderBounce 1.2s infinite ease-in-out alternate',
          }}
        >
          <img
            src="/logo_mini.png"
            alt="Meowvie Cat"
            style={{
              width: '82px',
              height: '82px',
              objectFit: 'contain',
              filter: 'drop-shadow(3px 4px 0px #1A1A1A)',
            }}
          />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: "'Titan One', 'Fredoka', cursive, sans-serif",
              fontSize: '2rem',
              color: '#E8402C',
              letterSpacing: '0.04em',
              textShadow: '3px 3px 0px #1A1A1A',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            LOADING...
          </h2>
          <div
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#574D42',
              marginTop: '6px',
              letterSpacing: '0.02em',
            }}
          >
            {percentage < 90 ? 'Spinning the reel...' : 'Ready for showtime!'}
          </div>
        </div>

        {/* Comic Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '14px',
            backgroundColor: '#FAF2E6',
            borderRadius: '9999px',
            border: '2px solid #1A1A1A',
            boxShadow: '2px 2px 0px #1A1A1A',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              backgroundColor: '#E7A227',
              backgroundImage: 'linear-gradient(90deg, #E7A227, #E8402C)',
              borderRadius: '9999px',
              transition: 'width 0.22s ease-out',
            }}
          />
        </div>

        {/* Percentage Counter */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#1A1A1A',
          }}
        >
          {percentage}%
        </div>
      </div>

      <style>{`
        @keyframes preloaderBounce {
          0% {
            transform: translateY(0) rotate(-3deg);
          }
          100% {
            transform: translateY(-10px) rotate(3deg);
          }
        }
      `}</style>
    </div>
  );
}
