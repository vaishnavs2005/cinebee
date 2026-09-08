import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Rooms State
// Map<roomId, { users: Map<socketId, { username, isHost, fileInfo, joinedAt }>, playback: { playing, time, updatedAt, lastActionBy }, mode: 'co-op' | 'host-only', messages: [] }>
const rooms = new Map();

function getOrCreateRoom(roomId) {
  const cleanId = roomId.trim().toLowerCase();
  if (!rooms.has(cleanId)) {
    rooms.set(cleanId, {
      id: cleanId,
      users: new Map(),
      playback: {
        playing: false,
        time: 0,
        updatedAt: Date.now(),
        lastActionBy: null,
      },
      mode: 'co-op',
      messages: [],
    });
  }
  return rooms.get(cleanId);
}

function getSanitizedUsers(room) {
  const list = [];
  for (const [id, user] of room.users.entries()) {
    list.push({
      id,
      username: user.username,
      isHost: user.isHost,
      fileInfo: user.fileInfo,
      joinedAt: user.joinedAt,
    });
  }
  return list;
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('join_room', ({ roomId, username, mode }, callback) => {
    if (!roomId) {
      if (callback) callback({ error: 'Room ID is required' });
      return;
    }

    const cleanRoomId = roomId.trim().toLowerCase();
    const cleanUsername = (username || `User_${socket.id.substring(0, 4)}`).trim();

    // Leave any previous room
    if (currentRoomId) {
      socket.leave(currentRoomId);
      const prevRoom = rooms.get(currentRoomId);
      if (prevRoom) {
        prevRoom.users.delete(socket.id);
        io.to(currentRoomId).emit('presence_update', {
          users: getSanitizedUsers(prevRoom),
          count: prevRoom.users.size,
        });
      }
    }

    currentRoomId = cleanRoomId;
    socket.join(cleanRoomId);

    const room = getOrCreateRoom(cleanRoomId);
    const isFirstUser = room.users.size === 0;

    if (isFirstUser && (mode === 'host-only' || mode === 'co-op')) {
      room.mode = mode;
    }

    const userObj = {
      id: socket.id,
      username: cleanUsername,
      isHost: isFirstUser,
      fileInfo: null,
      joinedAt: Date.now(),
    };

    room.users.set(socket.id, userObj);

    // If host has left earlier and room now has users, designate new host
    let hasHost = false;
    for (const u of room.users.values()) {
      if (u.isHost) {
        hasHost = true;
        break;
      }
    }
    if (!hasHost) {
      userObj.isHost = true;
    }

    const payload = {
      roomId: cleanRoomId,
      currentUser: userObj,
      users: getSanitizedUsers(room),
      playback: room.playback,
      mode: room.mode,
      messages: room.messages,
    };

    if (callback) {
      callback({ success: true, ...payload });
    } else {
      socket.emit('room_joined', payload);
    }

    // Broadcast user joined to other room members
    socket.to(cleanRoomId).emit('user_joined', {
      user: userObj,
      users: getSanitizedUsers(room),
      count: room.users.size,
    });

    // Notify room presence
    io.to(cleanRoomId).emit('presence_update', {
      users: getSanitizedUsers(room),
      count: room.users.size,
    });
  });

  // Video Action (play, pause, seek)
  socket.on('video_action', (actionData) => {
    const { roomId, type, time } = actionData;
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId || !rooms.has(cleanRoomId)) return;

    const room = rooms.get(cleanRoomId);
    const user = room.users.get(socket.id);

    // Host-only mode check
    if (room.mode === 'host-only' && user && !user.isHost) {
      socket.emit('action_rejected', { reason: 'Only the host can control playback in Host Mode' });
      return;
    }

    const playing = type === 'play';
    room.playback = {
      playing,
      time: Math.max(0, Number(time) || 0),
      updatedAt: Date.now(),
      lastActionBy: user ? user.username : 'Partner',
    };

    // Broadcast to partner (all except sender)
    socket.to(cleanRoomId).emit('video_action', {
      type,
      time: room.playback.time,
      timestamp: Date.now(),
      senderId: socket.id,
      senderName: user ? user.username : 'Partner',
    });
  });

  // Periodic heartbeat for drift correction
  socket.on('video_heartbeat', ({ roomId, time, playing }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId || !rooms.has(cleanRoomId)) return;

    const room = rooms.get(cleanRoomId);
    const user = room.users.get(socket.id);

    // Keep server playback roughly up to date
    if (playing) {
      room.playback.playing = true;
      room.playback.time = Number(time) || 0;
      room.playback.updatedAt = Date.now();
    }

    socket.to(cleanRoomId).emit('partner_heartbeat', {
      senderId: socket.id,
      senderName: user ? user.username : 'Partner',
      time: Number(time) || 0,
      playing: Boolean(playing),
      timestamp: Date.now(),
    });
  });

  // Exchange local video metadata (file name, duration, size)
  socket.on('file_metadata', ({ roomId, fileName, duration, fileSize }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId || !rooms.has(cleanRoomId)) return;

    const room = rooms.get(cleanRoomId);
    const user = room.users.get(socket.id);
    if (!user) return;

    user.fileInfo = {
      fileName: fileName || 'Unknown',
      duration: Number(duration) || 0,
      fileSize: Number(fileSize) || 0,
      updatedAt: Date.now(),
    };

    // Broadcast to room
    io.to(cleanRoomId).emit('presence_update', {
      users: getSanitizedUsers(room),
      count: room.users.size,
    });

    socket.to(cleanRoomId).emit('partner_file_info', {
      senderId: socket.id,
      senderName: user.username,
      fileInfo: user.fileInfo,
    });
  });

  // Manual Resync
  socket.on('resync_request', ({ roomId }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId || !rooms.has(cleanRoomId)) return;

    const room = rooms.get(cleanRoomId);
    const user = room.users.get(socket.id);

    // Ask other users for their active state
    socket.to(cleanRoomId).emit('resync_requested_by_peer', {
      requesterId: socket.id,
      requesterName: user ? user.username : 'Partner',
    });
  });

  socket.on('resync_broadcast_state', ({ roomId, targetUserId, time, playing }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId) return;

    const payload = {
      time: Number(time) || 0,
      playing: Boolean(playing),
      timestamp: Date.now(),
      fromId: socket.id,
    };

    if (targetUserId) {
      io.to(targetUserId).emit('resync_apply_state', payload);
    } else {
      socket.to(cleanRoomId).emit('resync_apply_state', payload);
    }
  });

  // Chat message
  socket.on('chat_message', ({ roomId, text, timecode }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId || !rooms.has(cleanRoomId) || !text || !text.trim()) return;

    const room = rooms.get(cleanRoomId);
    const user = room.users.get(socket.id);

    const message = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: user ? user.username : 'Anonymous',
      senderId: socket.id,
      isHost: user ? user.isHost : false,
      text: text.trim().substring(0, 1000),
      timecode: Number(timecode) >= 0 ? Number(timecode) : null,
      timestamp: Date.now(),
    };

    room.messages.push(message);
    if (room.messages.length > 100) {
      room.messages.shift();
    }

    io.to(cleanRoomId).emit('chat_message', message);
  });

  // WebRTC Signaling for Voice Chat
  socket.on('webrtc_offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc_offer', {
      senderId: socket.id,
      offer,
    });
  });

  socket.on('webrtc_answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc_answer', {
      senderId: socket.id,
      answer,
    });
  });

  socket.on('webrtc_ice_candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc_ice_candidate', {
      senderId: socket.id,
      candidate,
    });
  });

  // Voice Chat UI Indicators
  socket.on('voice_start', ({ roomId }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId) return;
    socket.to(cleanRoomId).emit('voice_start', {
      senderId: socket.id,
    });
  });

  socket.on('voice_end', ({ roomId }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId) return;
    socket.to(cleanRoomId).emit('voice_end', {
      senderId: socket.id,
    });
  });

  // Emoji Reactions
  socket.on('reaction', ({ roomId, emoji }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId || !rooms.has(cleanRoomId)) return;

    const room = rooms.get(cleanRoomId);
    const user = room.users.get(socket.id);

    io.to(cleanRoomId).emit('reaction', {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      emoji: emoji || '❤️',
      sender: user ? user.username : 'Someone',
      senderId: socket.id,
      timestamp: Date.now(),
    });
  });

  // Toggle Control Mode (co-op vs host-only)
  socket.on('set_control_mode', ({ roomId, mode }) => {
    const cleanRoomId = (roomId || currentRoomId)?.trim().toLowerCase();
    if (!cleanRoomId || !rooms.has(cleanRoomId)) return;

    const room = rooms.get(cleanRoomId);
    const user = room.users.get(socket.id);

    if (user && user.isHost && (mode === 'co-op' || mode === 'host-only')) {
      room.mode = mode;
      io.to(cleanRoomId).emit('control_mode_changed', {
        mode,
        changedBy: user.username,
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      const departingUser = room.users.get(socket.id);
      room.users.delete(socket.id);

      if (room.users.size === 0) {
        // Schedule cleanup after 15 minutes if empty
        setTimeout(() => {
          if (rooms.has(currentRoomId) && rooms.get(currentRoomId).users.size === 0) {
            rooms.delete(currentRoomId);
          }
        }, 15 * 60 * 1000);
      } else {
        // If departing user was host, assign next user as host
        if (departingUser && departingUser.isHost) {
          const nextUser = room.users.values().next().value;
          if (nextUser) {
            nextUser.isHost = true;
          }
        }

        io.to(currentRoomId).emit('user_left', {
          userId: socket.id,
          username: departingUser ? departingUser.username : 'Partner',
          users: getSanitizedUsers(room),
          count: room.users.size,
        });

        io.to(currentRoomId).emit('presence_update', {
          users: getSanitizedUsers(room),
          count: room.users.size,
        });
      }
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    roomsCount: rooms.size,
    timestamp: Date.now(),
  });
});

// Serve frontend build in production
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('CineBee Server Running. Build client to see UI.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🐝 CineBee server listening on port ${PORT}`);
});
