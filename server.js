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
let users = {}; // sessionId -> { name, stats, socketId, roomId, disconnectTimer }
let socketToSession = {}; // socket.id -> sessionId

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
    const { sessionId, nickname, stats } = socket.handshake.query;
    console.log('A user connected:', socket.id, 'Session:', sessionId);

    if (sessionId) {
        if (users[sessionId]) {
            // Reconnection
            console.log('User reconnected:', nickname);
            if (users[sessionId].disconnectTimer) {
                clearTimeout(users[sessionId].disconnectTimer);
                users[sessionId].disconnectTimer = null;
            }
            if (users[sessionId].notifyTimer) {
                clearTimeout(users[sessionId].notifyTimer);
                users[sessionId].notifyTimer = null;
            }
            users[sessionId].socketId = socket.id;
            socketToSession[socket.id] = sessionId;

            const roomId = users[sessionId].roomId;
            if (roomId && rooms[roomId]) {
                const room = rooms[roomId];
                socket.join(roomId);
                
                // Notify others in the room
                socket.to(roomId).emit('opponentReconnected');

                // Send current game state
                socket.emit('gameStart', {
                    roomId: roomId,
                    hostName: users[room.host].name,
                    hostStats: users[room.host].stats,
                    guestName: users[room.guest]?.name,
                    guestStats: users[room.guest]?.stats,
                    size: room.size,
                    forbidden: room.forbidden,
                    hostId: users[room.host].socketId,
                    guestId: room.guest ? users[room.guest].socketId : null,
                    isReconnect: true
                });

                process.nextTick(() => {
                    socket.emit('gameStateUpdate', {
                        board: room.board,
                        history: room.history,
                        turn: room.turn,
                        over: room.over,
                        winner: room.winner
                    });
                });
            } else {
                socket.emit('roomList', getAvailableRooms());
            }
        } else {
            // New connection with sessionId
            users[sessionId] = { 
                name: nickname, 
                stats: stats ? JSON.parse(stats) : {}, 
                socketId: socket.id,
                roomId: null
            };
            socketToSession[socket.id] = sessionId;
            socket.emit('roomList', getAvailableRooms());
        }
    }

    socket.on('setNickname', (data) => {
        const sId = socketToSession[socket.id];
        if (!sId) return;
        
        let name;
        if (typeof data === 'object') {
            name = data.name;
        } else {
            name = data;
        }
        users[sId].name = name;
        socket.emit('roomList', getAvailableRooms());
    });

    socket.on('getRoomList', () => {
        socket.emit('roomList', getAvailableRooms());
    });

    socket.on('createRoom', (settings) => {
        const sId = socketToSession[socket.id];
        if (!users[sId]) return;
        const roomId = generateRoomId();
        const size = parseInt(settings.boardSize) || 15;
        rooms[roomId] = {
            id: roomId,
            host: sId,
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
        users[sId].roomId = roomId;
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        io.emit('roomList', getAvailableRooms());
    });

    socket.on('joinRoom', (roomId) => {
        const sId = socketToSession[socket.id];
        if (!users[sId]) return;
        const room = rooms[roomId];
        if (room && room.status === 'waiting') {
            if (room.host === sId) {
                socket.emit('errorMsg', '不能加入自己创建的房间');
                return;
            }
            room.guest = sId;
            room.status = 'playing';
            users[sId].roomId = roomId;
            socket.join(roomId);
            
            io.to(roomId).emit('gameStart', {
                roomId: roomId,
                hostName: users[room.host].name,
                hostStats: users[room.host].stats,
                guestName: users[room.guest].name,
                guestStats: users[room.guest].stats,
                size: room.size,
                forbidden: room.forbidden,
                hostId: users[room.host].socketId,
                guestId: users[room.guest].socketId
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

        const sId = socketToSession[socket.id];
        const role = sId === room.host ? 1 : 2;
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
            const sId = socketToSession[socket.id];
            const opponentSessionId = room.host === sId ? room.guest : room.host;
            if (opponentSessionId && users[opponentSessionId]) {
                io.to(users[opponentSessionId].socketId).emit('undoRequested');
            }
        }
    });

    socket.on('undoResponse', (data) => {
        const { roomId, agreed } = data;
        const room = rooms[roomId];
        if (room && room.status === 'playing' && agreed) {
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
        const sId = socketToSession[socket.id];
        const opponentSessionId = room.host === sId ? room.guest : room.host;
        if (opponentSessionId && users[opponentSessionId]) {
            io.to(users[opponentSessionId].socketId).emit('undoResult', agreed);
        }
    });

    socket.on('drawRequest', (roomId) => {
        const room = rooms[roomId];
        if (room && room.status === 'playing' && !room.over) {
            const sId = socketToSession[socket.id];
            const opponentSessionId = room.host === sId ? room.guest : room.host;
            if (opponentSessionId && users[opponentSessionId]) {
                io.to(users[opponentSessionId].socketId).emit('drawRequested');
            }
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
        const sId = socketToSession[socket.id];
        const opponentSessionId = room.host === sId ? room.guest : room.host;
        if (opponentSessionId && users[opponentSessionId]) {
            io.to(users[opponentSessionId].socketId).emit('drawResult', agreed);
        }
    });

    socket.on('rematchRequest', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            const sId = socketToSession[socket.id];
            const opponentSessionId = room.host === sId ? room.guest : room.host;
            if (opponentSessionId && users[opponentSessionId]) {
                io.to(users[opponentSessionId].socketId).emit('rematchRequested');
            }
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
                hostId: users[room.host].socketId,
                guestId: users[room.guest].socketId
            });

            io.to(roomId).emit('gameStateUpdate', {
                board: room.board,
                history: room.history,
                turn: room.turn,
                over: room.over,
                winner: room.winner
            });
        }
        const sId = socketToSession[socket.id];
        const opponentSessionId = room.host === sId ? room.guest : room.host;
        if (opponentSessionId && users[opponentSessionId]) {
            io.to(users[opponentSessionId].socketId).emit('rematchResult', agreed);
        }
    });

    socket.on('leaveRoom', (roomId) => {
        const sId = socketToSession[socket.id];
        handleLeaveRoom(sId, roomId);
    });

    socket.on('disconnect', () => {
        const sId = socketToSession[socket.id];
        console.log('User disconnected:', socket.id, 'Session:', sId);
        
        if (sId && users[sId]) {
            // 关键修复：只有当断开的是当前激活的 socket 时，才启动计时器
            if (users[sId].socketId === socket.id) {
                const roomId = users[sId].roomId;
                if (roomId && rooms[roomId]) {
                    const room = rooms[roomId];
                    
                    // Disconnected notification removed as per user request
                    
                    if (room && room.status === 'playing' && !room.over) {
                        // 启动 60s 清理计时器
                        users[sId].disconnectTimer = setTimeout(() => {
                            console.log('Session expired, cleaning up:', sId);
                            handleLeaveRoom(sId, roomId);
                            delete users[sId];
                        }, 60000);
                    } else {
                        console.log('Not playing or game over, leaving immediately:', sId);
                        handleLeaveRoom(sId, roomId);
                        delete users[sId];
                    }
                } else {
                    // 不在房间内，直接删除
                    delete users[sId];
                }
            } else {
                console.log('Old socket disconnected, ignoring timer start for session:', sId);
            }
        }
        delete socketToSession[socket.id];
    });

    function handleLeaveRoom(sId, roomId) {
        const room = rooms[roomId];
        if (!room) return;

        if (users[sId]) {
            const socketId = users[sId].socketId;
            const socket = io.sockets.sockets.get(socketId);
            if (socket) socket.leave(roomId);
            users[sId].roomId = null;
        }

        if (room.host === sId) {
            if (room.guest) {
                const guestUser = users[room.guest];
                if (guestUser) {
                    io.to(guestUser.socketId).emit('opponentLeft', { role: 'host' });
                    guestUser.roomId = null;
                    const guestSocket = io.sockets.sockets.get(guestUser.socketId);
                    if (guestSocket) guestSocket.leave(roomId);
                }
            }
            delete rooms[roomId];
        } else if (room.guest === sId) {
            const hostUser = users[room.host];
            if (hostUser) {
                io.to(hostUser.socketId).emit('opponentLeft', { role: 'guest' });
            }
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
