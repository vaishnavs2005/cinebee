import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import VideoPlayer from './components/VideoPlayer';
import ChatPanel from './components/ChatPanel';
import SyncStatusBar from './components/SyncStatusBar';
import RoomModal from './components/RoomModal';
import FileMismatchModal from './components/FileMismatchModal';
import InfoModal from './components/InfoModal';
import AppPreloader from './components/AppPreloader';
import { syncEngine } from './services/syncEngine';

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds === null || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function RemoteAudio({ stream, userId }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;

    el.srcObject = stream;
    el.volume = 1.0;

    const playStream = () => {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log(`🔊 [RemoteAudio] Playing audio from peer: ${userId}`);
        }).catch(err => {
          console.warn(`⚠️ [RemoteAudio] Autoplay blocked for ${userId}, waiting for user gesture:`, err);
          const resumeAudio = () => {
            el.play().catch(() => {});
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
          };
          window.addEventListener('click', resumeAudio, { once: true });
          window.addEventListener('keydown', resumeAudio, { once: true });
          window.addEventListener('touchstart', resumeAudio, { once: true });
        });
      }
    };

    playStream();
  }, [stream, userId]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);

  const [roomId, setRoomId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [controlMode, setControlMode] = useState('co-op');

  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);

  const [myFileInfo, setMyFileInfo] = useState(null);
  const [partnerFileInfo, setPartnerFileInfo] = useState(null);
  const [isMismatchDismissed, setIsMismatchDismissed] = useState(false);

  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [remoteAction, setRemoteAction] = useState(null);
  const [drift, setDrift] = useState(0);

  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Walkie-Talkie State
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  const [peerStreams, setPeerStreams] = useState({}); // { userId: stream }
  const [voiceMode, setVoiceMode] = useState('ptt');
  const [isOpenMicActive, setIsOpenMicActive] = useState(false);
  const isMicActiveRef = useRef(false);
  const voiceModeRef = useRef(voiceMode);
  const isOpenMicActiveRef = useRef(isOpenMicActive);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { isOpenMicActiveRef.current = isOpenMicActive; }, [isOpenMicActive]);
  useEffect(() => {
    return () => {
      syncEngine.cleanupVoiceChat();
    };
  }, []);

  const videoRef = useRef(null);
  const changeVideoTriggerRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const isWindowFs = (
        window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
        (window.innerWidth >= window.screen.width - 2 && window.innerHeight >= window.screen.height - 2)
      );
      setIsFullscreen(isDocFs || isWindowFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleFullscreenChange);
    };
  }, []);

  const toastTimersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    if (toastTimersRef.current.has(id)) {
      clearTimeout(toastTimersRef.current.get(id));
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((msg, options = {}) => {
    const category = typeof options === 'string' ? options : options.category || (
      typeof msg === 'string' && (msg.includes('seeked to') || msg.includes('jumped to')) ? 'seek' :
      typeof msg === 'string' && (msg.includes('paused') || msg.includes('resumed playback')) ? 'playback' :
      undefined
    );
    const duration = (typeof options === 'object' && options.duration) || (category === 'seek' ? 2200 : 2800);
    const id = Date.now() + Math.random();

    setToasts((prev) => {
      // 1. If this notification has a category (e.g., 'seek' or 'playback'), remove any existing notification of the same category immediately
      let filtered = category
        ? prev.filter((t) => {
            if (t.category === category) {
              if (toastTimersRef.current.has(t.id)) {
                clearTimeout(toastTimersRef.current.get(t.id));
                toastTimersRef.current.delete(t.id);
              }
              return false;
            }
            return true;
          })
        : prev;

      // 2. Limit total notifications on screen: at most 3 visible.
      // When a new notification arrives, older ones are dismissed so it stays within limit.
      const MAX_TOASTS = 3;
      if (filtered.length >= MAX_TOASTS) {
        const dropCount = filtered.length - (MAX_TOASTS - 1);
        const toDrop = filtered.slice(0, dropCount);
        toDrop.forEach((t) => {
          if (toastTimersRef.current.has(t.id)) {
            clearTimeout(toastTimersRef.current.get(t.id));
            toastTimersRef.current.delete(t.id);
          }
        });
        filtered = filtered.slice(dropCount);
      }

      return [...filtered, { id, text: msg, category }];
    });

    const timer = setTimeout(() => {
      dismissToast(id);
    }, duration);

    toastTimersRef.current.set(id, timer);
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  // Check URL parameter on first mount (?room=xyz)
  const initialRoomQuery = new URLSearchParams(window.location.search).get('room') || '';

  // Setup Sync Engine callbacks
  useEffect(() => {
    syncEngine.setCallbacks({
      onConnect: () => {
        setIsConnected(true);
      },
      onDisconnect: () => {
        setIsConnected(false);
        showToast('Disconnected from server. Reconnecting...');
      },
      onPresenceUpdate: (updatedUsers, count) => {
        setUsers(updatedUsers || []);
        const myUser = updatedUsers?.find((u) => u.id === syncEngine.socket?.id);
        if (myUser) {
          setCurrentUser((prev) => (prev ? { ...prev, ...myUser } : myUser));
        }
        // Find partner's file info if available
        const partner = updatedUsers?.find((u) => u.id !== syncEngine.socket?.id);
        if (partner && partner.fileInfo) {
          setPartnerFileInfo(partner.fileInfo);
        } else if (!partner) {
          setPartnerFileInfo(null);
        }
      },
      onUserJoined: (user) => {
        showToast(`${user.username} joined the room! 🎉`);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            sender: 'System',
            text: `${user.username} entered the room`,
            timestamp: Date.now(),
          },
        ]);
      },
      onUserLeft: (data) => {
        showToast(`${data.username} left the room`);
        setPeerStreams(prev => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
        setActiveSpeakers(prev => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            sender: 'System',
            text: `${data.username} left the room`,
            timestamp: Date.now(),
          },
        ]);
      },
      onVideoAction: (action) => {
        setRemoteAction(action);
        const name = action.senderName || 'Partner';
        const formatted = formatTime(action.time);
        if (action.type === 'play') {
          showToast(`${name} resumed playback`, { category: 'playback' });
        } else if (action.type === 'pause') {
          showToast(`${name} paused at ${formatted}`, { category: 'playback' });
        } else if (action.type === 'seek') {
          showToast(`${name} seeked to ${formatted}`, { category: 'seek', duration: 2200 });
        } else {
          showToast(`${name} updated playback at ${formatted}`);
        }
      },
      onHeartbeat: (data) => {
        if (!videoRef.current) return;
        const localTime = videoRef.current.currentTime;
        const currentDiff = localTime - data.time;
        setDrift(currentDiff);

        // Drift correction: if drift > 1.5 seconds and remote is playing, snap to remote time
        if (Math.abs(currentDiff) > 1.5 && data.playing && !videoRef.current.paused) {
          console.log(`Auto-correcting drift: ${currentDiff.toFixed(2)}s`);
          syncEngine.runProgrammaticUpdate(() => {
            videoRef.current.currentTime = data.time;
          });
        }
      },
      onPartnerFileInfo: (data) => {
        setPartnerFileInfo(data.fileInfo);
        setIsMismatchDismissed(false);
        showToast(`${data.senderName} loaded: ${data.fileInfo.fileName}`);
      },
      onChatMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
      },
      onReaction: (reaction) => {
        setReactions((prev) => [...prev, reaction]);
      },
      onControlModeChanged: (data) => {
        setControlMode(data.mode);
        showToast(`Control mode switched to ${data.mode === 'host-only' ? 'Host Only' : 'Co-op'}`);
      },
      onActionRejected: (data) => {
        showToast(`⚠️ ${data.reason || 'Action rejected'}`);
      },
      onVoiceStart: (senderId) => {
        setActiveSpeakers(prev => new Set([...prev, senderId]));
      },
      onVoiceEnd: (senderId) => {
        setActiveSpeakers(prev => {
          const next = new Set(prev);
          next.delete(senderId);
          return next;
        });
      },
      onVoiceStream: (senderId, stream) => {
        setPeerStreams(prev => ({ ...prev, [senderId]: stream }));
      },
    });

    // Provide local state on peer resync request
    syncEngine.onLocalStateRequested = () => {
      if (!videoRef.current) return null;
      return {
        time: videoRef.current.currentTime,
        playing: !videoRef.current.paused,
      };
    };
  }, [showToast]);

  // Walkie-Talkie 'M' Key handling
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.repeat) return; // Ignore hold repetition
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag) || document.activeElement?.isContentEditable) {
        return;
      }
      
      if ((e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z') && roomId) {
        e.preventDefault();
        
        if (voiceModeRef.current === 'ptt') {
          handlePttStart();
        } else if (voiceModeRef.current === 'open') {
          // Toggle Open Mic state
          const nextState = !isOpenMicActiveRef.current;
          try {
            if (nextState) {
              if (!syncEngine.localAudioStream) {
                await syncEngine.acquireLocalMedia();
              }
              const ok = syncEngine.setMicEnabled(true);
              if (ok) {
                setActiveSpeakers(prev => new Set([...prev, 'local']));
                setIsOpenMicActive(true);
              } else {
                showToast('Microphone not available.');
              }
            } else {
              syncEngine.setMicEnabled(false);
              setActiveSpeakers(prev => { const next = new Set(prev); next.delete('local'); return next; });
              setIsOpenMicActive(false);
            }
          } catch(err) {
            showToast('Microphone access required.');
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag) || document.activeElement?.isContentEditable) {
        return;
      }

      if (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (voiceModeRef.current === 'ptt') {
          handlePttEnd();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [roomId, users, showToast]);

  // Voice Chat UI Handlers
  const handlePttStart = useCallback(async () => {
    if (!roomId) return;
    if (voiceModeRef.current !== 'ptt') return;
    if (!isMicActiveRef.current) {
      isMicActiveRef.current = true;
      try {
        if (!syncEngine.localAudioStream) {
          await syncEngine.acquireLocalMedia();
        }
        const ok = syncEngine.setMicEnabled(true);
        if (ok) {
          setActiveSpeakers(prev => new Set([...prev, 'local']));
        } else {
          showToast('Microphone access required to speak.');
          isMicActiveRef.current = false;
        }
      } catch (err) {
        showToast('Microphone access required for voice chat.');
        isMicActiveRef.current = false;
      }
    }
  }, [roomId, showToast]);

  const handlePttEnd = useCallback(() => {
    if (voiceModeRef.current !== 'ptt') return;
    if (isMicActiveRef.current) {
      isMicActiveRef.current = false;
      syncEngine.setMicEnabled(false);
      setActiveSpeakers(prev => {
        const next = new Set(prev);
        next.delete('local');
        return next;
      });
    }
  }, []);

  const handleToggleVoiceMode = () => {
    setVoiceMode(prev => prev === 'ptt' ? 'open' : 'ptt');
    if (isMicActiveRef.current || isOpenMicActive) {
      syncEngine.setMicEnabled(false);
      isMicActiveRef.current = false;
      setIsOpenMicActive(false);
      setActiveSpeakers(prev => { const next = new Set(prev); next.delete('local'); return next; });
    }
  };

  const handleSetVoiceMode = (mode) => {
    if (mode === voiceMode) return;
    setVoiceMode(mode);
    if (isMicActiveRef.current || isOpenMicActive) {
      syncEngine.setMicEnabled(false);
      isMicActiveRef.current = false;
      setIsOpenMicActive(false);
      setActiveSpeakers(prev => { const next = new Set(prev); next.delete('local'); return next; });
    }
  };

  const handleToggleMic = async () => {
    if (voiceMode === 'ptt') return; // Mic button only toggles in Open Mic mode
    const nextState = !isOpenMicActive;
    try {
      if (nextState) {
        if (!syncEngine.localAudioStream) {
          await syncEngine.acquireLocalMedia();
        }
        const ok = syncEngine.setMicEnabled(true);
        if (ok) {
          setActiveSpeakers(prev => new Set([...prev, 'local']));
          setIsOpenMicActive(true);
        } else {
          showToast('Microphone not available.');
        }
      } else {
        syncEngine.setMicEnabled(false);
        setActiveSpeakers(prev => { const next = new Set(prev); next.delete('local'); return next; });
        setIsOpenMicActive(false);
      }
    } catch(err) {
      showToast('Microphone access required.');
    }
  };

  // Join Room Handler
  const handleJoinRoom = async (targetRoomId, username, initialMode = null) => {
    try {
      const response = await syncEngine.joinRoom(targetRoomId, username, initialMode);
      setRoomId(response.roomId);
      setCurrentUser(response.currentUser);
      setUsers(response.users);
      setControlMode(response.mode);
      if (response.messages) setMessages(response.messages);

      // Update URL query without reload
      const newUrl = `${window.location.pathname}?room=${response.roomId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);

      // Start periodic heartbeat
      syncEngine.startHeartbeat(() => {
        if (!videoRef.current) return null;
        return {
          time: videoRef.current.currentTime,
          playing: !videoRef.current.paused,
        };
      });

      // Initialize voice chat connection with users in the room
      syncEngine.initVoiceChat(response.users).catch(err => {
        console.warn('Voice chat initialization notice:', err);
      });

      showToast(`Joined room: ${response.roomId.toUpperCase()}`);
    } catch (err) {
      console.error('Join room failed:', err);
      showToast(`Error joining room: ${err.message}`);
      throw err;
    }
  };

  // Local Playback Action (user clicks play/pause/scrubs)
  const handleLocalPlaybackAction = (type, time) => {
    syncEngine.emitVideoAction(type, time);
  };

  // Local Video Metadata Loaded (user loads file)
  const handleLocalMetadataLoaded = (fileInfo) => {
    setMyFileInfo(fileInfo);
    syncEngine.sendFileMetadata(fileInfo.fileName, fileInfo.duration, fileInfo.fileSize);
  };

  // Send Chat Message
  const handleSendMessage = (text) => {
    syncEngine.sendChatMessage(text, currentVideoTime);
  };

  // Send Reaction
  const handleSendReaction = (emoji) => {
    syncEngine.sendReaction(emoji);
  };

  // Seek Video to specific timestamp
  const handleSeekToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      syncEngine.emitVideoAction('seek', time);
    }
  };

  // Toggle Host / Co-op mode
  const handleToggleControlMode = (mode) => {
    syncEngine.setControlMode(mode);
  };

  // Manual Resync
  const handleManualResync = () => {
    showToast('Requesting resync with partner...');
    syncEngine.requestResync();
  };

  const isHost = currentUser?.isHost;
  const partnerPresent = users.some((u) => u.id !== currentUser?.id);

  return (
    <div className="app-container">
      {/* Full App Asset Preloader (Google Fonts, Brand Logos, 12 Falling Emoji Heads) */}
      {showPreloader && (
        <AppPreloader
          onReady={() => setIsAppReady(true)}
          onLoaded={() => setShowPreloader(false)}
        />
      )}

      {/* Main App Layout - Only mounted once every font, logo, and falling head image is 100% loaded */}
      {isAppReady && (
        <>
          {/* Top Navigation Bar */}
          <Header
        roomId={roomId}
        currentUser={currentUser}
        usersCount={users.length}
        isConnected={isConnected}
        controlMode={controlMode}
        isHost={isHost}
        onToggleControlMode={handleToggleControlMode}
        onShowToast={showToast}
        onOpenInfo={() => setIsInfoModalOpen(true)}
        onChangeVideo={() => changeVideoTriggerRef.current?.()}
        voiceMode={voiceMode}
        isOpenMicActive={isOpenMicActive}
        isSpeaking={activeSpeakers.has('local')}
        onToggleVoiceMode={handleToggleVoiceMode}
        onSetVoiceMode={handleSetVoiceMode}
        onToggleMic={handleToggleMic}
        onPttStart={handlePttStart}
        onPttEnd={handlePttEnd}
      />

      {/* Main Cinema Workspace */}
      <main className="main-workspace">
        <section className="cinema-stage">
          {/* File Mismatch Warning Banner */}
          {!isMismatchDismissed && (
            <FileMismatchModal
              myFileInfo={myFileInfo}
              partnerFileInfo={partnerFileInfo}
              onDismiss={() => setIsMismatchDismissed(true)}
            />
          )}

          {/* Video Player */}
          <VideoPlayer
            videoRefExternal={videoRef}
            onPlaybackAction={handleLocalPlaybackAction}
            onMetadataLoaded={handleLocalMetadataLoaded}
            onTimeUpdate={setCurrentVideoTime}
            remoteAction={remoteAction}
            reactions={reactions}
            onShowToast={showToast}
            messages={messages}
            currentUser={currentUser}
            isHost={isHost}
            controlMode={controlMode}
            onToggleControlMode={handleToggleControlMode}
            onRegisterChangeVideoTrigger={(fn) => { changeVideoTriggerRef.current = fn; }}
            onSendMessage={handleSendMessage}
            onSendReaction={handleSendReaction}
            onSeekToTime={handleSeekToTime}
            toasts={toasts}
            onDismissToast={dismissToast}
            onFullscreenChange={setIsFullscreen}
            activeSpeakers={activeSpeakers}
            users={users}
          />

          {/* Sync Status & Resync Controls Bar */}
          <SyncStatusBar
            isConnected={isConnected}
            drift={drift}
            partnerFileInfo={partnerFileInfo}
            myFileInfo={myFileInfo}
            partnerPresent={partnerPresent}
            onManualResync={handleManualResync}
            onChangeVideo={() => changeVideoTriggerRef.current?.()}
          />
        </section>

        {/* Live Chat Sidebar */}
        <ChatPanel
          messages={messages}
          currentUser={currentUser}
          currentVideoTime={currentVideoTime}
          onSendMessage={handleSendMessage}
          onSendReaction={handleSendReaction}
          onSeekToTime={handleSeekToTime}
          isCollapsed={isChatCollapsed}
          onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
        />
      </main>

      {/* Initial Entry Room Modal */}
      {!roomId && (
        <RoomModal
          initialRoomId={initialRoomQuery}
          onJoinRoom={handleJoinRoom}
          onOpenInfo={() => setIsInfoModalOpen(true)}
        />
      )}

      {/* How It Works Info Modal */}
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      {/* Walkie Talkie UI Indicator (Rendered here when not in fullscreen; fullscreen renders inside VideoPlayer) */}
      {!isFullscreen && activeSpeakers.size > 0 && (
        <div className="walkie-talkie-indicator" aria-live="polite">
          <span style={{ fontSize: '1.2rem' }}>🎙️</span>
          <span>
            {Array.from(activeSpeakers).map(id => {
              if (id === 'local') return 'You';
              const user = users.find(u => u.id === id);
              return user ? user.username : 'Someone';
            }).join(', ')} speaking...
          </span>
        </div>
      )}

      {/* Render Remote Audio Streams */}
      {Object.entries(peerStreams).map(([userId, stream]) => (
        <RemoteAudio key={userId} userId={userId} stream={stream} />
      ))}

      {/* Toast Notifications (Standard non-fullscreen view; fullscreen toasts render inside VideoPlayer) */}
      {!isFullscreen && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="toast"
              onClick={() => dismissToast(toast.id)}
              title="Click to dismiss"
            >
              <span>{toast.text}</span>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
