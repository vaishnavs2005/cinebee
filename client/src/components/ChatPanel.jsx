import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Clock, ChevronRight, Sparkles } from 'lucide-react';

const QUICK_EMOJIS = ['❤️', '😂', '🍿', '😱', '🔥', '👏', '😭', '✨'];

function formatTimecode(seconds) {
  if (isNaN(seconds) || seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ChatPanel({
  messages = [],
  currentUser,
  currentVideoTime = 0,
  onSendMessage,
  onSendReaction,
  onSeekToTime,
  isCollapsed,
  onToggleCollapse,
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Check if user clicked the "add timecode" button or wants timecode attached
    onSendMessage(inputText);
    setInputText('');
  };

  const handleInsertCurrentTimecode = () => {
    const tc = formatTimecode(currentVideoTime);
    if (tc) {
      setInputText((prev) => (prev ? `${prev} @${tc} ` : `@${tc} `));
    }
  };

  // Helper to parse @MM:SS timecodes inside message text into clickable buttons
  const renderMessageContent = (text) => {
    const timecodeRegex = /@(\d{1,2}:\d{2})/g;
    const parts = [];
    let lastIdx = 0;
    let match;

    while ((match = timecodeRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index));
      }
      const timeStr = match[1];
      const [m, s] = timeStr.split(':').map(Number);
      const targetSeconds = m * 60 + s;

      parts.push(
        <button
          key={match.index}
          className="message-timecode-tag"
          onClick={(e) => {
            e.stopPropagation();
            if (onSeekToTime) onSeekToTime(targetSeconds);
          }}
          title={`Jump video to ${timeStr}`}
        >
          <Clock size={11} /> {timeStr}
        </button>
      );
      lastIdx = timecodeRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }

    return parts.length > 0 ? parts : text;
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        style={{
          position: 'absolute',
          right: '16px',
          bottom: '24px',
          zIndex: 30,
          background: 'var(--accent-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md)',
          fontWeight: 600,
        }}
      >
        <MessageSquare size={18} /> Chat ({messages.length})
      </button>
    );
  }

  return (
    <aside className="chat-sidebar">
      <div className="chat-header">
        <div className="chat-header-title">
          <MessageSquare size={16} color="var(--accent-primary)" />
          <span>Party Chat</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({messages.length})</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="ctrl-btn"
          title="Collapse Chat"
          aria-label="Collapse Chat"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat-state">
            <Sparkles size={32} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Welcome to your watch room!</div>
            <p>Type a message or tap an emoji reaction below to share the moment with your partner.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = currentUser && (msg.senderId === currentUser.id || msg.sender === currentUser.username);
            return (
              <div
                key={msg.id}
                className={`message-row ${isMine ? 'mine' : 'theirs'}`}
              >
                <div className="message-meta">
                  <span className="message-sender">{msg.sender}</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-bubble">
                  {renderMessageContent(msg.text)}
                  {msg.timecode !== null && msg.timecode !== undefined && !msg.text.includes('@') && (
                    <div style={{ marginTop: '4px' }}>
                      <span
                        className="message-timecode-tag"
                        onClick={() => onSeekToTime && onSeekToTime(msg.timecode)}
                        title="Jump to timecode"
                      >
                        <Clock size={11} /> {formatTimecode(msg.timecode)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Bar */}
      <div className="chat-reaction-bar">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="reaction-btn"
            onClick={() => onSendReaction(emoji)}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Chat Input */}
      <form className="chat-input-bar" onSubmit={handleSend}>
        <button
          type="button"
          onClick={handleInsertCurrentTimecode}
          className="ctrl-btn"
          title={`Insert current timecode (@${formatTimecode(currentVideoTime)})`}
          style={{ width: '32px', height: '32px' }}
        >
          <Clock size={15} />
        </button>
        <input
          type="text"
          className="chat-input"
          placeholder="Say something to your partner..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={500}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!inputText.trim()}
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </aside>
  );
}
