const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { checkForbidden, checkWin } = require('./public/rules.js');

const app = express();
app.use(compression());
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {}; // roomId -> { id, host, guest, size, forbidden, status, board, history, turn, over }
let users = {}; // socket.id -> { name, stats }

function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function getAvailableRooms() {
    return Object.values(rooms).filter(r => r.status === 'waiting').map(r => ({
        id: r.id,
        hostName: users[r.host]?.name || 'Unknown',
        size: r.size,
        forbidden: r.forbidden
    }));
}

function initGameBoard(size) {
    let board = [];
    for (let i = 0; i < size; i++) {
        board[i] = new Array(size).fill(0);
    }
    return board;
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('setNickname', (data) => {
        let name;
        if (typeof data === 'object') {
            name = data.name;
        } else {
            name = data;
        }
        users[socket.id] = { name };
        socket.emit('roomList', getAvailableRooms());
    });

    socket.on('getRoomList', () => {
        socket.emit('roomList', getAvailableRooms());
    });

    socket.on('createRoom', (settings) => {
        if (!users[socket.id]) return;
        const roomId = generateRoomId();
        const size = parseInt(settings.boardSize) || 15;
        rooms[roomId] = {
            id: roomId,
            host: socket.id,
            guest: null,
            size: size,
            forbidden: settings.forbidden,
            status: 'waiting',
            board: initGameBoard(size),
            history: [],
            turn: 1, // 1 for black (host), 2 for white (guest)
            over: false,
            winner: null
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
            room.status = 'playing';
            socket.join(roomId);
            
            io.to(roomId).emit('gameStart', {
                roomId: roomId,
                hostName: users[room.host].name,
                hostStats: users[room.host].stats,
                guestName: users[room.guest].name,
                guestStats: users[room.guest].stats,
                size: room.size,
                forbidden: room.forbidden,
                hostId: room.host,
                guestId: room.guest
            });
            
            io.emit('roomList', getAvailableRooms());
            // Sync initial state
            io.to(roomId).emit('gameStateUpdate', {
                board: room.board,
                history: room.history,
                turn: room.turn,
                over: room.over,
                winner: room.winner
            });
        } else {
            socket.emit('errorMsg', '房间不存在或已满');
        }
    });

    socket.on('requestMove', (data) => {
        const { roomId, r, c } = data;
        const room = rooms[roomId];
        if (!room || room.status !== 'playing' || room.over) return;

        const role = socket.id === room.host ? 1 : 2;
        if (room.turn !== role) return;

        // Validation
        if (r < 0 || r >= room.size || c < 0 || c >= room.size || room.board[r][c] !== 0) return;

        if (role === 1 && room.forbidden) {
            const forbiddenMsg = checkForbidden(room.board, r, c, room.size);
            if (forbiddenMsg) {
                socket.emit('errorMsg', `禁手：${forbiddenMsg}`);
                return;
            }
        }

        // Execute Move
        room.board[r][c] = role;
        room.history.push({ r, c, role });
        
        if (checkWin(room.board, r, c, role, room.size)) {
            room.over = true;
            room.winner = role;
        } else if (room.history.length === room.size * room.size) {
            room.over = true;
            room.winner = 0; // Draw
        } else {
            room.turn = role === 1 ? 2 : 1;
        }

        io.to(roomId).emit('gameStateUpdate', {
            board: room.board,
            history: room.history,
            turn: room.turn,
            over: room.over,
            winner: room.winner,
            lastMove: { r, c, role }
        });
    });

    socket.on('undoRequest', (roomId) => {
        const room = rooms[roomId];
        if (room && room.status === 'playing' && !room.over) {
            const opponentId = room.host === socket.id ? room.guest : room.host;
            if (opponentId) io.to(opponentId).emit('undoRequested');
        }
    });

    socket.on('undoResponse', (data) => {
        const { roomId, agreed } = data;
        const room = rooms[roomId];
        if (room && room.status === 'playing' && agreed) {
            // Undo logic: pop until it's the requester's turn again (usually 2 moves in PvE, but here we just pop 1 or 2 depending on who asked)
            // Actually in PvP, usually you undo the LAST move, so the turn reverts.
            if (room.history.length > 0) {
                const lastMove = room.history.pop();
                room.board[lastMove.r][lastMove.c] = 0;
                room.turn = lastMove.role;
                room.over = false;
                room.winner = null;
                
                io.to(roomId).emit('gameStateUpdate', {
                    board: room.board,
                    history: room.history,
                    turn: room.turn,
                    over: room.over,
                    winner: room.winner
                });
            }
        }
        const opponentId = room.host === socket.id ? room.guest : room.host;
        if (opponentId) io.to(opponentId).emit('undoResult', agreed);
    });

    socket.on('drawRequest', (roomId) => {
        const room = rooms[roomId];
        if (room && room.status === 'playing' && !room.over) {
            const opponentId = room.host === socket.id ? room.guest : room.host;
            if (opponentId) io.to(opponentId).emit('drawRequested');
        }
    });

    socket.on('drawResponse', (data) => {
        const { roomId, agreed } = data;
        const room = rooms[roomId];
        if (room && room.status === 'playing' && agreed) {
            room.over = true;
            room.winner = 0;
            io.to(roomId).emit('gameStateUpdate', {
                board: room.board,
                history: room.history,
                turn: room.turn,
                over: room.over,
                winner: 0
            });
        }
        const opponentId = room.host === socket.id ? room.guest : room.host;
        if (opponentId) io.to(opponentId).emit('drawResult', agreed);
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
        if (room && agreed) {
            room.board = initGameBoard(room.size);
            room.history = [];
            room.turn = 1;
            room.over = false;
            room.winner = null;
            
            // Swap roles for rematch
            const oldHost = room.host;
            room.host = room.guest;
            room.guest = oldHost;

            io.to(roomId).emit('gameStart', {
                roomId: roomId,
                hostName: users[room.host].name,
                hostStats: users[room.host].stats,
                guestName: users[room.guest].name,
                guestStats: users[room.guest].stats,
                size: room.size,
                forbidden: room.forbidden,
                hostId: room.host,
                guestId: room.guest
            });

            io.to(roomId).emit('gameStateUpdate', {
                board: room.board,
                history: room.history,
                turn: room.turn,
                over: room.over,
                winner: room.winner
            });
        }
        const opponentId = room.host === socket.id ? room.guest : room.host;
        if (opponentId) io.to(opponentId).emit('rematchResult', agreed);
    });

    socket.on('leaveRoom', (roomId) => {
        handleLeaveRoom(socket, roomId);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const roomId in rooms) {
            if (rooms[roomId].host === socket.id || rooms[roomId].guest === socket.id) {
                handleLeaveRoom(socket, roomId);
            }
        }
        delete users[socket.id];
    });

    function handleLeaveRoom(socket, roomId) {
        const room = rooms[roomId];
        if (!room) return;

        socket.leave(roomId);
        if (room.host === socket.id) {
            if (room.guest) {
                io.to(room.guest).emit('opponentLeft');
                // Don't leave room yet, let guest decide? No, usually room closes if host leaves.
            }
            delete rooms[roomId];
        } else if (room.guest === socket.id) {
            io.to(room.host).emit('opponentLeft');
            room.guest = null;
            room.status = 'waiting';
            room.board = initGameBoard(room.size);
            room.history = [];
            room.turn = 1;
            room.over = false;
        }
        io.emit('roomList', getAvailableRooms());
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
