export class Network {
    constructor(callbacks) {
        this.socket = null;
        this.callbacks = callbacks;
        this.sessionId = this.getOrCreateSessionId();
    }

    getOrCreateSessionId() {
        let id = localStorage.getItem('gomoku_session_id');
        if (!id) {
            id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('gomoku_session_id', id);
        }
        return id;
    }

    connect(nickname, stats) {
        if (!this.socket) {
            this.socket = io({
                query: {
                    sessionId: this.sessionId,
                    nickname: nickname,
                    stats: JSON.stringify(stats)
                },
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            });
            this.setupEvents();
        } else {
            this.socket.emit('setNickname', { name: nickname, stats, sessionId: this.sessionId });
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    setupEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.callbacks.onConnect) this.callbacks.onConnect();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            if (this.callbacks.onDisconnect) this.callbacks.onDisconnect(reason);
        });

        this.socket.on('reconnect_attempt', () => {
            console.log('Attempting to reconnect...');
        });

        this.socket.on('roomList', (rooms) => this.callbacks.onRoomList(rooms));
        this.socket.on('roomCreated', (roomId) => this.callbacks.onRoomCreated(roomId));
        this.socket.on('gameStart', (data) => this.callbacks.onGameStart(data));
        this.socket.on('gameStateUpdate', (state) => this.callbacks.onGameStateUpdate(state));
        this.socket.on('opponentLeft', () => this.callbacks.onOpponentLeft());
        this.socket.on('opponentDisconnected', (data) => {
            if (this.callbacks.onOpponentDisconnected) this.callbacks.onOpponentDisconnected(data);
        });
        this.socket.on('opponentReconnected', () => {
            if (this.callbacks.onOpponentReconnected) this.callbacks.onOpponentReconnected();
        });
        this.socket.on('errorMsg', (msg) => this.callbacks.onErrorMsg(msg));
        this.socket.on('undoRequested', () => this.callbacks.onUndoRequested());
        this.socket.on('undoResult', (agreed) => this.callbacks.onUndoResult(agreed));
        this.socket.on('drawRequested', () => this.callbacks.onDrawRequested());
        this.socket.on('drawResult', (agreed) => this.callbacks.onDrawResult(agreed));
        this.socket.on('rematchRequested', () => this.callbacks.onRematchRequested());
        this.socket.on('rematchResult', (agreed) => this.callbacks.onRematchResult(agreed));
    }

    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }
}
