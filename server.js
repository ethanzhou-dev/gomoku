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

let rooms = {}; // roomId -> { id, host: socket.id, hostName, guest: socket.id, guestName, size, forbidden, status }
let users = {}; // socket.id -> { name }

function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit code
}

function getAvailableRooms() {
    return Object.values(rooms).filter(r => r.status === 'waiting').map(r => ({
        id: r.id,
        hostName: r.hostName,
        size: r.size,
        forbidden: r.forbidden
    }));
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('setNickname', (data) => {
        let name, stats;
        if (typeof data === 'object') {
            name = data.name;
            stats = data.stats || { total: 0, win: 0 };
        } else {
            name = data;
            stats = { total: 0, win: 0 };
        }
        users[socket.id] = { name, stats };
        socket.emit('roomList', getAvailableRooms());
    });

    socket.on('getRoomList', () => {
        socket.emit('roomList', getAvailableRooms());
    });

    socket.on('createRoom', (settings) => {
        if (!users[socket.id]) return;
        const roomId = generateRoomId();
        rooms[roomId] = {
            id: roomId,
            host: socket.id,
            hostName: users[socket.id].name,
            guest: null,
            guestName: null,
            size: settings.boardSize,
            forbidden: settings.forbidden,
            status: 'waiting'
        };
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        io.emit('roomList', getAvailableRooms());
    });

    socket.on('joinRoom', (roomId) => {
        if (!users[socket.id]) return;
        const room = rooms[roomId];
        if (room && room.status === 'waiting') {
            room.guest = socket.id;
            room.guestName = users[socket.id].name;
            room.status = 'playing';
            socket.join(roomId);
            
            io.to(roomId).emit('gameStart', {
                roomId: roomId,
                hostName: room.hostName,
                hostStats: users[room.host] ? users[room.host].stats : { total: 0, win: 0 },
                guestName: room.guestName,
                guestStats: users[room.guest] ? users[room.guest].stats : { total: 0, win: 0 },
                size: room.size,
                forbidden: room.forbidden,
                hostId: room.host,
                guestId: room.guest,
                hostColor: room.hostColor
            });
            
            io.emit('roomList', getAvailableRooms());
        } else {
            socket.emit('errorMsg', '房间不存在或已满');
        }
    });

    socket.on('leaveRoom', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            socket.leave(roomId);
            if (room.host === socket.id) {
                if (room.status === 'playing' && room.guest) {
                    io.to(room.guest).emit('opponentLeft');
                    const guestSocket = io.sockets.sockets.get(room.guest);
                    if(guestSocket) guestSocket.leave(roomId);
                }
                delete rooms[roomId];
            } else if (room.guest === socket.id) {
                io.to(room.host).emit('opponentLeft');
                room.guest = null;
                room.guestName = null;
                room.status = 'waiting';
            }
            io.emit('roomList', getAvailableRooms());
        }
    });

    socket.on('playMove', (data) => {
        const { roomId, r, c, role } = data;
        const room = rooms[roomId];
        if (room && room.status === 'playing') {
            const opponentId = role === 1 ? room.guest : room.host;
            if (opponentId) {
                io.to(opponentId).emit('opponentMoved', { r, c });
            }
        }
    });

    socket.on('undoRequest', (roomId) => {
         const room = rooms[roomId];
         if (room && room.status === 'playing') {
             const opponentId = room.host === socket.id ? room.guest : room.host;
             io.to(opponentId).emit('undoRequested');
         }
    });

    socket.on('undoResponse', (data) => {
         const { roomId, agreed } = data;
         const room = rooms[roomId];
         if (room && room.status === 'playing') {
             const opponentId = room.host === socket.id ? room.guest : room.host;
             io.to(opponentId).emit('undoResult', agreed);
         }
    });
    
    socket.on('drawRequest', (roomId) => {
         const room = rooms[roomId];
         if (room && room.status === 'playing') {
             const opponentId = room.host === socket.id ? room.guest : room.host;
             io.to(opponentId).emit('drawRequested');
         }
    });

    socket.on('drawResponse', (data) => {
         const { roomId, agreed } = data;
         const room = rooms[roomId];
         if (room && room.status === 'playing') {
             const opponentId = room.host === socket.id ? room.guest : room.host;
             io.to(opponentId).emit('drawResult', agreed);
         }
    });
    
    socket.on('rematchRequest', (roomId) => {
         const room = rooms[roomId];
         if (room) {
             const opponentId = room.host === socket.id ? room.guest : room.host;
             if (opponentId) io.to(opponentId).emit('rematchRequested');
         }
    });
    
    socket.on('rematchResponse', (data) => {
         const { roomId, agreed } = data;
         const room = rooms[roomId];
         if (room) {
             const opponentId = room.host === socket.id ? room.guest : room.host;
             if (opponentId) io.to(opponentId).emit('rematchResult', agreed);
         }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
        
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.host === socket.id) {
                if (room.guest) {
                    io.to(room.guest).emit('opponentLeft');
                    const guestSocket = io.sockets.sockets.get(room.guest);
                    if(guestSocket) guestSocket.leave(roomId);
                }
                delete rooms[roomId];
                io.emit('roomList', getAvailableRooms());
            } else if (room.guest === socket.id) {
                if (room.status === 'playing') {
                    io.to(room.host).emit('opponentLeft');
                }
                room.guest = null;
                room.guestName = null;
                room.status = 'waiting';
                io.emit('roomList', getAvailableRooms());
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
