import { io } from 'socket.io-client';

class SyncEngine {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.currentUser = null;
    this.isApplyingRemoteAction = false;
    this.heartbeatTimer = null;
    this.lastKnownDrift = 0;
    this.callbacks = {
      onConnect: () => {},
      onDisconnect: () => {},
      onPresenceUpdate: () => {},
      onUserJoined: () => {},
      onUserLeft: () => {},
      onVideoAction: () => {},
      onHeartbeat: () => {},
      onDrift: () => {},
      onChatMessage: () => {},
      onReaction: () => {},
      onPartnerFileInfo: () => {},
      onControlModeChanged: () => {},
      onActionRejected: () => {},
    };
  }

  init(serverUrl = '') {
    if (this.socket) return;

    // Use current origin or default port 3001 in dev
    const targetUrl = serverUrl || (window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin);

    this.socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Socket connected:', this.socket.id);
      this.callbacks.onConnect(this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('⚡ Socket disconnected');
      this.callbacks.onDisconnect();
    });

    this.socket.on('presence_update', (data) => {
      this.callbacks.onPresenceUpdate(data.users, data.count);
    });

    this.socket.on('user_joined', (data) => {
      this.callbacks.onUserJoined(data.user);
    });

    this.socket.on('user_left', (data) => {
      this.callbacks.onUserLeft(data);
    });

    this.socket.on('video_action', (data) => {
      this.callbacks.onVideoAction(data);
    });

    this.socket.on('partner_heartbeat', (data) => {
      this.callbacks.onHeartbeat(data);
    });

    this.socket.on('partner_file_info', (data) => {
      this.callbacks.onPartnerFileInfo(data);
    });

    this.socket.on('resync_requested_by_peer', (data) => {
      // When partner asks for resync, we reply with our current state if we are playing
      if (this.onLocalStateRequested) {
        const state = this.onLocalStateRequested();
        if (state) {
          this.socket.emit('resync_broadcast_state', {
            roomId: this.roomId,
            targetUserId: data.requesterId,
            time: state.time,
            playing: state.playing,
          });
        }
      }
    });

    this.socket.on('resync_apply_state', (data) => {
      this.callbacks.onVideoAction({
        type: data.playing ? 'play' : 'pause',
        time: data.time,
        isResync: true,
      });
    });

    this.socket.on('chat_message', (msg) => {
      this.callbacks.onChatMessage(msg);
    });

    this.socket.on('reaction', (reaction) => {
      this.callbacks.onReaction(reaction);
    });

    this.socket.on('control_mode_changed', (data) => {
      this.callbacks.onControlModeChanged(data);
    });

    this.socket.on('action_rejected', (data) => {
      this.callbacks.onActionRejected(data);
    });
  }

  setCallbacks(cbs) {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  joinRoom(roomId, username) {
    return new Promise((resolve, reject) => {
      if (!this.socket) this.init();

      this.roomId = roomId.trim().toLowerCase();
      this.socket.emit('join_room', { roomId: this.roomId, username }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          this.currentUser = response.currentUser;
          resolve(response);
        }
      });
    });
  }

  emitVideoAction(type, time) {
    if (!this.socket || !this.roomId || this.isApplyingRemoteAction) return;

    this.socket.emit('video_action', {
      roomId: this.roomId,
      type,
      time: Math.max(0, Number(time) || 0),
    });
  }

  startHeartbeat(getTimeAndPlayState) {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || !this.roomId) return;
      const state = getTimeAndPlayState();
      if (state) {
        this.socket.emit('video_heartbeat', {
          roomId: this.roomId,
          time: state.time,
          playing: state.playing,
        });
      }
    }, 3000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  sendChatMessage(text, timecode = null) {
    if (!this.socket || !this.roomId || !text.trim()) return;
    this.socket.emit('chat_message', {
      roomId: this.roomId,
      text,
      timecode,
    });
  }

  sendReaction(emoji) {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('reaction', {
      roomId: this.roomId,
      emoji,
    });
  }

  sendFileMetadata(fileName, duration, fileSize) {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('file_metadata', {
      roomId: this.roomId,
      fileName,
      duration,
      fileSize,
    });
  }

  requestResync() {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('resync_request', { roomId: this.roomId });
  }

  setControlMode(mode) {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('set_control_mode', { roomId: this.roomId, mode });
  }

  // Guard to prevent local DOM video events from triggering remote emit loops
  runProgrammaticUpdate(actionFn) {
    this.isApplyingRemoteAction = true;
    try {
      actionFn();
    } finally {
      setTimeout(() => {
        this.isApplyingRemoteAction = false;
      }, 350);
    }
  }
}

export const syncEngine = new SyncEngine();
