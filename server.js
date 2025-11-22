const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Glitch uses process.env.PORT
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' })); // Limit request body size to 10mb

// In-memory room store
const rooms = {}; // { [roomCode]: { currentTime, videoUrl, lastActivity, roomName, movieTitle, chat, users } }
const userLastMessageTime = {}; // { [username]: lastTimestamp }
const MESSAGE_RATE_LIMIT = 5000; // 5 seconds

// Helper: generate a unique room code
function generateRoomCode() {
  let roomCode;
  do {
    roomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
  } while (rooms[roomCode]);
  return roomCode;
}

// Optional: serve the main page explicitly (static would do this too)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create a new room
app.get('/create-room', (req, res) => {
  const username = (req.query.username || '').trim();

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const roomCode = generateRoomCode();
  const now = Date.now();

  rooms[roomCode] = {
    currentTime: 0,
    videoUrl: '',
    lastActivity: now,
    roomName: `${username}'s room`, // Add "'s room" after username
    movieTitle: '',
    chat: [],
    // You can use this later if you track who is in the room
    users: new Set()
  };

  res.json({ roomCode });
});

// Set video URL and movie title for a room
app.get('/set-room-details/:roomCode', (req, res) => {
  const roomCode = req.params.roomCode;
  const url = req.query.url || '';
  const movieTitle = req.query.movieTitle || '';

  const room = rooms[roomCode];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.videoUrl = url;
  room.movieTitle = movieTitle;
  room.lastActivity = Date.now();

  res.json({ success: true });
});

// Get the current time for a room
app.get('/time/:roomCode', (req, res) => {
  const roomCode = req.params.roomCode;
  const room = rooms[roomCode];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.lastActivity = Date.now();
  res.json({ currentTime: room.currentTime });
});

// Get the video URL and other details for a room
app.get('/room-details/:roomCode', (req, res) => {
  const roomCode = req.params.roomCode;
  const room = rooms[roomCode];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.lastActivity = Date.now();
  res.json({
    videoUrl: room.videoUrl,
    roomName: room.roomName,
    movieTitle: room.movieTitle,
    chat: room.chat
  });
});

// Get list of rooms that actually have a video set
app.get('/rooms', (req, res) => {
  const availableRooms = Object.keys(rooms)
    .filter((roomCode) => !!rooms[roomCode].videoUrl)
    .map((roomCode) => ({
      code: roomCode,
      roomName: rooms[roomCode].roomName,
      movieTitle: rooms[roomCode].movieTitle
    }));

  res.json(availableRooms);
});

// Handle chat messages
app.post('/send-message/:roomCode', (req, res) => {
  const roomCode = req.params.roomCode;
  const { username, profilePicture, message } = req.body;
  const room = rooms[roomCode];
  const now = Date.now();

  if (!username || !message) {
    return res
      .status(400)
      .json({ error: 'Username and message are required' });
  }

  // Simple per-username rate limit
  if (
    userLastMessageTime[username] &&
    now - userLastMessageTime[username] < MESSAGE_RATE_LIMIT
  ) {
    return res.status(429).json({
      error:
        'You are sending messages too quickly. Please wait before sending another message.'
    });
  }

  userLastMessageTime[username] = now;

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.chat.push({
    username,
    profilePicture: profilePicture || null,
    message,
    timestamp: now
  });
  room.lastActivity = now;

  res.json({ success: true });
});

// Increment video time for each room
setInterval(() => {
  Object.keys(rooms).forEach((roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    // Only advance time if there is a video URL set
    if (room.videoUrl) {
      room.currentTime += 5; // Increment time every 5 seconds
    }
  });
}, 5000);

// Clean up rooms that don't have a video URL or haven't been active for 1 minute
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach((roomCode) => {
    const room = rooms[roomCode];
    if (
      !room.videoUrl ||
      now - room.lastActivity > 1 * 60 * 1000 // 1 minute
    ) {
      delete rooms[roomCode];
    }
  });
}, 60 * 1000); // Check every minute

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
