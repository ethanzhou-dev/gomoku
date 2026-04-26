export class Network {
    constructor(callbacks) {
        this.socket = null;
        this.callbacks = callbacks;
    }

    connect(nickname, stats) {
        if (!this.socket) {
            this.socket = io();
            this.setupEvents();
        }
        this.socket.emit('setNickname', { name: nickname, stats });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    setupEvents() {
        this.socket.on('roomList', (rooms) => this.callbacks.onRoomList(rooms));
        this.socket.on('roomCreated', (roomId) => this.callbacks.onRoomCreated(roomId));
        this.socket.on('gameStart', (data) => this.callbacks.onGameStart(data));
        this.socket.on('gameStateUpdate', (state) => this.callbacks.onGameStateUpdate(state));
        this.socket.on('opponentLeft', () => this.callbacks.onOpponentLeft());
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
