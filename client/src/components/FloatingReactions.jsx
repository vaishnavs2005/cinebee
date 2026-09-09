import React, { useEffect, useState } from 'react';
import { EMOJI_TO_IMAGE } from '../utils/reactions';

/** Clamp a percentage so bubbles don't clip off screen edges */
const clamp = (val, min = 5, max = 90) => Math.min(max, Math.max(min, val));

export default function FloatingReactions({ reactions = [] }) {
  const [activeBubbles, setActiveBubbles] = useState([]);

  useEffect(() => {
    if (reactions.length === 0) return;
    const latest = reactions[reactions.length - 1];
    const emoji = latest.emoji;
    const image = EMOJI_TO_IMAGE[emoji] || null;
    const now = Date.now();

    // Pick a center position for the image (keep away from edges so side emojis fit)
    const centerPct = 25 + Math.random() * 50; // 25%–75%

    // Side offset: how far left/right each native emoji sits from the image
    const offset = 12 + Math.random() * 6; // 12%–18% apart

    const newBubbles = [
      // ── 1. Main custom PNG image ──
      {
        id: `${now}_img`,
        type: 'image',
        image,
        emoji,
        left: `${centerPct}%`,
        bottomOffset: 60,       // px from bottom
        delay: 0,
      },
      // ── 2. Native emoji — LEFT of the image ──
      {
        id: `${now}_left`,
        type: 'native',
        emoji,
        left: `${clamp(centerPct - offset)}%`,
        bottomOffset: 52 + Math.random() * 16,  // slight vertical jitter
        delay: 120,             // appears 120ms after the image
      },
      // ── 3. Native emoji — RIGHT of the image ──
      {
        id: `${now}_right`,
        type: 'native',
        emoji,
        left: `${clamp(centerPct + offset)}%`,
        bottomOffset: 52 + Math.random() * 16,
        delay: 240,             // appears 240ms after the image
      },
    ];

    setActiveBubbles((prev) => [...prev, ...newBubbles]);

    const timer = setTimeout(() => {
      const ids = new Set(newBubbles.map((b) => b.id));
      setActiveBubbles((prev) => prev.filter((b) => !ids.has(b.id)));
    }, 3200);

    return () => clearTimeout(timer);
  }, [reactions]);

  return (
    <div className="floating-reactions-layer" aria-hidden="true">
      {activeBubbles.map((bubble) =>
        bubble.type === 'image' ? (
          <div
            key={bubble.id}
            className="reaction-bubble reaction-bubble--image"
            style={{ left: bubble.left, bottom: bubble.bottomOffset }}
          >
            {bubble.image
              ? <img src={bubble.image} alt={bubble.emoji} className="reaction-bubble-img" />
              : <span style={{ fontSize: '3rem' }}>{bubble.emoji}</span>
            }
          </div>
        ) : (
          <span
            key={bubble.id}
            className="reaction-bubble reaction-bubble--native"
            style={{
              left: bubble.left,
              bottom: bubble.bottomOffset,
              animationDelay: `${bubble.delay}ms`,
            }}
          >
            {bubble.emoji}
          </span>
        )
      )}
    </div>
  );
}
