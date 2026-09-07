import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import VideoPlayer from './components/VideoPlayer';
import ChatPanel from './components/ChatPanel';
import SyncStatusBar from './components/SyncStatusBar';
import RoomModal from './components/RoomModal';
import FileMismatchModal from './components/FileMismatchModal';
import InfoModal from './components/InfoModal';
import { syncEngine } from './services/syncEngine';

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds === null || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
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

  const videoRef = useRef(null);
  const changeVideoTriggerRef = useRef(null);

  const showToast = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text: msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
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
        const actionLabel = action.type === 'play' ? 'resumed playback' : action.type === 'pause' ? 'paused' : 'seeked to';
        const formatted = formatTime(action.time);
        showToast(`${action.senderName || 'Partner'} ${actionLabel} at ${formatted}`);
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

      showToast(`Joined room: ${response.roomId.toUpperCase()}`);
    } catch (err) {
      console.error('Join room failed:', err);
      showToast(`Error joining room: ${err.message}`);
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

      {/* Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
