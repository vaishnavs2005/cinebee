import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Clock, X, Sparkles, ChevronDown } from 'lucide-react';
import { REACTIONS } from '../utils/reactions';

function formatTimecode(seconds) {
  if (!isFinite(seconds) || seconds === null || seconds < 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function FullscreenChatOverlay({
  isFullscreen,
  messages = [],
  currentUser,
  currentVideoTime = 0,
  onSendMessage,
  onSendReaction,
  onSeekToTime,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState(null);
  const [inputText, setInputText] = useState('');

  const chatBoxRef = useRef(null);
  const chatBtnRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const ctrlDownRef = useRef(false);
  const ctrlAccompaniedRef = useRef(false);
  const ctrlTimeRef = useRef(0);

  // Dismiss chat when clicking outside the chat box
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (
        (chatBoxRef.current && chatBoxRef.current.contains(e.target)) ||
        (chatBtnRef.current && chatBtnRef.current.contains(e.target))
      ) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [isOpen]);

  // Fullscreen Keyboard Shortcuts:
  // - Tapping 'Ctrl' (Control): Opens chat and places cursor in field, OR closes chat even while cursor is in field!
  // - Pressing 'Escape': Closes chat.
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Control') {
        if (!ctrlDownRef.current) {
          ctrlDownRef.current = true;
          ctrlAccompaniedRef.current = false;
          ctrlTimeRef.current = Date.now();
        }
        return;
      }

      // If user presses another key while holding Ctrl (e.g. Ctrl+C, Ctrl+V, Ctrl+A),
      // mark it as accompanied so releasing Ctrl does NOT toggle the chat window
      if (ctrlDownRef.current) {
        ctrlAccompaniedRef.current = true;
      }

      // Handle Escape key to dismiss chat
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Control') {
        const wasAccompanied = ctrlAccompaniedRef.current;
        const duration = Date.now() - ctrlTimeRef.current;
        ctrlDownRef.current = false;
        ctrlAccompaniedRef.current = false;

        // Standalone tap of Control (not part of Ctrl+C, Ctrl+V, etc.)
        if (!wasAccompanied && duration < 800) {
          e.preventDefault();
          e.stopPropagation();

          if (isOpen) {
            // Even though cursor is in the field, clicking/tapping Control closes it!
            setIsOpen(false);
          } else {
            // Opens chat and places cursor directly in the field
            if (toastTimeoutRef.current) {
              clearTimeout(toastTimeoutRef.current);
            }
            setActiveToast(null);
            setIsOpen(true);
            setUnreadCount(0);

            setTimeout(() => {
              inputRef.current?.focus();
            }, 30);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [isFullscreen, isOpen]);

  // Auto-scroll chat messages to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  // Handle incoming messages for 5-second translucent toast preview
  useEffect(() => {
    if (!isFullscreen) return;

    if (messages.length > prevMessagesLengthRef.current) {
      const latestMsg = messages[messages.length - 1];

      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);

        // Show translucent toast if chat is closed
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }

        setActiveToast(latestMsg);

        // Disappear after 5 seconds as specified
        toastTimeoutRef.current = setTimeout(() => {
          setActiveToast(null);
        }, 5000);
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, isOpen, isFullscreen]);

  // Clean up timer on unmount or fullscreen change
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [isFullscreen]);

  // Auto-focus input when chat window opens
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Clicking the translucent toast opens the chat box to reply back
  const handleToastClick = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setActiveToast(null);
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleDismissToast = (e) => {
    e.stopPropagation();
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setActiveToast(null);
  };

  const toggleChat = (e) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
    } else {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      setActiveToast(null);
      setIsOpen(true);
      setUnreadCount(0);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (onSendMessage) {
      onSendMessage(inputText.trim());
    }
    setInputText('');
  };

  const handleInsertCurrentTimecode = (e) => {
    e.stopPropagation();
    const tc = formatTimecode(currentVideoTime);
    if (tc) {
      setInputText((prev) => (prev ? `${prev} @${tc} ` : `@${tc} `));
      inputRef.current?.focus();
    }
  };

  // Render clickable timecodes inside message text
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

  // Only render inside fullscreen mode
  if (!isFullscreen) return null;

  return (
    <div className="fullscreen-chat-layer">
      {/* Click-outside backdrop: clicking anywhere outside the chat window dismisses it immediately */}
      {isOpen && (
        <div
          className="fs-chat-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* 5-Second Translucent Message Toast Preview */}
      {activeToast && !isOpen && (
        <div
          className="fullscreen-message-toast"
          onClick={handleToastClick}
          title="Click to open chat and reply"
        >
          <div className="fs-toast-header">
            <div className="fs-toast-sender">
              <div className="fs-toast-avatar">
                {activeToast.sender ? activeToast.sender.charAt(0).toUpperCase() : 'P'}
              </div>
              <span className="fs-toast-name">{activeToast.sender || 'Partner'}</span>
              <span className="fs-toast-badge">Just now</span>
            </div>
            <button
              type="button"
              className="fs-toast-close"
              onClick={handleDismissToast}
              title="Dismiss preview"
            >
              <X size={14} />
            </button>
          </div>

          <div className="fs-toast-body">
            <p className="fs-toast-text">{activeToast.text}</p>
            {activeToast.timecode !== null && activeToast.timecode !== undefined && !activeToast.text.includes('@') && (
              <span className="message-timecode-tag fs-timecode-pill">
                <Clock size={10} /> {formatTimecode(activeToast.timecode)}
              </span>
            )}
          </div>

          <div className="fs-toast-footer">
            <span className="fs-toast-hint">Click to reply 💬</span>
          </div>

          {/* 5-Second Progress Countdown Bar */}
          <div className="fs-toast-progress-bar" />
        </div>
      )}

      {/* Fullscreen Chat Window - Floating directly above the chat logo button */}
      {isOpen && (
        <div
          ref={chatBoxRef}
          className="fullscreen-chat-box"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="fs-chat-header">
            <div className="fs-chat-title">
              <MessageSquare size={15} color="var(--accent-red)" />
              <span>Party Chat</span>
              <span className="fs-chat-count">({messages.length})</span>
              <span className="fs-chat-kbd-hint" title="Press Ctrl to close">Ctrl</span>
            </div>
            <button
              type="button"
              className="fs-chat-close-btn"
              onClick={toggleChat}
              title="Close chat (Ctrl / Esc)"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="fs-chat-messages">
            {messages.length === 0 ? (
              <div className="empty-chat-state fs-empty-state">
                <Sparkles size={20} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                <p>No messages yet. Say hi!</p>
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
                      {msg.senderAvatar && (
                        <img src={msg.senderAvatar} alt="" className="message-sender-avatar" />
                      )}
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
          <div className="fs-chat-reactions">
            {REACTIONS.map(({ emoji, image, label }) => (
              <button
                key={emoji}
                type="button"
                className="reaction-btn"
                onClick={() => onSendReaction && onSendReaction(emoji)}
                title={`React with ${label}`}
                aria-label={label}
              >
                <img src={image} alt={label} className="reaction-btn-img" />
              </button>
            ))}
          </div>

          {/* Chat Input & Timecode */}
          <form className="fs-chat-input-bar" onSubmit={handleSend}>
            <button
              type="button"
              onClick={handleInsertCurrentTimecode}
              className="ctrl-btn fs-timecode-btn"
              title={`Insert current timecode (@${formatTimecode(currentVideoTime)})`}
            >
              <Clock size={13} />
            </button>
            <input
              ref={inputRef}
              type="text"
              className="fs-chat-input"
              placeholder="Reply to partner... (Ctrl or Esc to close)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setIsOpen(false);
                }
              }}
              maxLength={500}
            />
            <button
              type="submit"
              className="chat-send-btn fs-send-btn"
              disabled={!inputText.trim()}
              title="Send reply"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Chat Logo Button - ALWAYS STAYS VISIBLE IN CORNER */}
      <button
        ref={chatBtnRef}
        type="button"
        className={`fullscreen-chat-btn ${isOpen ? 'active' : ''}`}
        onClick={toggleChat}
        title={isOpen ? "Close Party Chat (Ctrl / Esc)" : "Open Party Chat (Ctrl)"}
        aria-label="Toggle Party Chat"
      >
        {isOpen ? <X size={22} /> : <MessageSquare size={22} />}
        {!isOpen && unreadCount > 0 && (
          <span className="fs-chat-unread-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
