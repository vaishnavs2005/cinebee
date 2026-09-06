import React, { useEffect, useState } from 'react';

export default function FloatingReactions({ reactions = [] }) {
  const [activeBubbles, setActiveBubbles] = useState([]);

  useEffect(() => {
    if (reactions.length === 0) return;
    const latest = reactions[reactions.length - 1];

    const newBubble = {
      id: latest.id || `${Date.now()}_${Math.random()}`,
      emoji: latest.emoji,
      // Random horizontal position between 15% and 85%
      left: `${15 + Math.random() * 70}%`,
    };

    setActiveBubbles((prev) => [...prev, newBubble]);

    const timer = setTimeout(() => {
      setActiveBubbles((prev) => prev.filter((b) => b.id !== newBubble.id));
    }, 2400);

    return () => clearTimeout(timer);
  }, [reactions]);

  return (
    <div className="floating-reactions-layer" aria-hidden="true">
      {activeBubbles.map((bubble) => (
        <span
          key={bubble.id}
          className="reaction-bubble"
          style={{ left: bubble.left }}
        >
          {bubble.emoji}
        </span>
      ))}
    </div>
  );
}
