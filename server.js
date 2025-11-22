const express = require('express');
const app = express();
const path = require('path');
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' })); // Limit request body size to 10mb

const rooms = {};
const userLastMessageTime = {}; // Store the last message time for each user
const MESSAGE_RATE_LIMIT = 5000; // 5 seconds

// Generate a unique room code
function generateRoomCode() {
    let roomCode;
    do {
        roomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    } while (rooms[roomCode]);
    return roomCode;
}

// Create a new room
app.get('/create-room', (req, res) => {
    const username = req.query.username;
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const roomCode = generateRoomCode();
    rooms[roomCode] = {
        currentTime: 0,
        videoUrl: '',
        lastActivity: Date.now(),
        roomName: `${username}'s room`, // Add "'s room" after username
        movieTitle: '',
        chat: [],
        users: new Set()
    };
    res.json({ roomCode });
});

// Set video URL and movie title for a room
app.get('/set-room-details/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode;
    const { url, movieTitle } = req.query;
    if (rooms[roomCode]) {
        rooms[roomCode].videoUrl = url;
        rooms[roomCode].movieTitle = movieTitle;
        rooms[roomCode].lastActivity = Date.now();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Get the current time for a room
app.get('/time/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode;
    if (rooms[roomCode]) {
        rooms[roomCode].lastActivity = Date.now();
        res.json({ currentTime: rooms[roomCode].currentTime });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Get the video URL and other details for a room
app.get('/room-details/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode;
    if (rooms[roomCode]) {
        rooms[roomCode].lastActivity = Date.now();
        res.json({ videoUrl: rooms[roomCode].videoUrl, roomName: rooms[roomCode].roomName, movieTitle: rooms[roomCode].movieTitle, chat: rooms[roomCode].chat });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Get list of rooms
app.get('/rooms', (req, res) => {
    const availableRooms = Object.keys(rooms)
        .filter(roomCode => rooms[roomCode].videoUrl)
        .map(roomCode => ({
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
    const currentTime = Date.now();

    if (!username || !message) {
        return res.status(400).json({ error: 'Username and message are required' });
    }

    if (userLastMessageTime[username] && currentTime - userLastMessageTime[username] < MESSAGE_RATE_LIMIT) {
        return res.status(429).json({ error: 'You are sending messages too quickly. Please wait before sending another message.' });
    }

    userLastMessageTime[username] = currentTime;

    if (rooms[roomCode]) {
        rooms[roomCode].chat.push({ username, profilePicture, message, timestamp: currentTime });
        rooms[roomCode].lastActivity = currentTime;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Increment video time for each room
setInterval(() => {
    Object.keys(rooms).forEach(roomCode => {
        rooms[roomCode].currentTime += 5; // Increment time every 5 seconds
    });
}, 5000);

// Clean up rooms that don't have a video URL or haven't been active for 1 minute
setInterval(() => {
    const now = Date.now();
    Object.keys(rooms).forEach(roomCode => {
        if (!rooms[roomCode].videoUrl || (now - rooms[roomCode].lastActivity) > 1 * 60 * 1000) {
            delete rooms[roomCode];
        }
    });
}, 60 * 1000); // Check every minute

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
