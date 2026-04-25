const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();

// Enable Gzip compression (standard and best practice for Express)
app.use(compression());

const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io for future multiplayer connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Setup basic room logic or events for future development here
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
