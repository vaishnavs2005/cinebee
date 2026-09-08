import { io } from 'socket.io-client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelay',
    credential: 'openrelay',
  },
];

class SyncEngine {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.currentUser = null;
    this.isApplyingRemoteAction = false;
    this.heartbeatTimer = null;
    this.lastKnownDrift = 0;
    
    // WebRTC properties
    this.peers = new Map(); // targetId -> RTCPeerConnection
    this.pendingIceCandidates = new Map(); // targetId -> Array<candidate>
    this.localAudioStream = null;
    this.isVoiceChatStarted = false;
    this.hasMicPermission = false;

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
      onVoiceStart: () => {},
      onVoiceEnd: () => {},
      onVoiceStream: () => {},
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
      console.log('⚡ User joined room:', data.user);
      if (this.isVoiceChatStarted && data.user.id !== this.socket.id) {
        this._ensurePeerConnection(data.user.id);
      }
      this.callbacks.onUserJoined(data.user);
    });

    this.socket.on('user_left', (data) => {
      this._removePeerConnection(data.userId);
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

    // WebRTC Signaling
    this.socket.on('webrtc_offer', async ({ senderId, offer }) => {
      console.log(`[SyncEngine] 📩 Received webrtc_offer from ${senderId}`);
      try {
        let pc = this.peers.get(senderId);
        if (!pc) {
          pc = this._createPeerConnection(senderId, false);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await this._flushIceCandidates(senderId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('webrtc_answer', { targetId: senderId, answer });
        console.log(`[SyncEngine] 📤 Sent webrtc_answer to ${senderId}`);
      } catch (err) {
        console.error(`[SyncEngine] Error handling offer from ${senderId}:`, err);
      }
    });

    this.socket.on('webrtc_answer', async ({ senderId, answer }) => {
      console.log(`[SyncEngine] 📩 Received webrtc_answer from ${senderId}`);
      try {
        const pc = this.peers.get(senderId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await this._flushIceCandidates(senderId, pc);
        }
      } catch (err) {
        console.error(`[SyncEngine] Error handling answer from ${senderId}:`, err);
      }
    });

    this.socket.on('webrtc_ice_candidate', async ({ senderId, candidate }) => {
      try {
        const pc = this.peers.get(senderId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (!this.pendingIceCandidates.has(senderId)) {
            this.pendingIceCandidates.set(senderId, []);
          }
          this.pendingIceCandidates.get(senderId).push(candidate);
        }
      } catch (err) {
        console.warn(`[SyncEngine] Error adding ICE candidate from ${senderId}:`, err);
      }
    });

    this.socket.on('voice_start', ({ senderId }) => {
      this.callbacks.onVoiceStart(senderId);
    });

    this.socket.on('voice_end', ({ senderId }) => {
      this.callbacks.onVoiceEnd(senderId);
    });
  }

  setCallbacks(cbs) {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  joinRoom(roomId, username, mode = null) {
    return new Promise((resolve, reject) => {
      if (!this.socket) this.init();

      this.roomId = roomId.trim().toLowerCase();
      this.socket.emit('join_room', { roomId: this.roomId, username, mode }, (response) => {
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

  // --- WebRTC Voice Chat Methods ---

  async acquireLocalMedia() {
    if (this.localAudioStream) return this.localAudioStream;
    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Start muted for safety
      this.localAudioStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      this.hasMicPermission = true;

      // Attach track to all existing active peer connections
      const audioTrack = this.localAudioStream.getAudioTracks()[0];
      if (audioTrack) {
        for (const [targetId, pc] of this.peers.entries()) {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
          if (sender) {
            await sender.replaceTrack(audioTrack);
          } else {
            pc.addTrack(audioTrack, this.localAudioStream);
          }
        }
      }
      return this.localAudioStream;
    } catch (err) {
      console.warn('[SyncEngine] Microphone permission not granted or unavailable:', err);
      this.hasMicPermission = false;
      return null;
    }
  }

  async initVoiceChat(existingUsers = []) {
    if (!this.socket) return;
    this.isVoiceChatStarted = true;

    // Try to acquire mic early (starts muted). If denied, user can still hear others in recvonly mode.
    await this.acquireLocalMedia();

    // Connect to all existing users in the room
    for (const user of existingUsers) {
      if (user.id !== this.socket.id) {
        this._ensurePeerConnection(user.id);
      }
    }
  }

  _ensurePeerConnection(targetId) {
    if (this.peers.has(targetId)) return this.peers.get(targetId);
    // Deterministic initiator: lexicographically smaller socket ID initiates to avoid glare
    const isInitiator = !this.socket ? false : this.socket.id < targetId;
    return this._createPeerConnection(targetId, isInitiator);
  }

  setMicEnabled(enabled) {
    if (!this.localAudioStream) {
      console.warn('[SyncEngine] Cannot toggle mic: localAudioStream is not active');
      return false;
    }
    this.localAudioStream.getAudioTracks().forEach(track => {
      track.enabled = Boolean(enabled);
    });
    console.log(`[SyncEngine] 🎤 Microphone ${enabled ? 'ENABLED' : 'MUTED'}`);

    if (this.socket && this.roomId) {
      this.socket.emit(enabled ? 'voice_start' : 'voice_end', { roomId: this.roomId });
    }
    return true;
  }

  _createPeerConnection(targetId, isInitiator) {
    if (this.peers.has(targetId)) return this.peers.get(targetId);

    console.log(`[SyncEngine] 🛠️ Creating PeerConnection with ${targetId} (initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc_ice_candidate', { targetId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[SyncEngine] 🎧 Received remote audio track from ${targetId}`, event);
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      this.callbacks.onVoiceStream(targetId, stream);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[SyncEngine] 📡 Peer ${targetId} connectionState: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        console.log(`[SyncEngine] 🎉 WebRTC Audio Connected with peer ${targetId}!`);
      } else if (pc.connectionState === 'failed') {
        console.warn(`[SyncEngine] Peer connection failed with ${targetId}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[SyncEngine] 🧊 Peer ${targetId} iceConnectionState: ${pc.iceConnectionState}`);
    };

    // Attach local audio track if available, else add recvonly transceiver so audio is received
    if (this.localAudioStream && this.localAudioStream.getAudioTracks().length > 0) {
      this.localAudioStream.getAudioTracks().forEach(track => {
        pc.addTrack(track, this.localAudioStream);
      });
    } else {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch (err) {
        console.warn('[SyncEngine] addTransceiver error:', err);
      }
    }

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (this.socket) {
            this.socket.emit('webrtc_offer', { targetId, offer: pc.localDescription });
            console.log(`[SyncEngine] 📤 Sent webrtc_offer to ${targetId}`);
          }
        })
        .catch(err => console.error('[SyncEngine] Error creating offer:', err));
    }

    this.peers.set(targetId, pc);
    return pc;
  }

  async _flushIceCandidates(targetId, pc) {
    const queue = this.pendingIceCandidates.get(targetId);
    if (queue && queue.length > 0) {
      console.log(`[SyncEngine] Flushing ${queue.length} queued ICE candidates for ${targetId}`);
      while (queue.length > 0) {
        const candidate = queue.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[SyncEngine] Error adding queued ICE candidate for ${targetId}:`, err);
        }
      }
    }
    this.pendingIceCandidates.delete(targetId);
  }

  _removePeerConnection(targetId) {
    const pc = this.peers.get(targetId);
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        console.warn(err);
      }
      this.peers.delete(targetId);
    }
    this.pendingIceCandidates.delete(targetId);
  }

  cleanupVoiceChat() {
    this.isVoiceChatStarted = false;
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(track => track.stop());
      this.localAudioStream = null;
    }
    for (const [targetId, pc] of this.peers.entries()) {
      try {
        pc.close();
      } catch (err) {
        console.warn(err);
      }
    }
    this.peers.clear();
    this.pendingIceCandidates.clear();
    this.hasMicPermission = false;
  }
}

export const syncEngine = new SyncEngine();
