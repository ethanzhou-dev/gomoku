import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { Network } from './network.js';
import { GameStateManager } from './gameState.js';

export class Game {
    constructor() {
        this.ui = new UI();
        this.settings = this.loadSettings();
        
        this.gameState = new GameStateManager(this.settings.boardSize);
        this.renderer = new Renderer(this.ui.elements.canvasBg, this.ui.elements.canvas, this.settings.boardSize);
        this.network = new Network(this.getNetworkCallbacks());
        
        this.hintPos = null;
        this.isOnline = false;
        this.myRole = null; // 1 or 2
        this.currentRoomId = null;
        
        this.aiWorker = null;
        this.isAILoading = false;
        this.previousState = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.ui.syncModeUI();
        this.startGame();

        // 自动重连逻辑：如果刷新前是在线模式，加载时自动连接网络
        if (this.settings.mode === 'pvp' && this.settings.pvpType === 'online') {
            this.enterOnlineMode();
        }
    }

    getNetworkCallbacks() {
        return {
            onRoomList: (rooms) => this.ui.renderRoomList(rooms, (id) => this.network.emit('joinRoom', id)),
            onRoomCreated: (roomId) => {
                this.currentRoomId = roomId;
                this.ui.hideModal('modalRoomList');
                this.ui.showModal('modalWaiting');
                this.ui.elements.waitingRoomIdSpan.innerText = roomId;
            },
            onGameStart: (data) => {
                this.ui.hideModal('modalWaiting');
                this.ui.hideModal('modalRoomList');
                this.currentRoomId = data.roomId;
                this.myRole = (this.network.socket.id === data.hostId) ? 1 : 2;
                this.settings.boardSize = data.size;
                this.settings.forbidden = data.forbidden;
                this.ui.elements.chkForbidden.checked = data.forbidden;
                
                this.startGame(true);
                if (!data.isReconnect) {
                    this.ui.showAlert('对战开始！你是' + (this.myRole === 1 ? '黑子' : '白子'));
                } else {
                    this.ui.updateStatus('已重连回游戏', "#27ae60");
                }
            },
            onGameStateUpdate: (state) => {
                const isMyMove = state.lastMove && state.lastMove.role === this.myRole;
                const wasOver = this.gameState.over;
                
                this.previousState = null; // Clear optimistic state
                this.gameState.setState(state);
                
                // Only animate if it's the opponent's move
                if (state.lastMove && !isMyMove) {
                    this.renderer.animateMove(state.lastMove.r, state.lastMove.c, state.lastMove.role);
                }
                
                if (this.gameState.over) {
                    if (!wasOver) {
                        this.handleGameOver(this.gameState.winner);
                    }
                } else {
                    this.updateStatus();
                }
                this.drawBoard();
            },
            onOpponentLeft: () => {
                this.ui.showAlert('对手已离开房间，正在返回大厅...');
                this.backToLobby();
            },
            onOpponentDisconnected: (data) => {
                // Logic removed as per user request
            },
            onOpponentReconnected: () => {
                this.ui.showAlert('对方已重连！');
                this.ui.updateStatus('对方已重连', "#2e7d32"); // Forest Green, more skeuomorphic
                setTimeout(() => this.updateStatus(), 2000);
            },
            onErrorMsg: (msg) => {
                this.ui.showAlert(msg);
                
                // Rollback optimistic state if a move error occurred
                if (this.previousState && (msg.includes('禁手') || msg.includes('不符合规则') || msg.includes('不是你的回合'))) {
                    this.gameState.setState(this.previousState);
                    this.previousState = null;
                    this.drawBoard();
                    this.updateStatus();
                }

                // 如果是加入失败等错误，确保回到列表
                if (msg.includes('不存在') || msg.includes('已满')) {
                    this.backToLobby();
                }
            },
            onUndoRequested: () => {
                if (confirm("对方请求悔棋，是否同意？")) {
                    this.network.emit('undoResponse', { roomId: this.currentRoomId, agreed: true });
                } else {
                    this.network.emit('undoResponse', { roomId: this.currentRoomId, agreed: false });
                }
            },
            onUndoResult: (agreed) => {
                if (agreed) this.ui.showAlert('对方同意悔棋！');
                else this.ui.showAlert('对方拒绝了您的悔棋请求。');
            },
            onDrawRequested: () => {
                if (confirm("对方请求和棋，是否同意？")) {
                    this.network.emit('drawResponse', { roomId: this.currentRoomId, agreed: true });
                } else {
                    this.network.emit('drawResponse', { roomId: this.currentRoomId, agreed: false });
                }
            },
            onDrawResult: (agreed) => {
                if (agreed) this.ui.showAlert('对方同意和棋！');
                else this.ui.showAlert('对方拒绝了您的和棋请求。');
            },
            onRematchRequested: () => {
                if (confirm("对方请求再来一局，是否同意？")) {
                    this.network.emit('rematchResponse', { roomId: this.currentRoomId, agreed: true });
                } else {
                    this.network.emit('rematchResponse', { roomId: this.currentRoomId, agreed: false });
                }
            },
            onRematchResult: (agreed) => {
                if (!agreed) this.ui.showAlert('对方拒绝了再来一局的请求。');
            }
        };
    }

    setupEventListeners() {
        this.ui.elements.canvas.onclick = (e) => this.handleCanvasClick(e);
        this.ui.elements.btnRestart.onclick = () => this.handleRestart();
        this.ui.elements.btnUndo.onclick = () => this.handleUndo();
        this.ui.elements.btnHint.onclick = () => this.handleHint();
        this.ui.elements.btnSettings.onclick = () => this.openSettings();
        this.ui.elements.btnCloseSettings.onclick = () => this.closeSettings();
        this.ui.elements.btnHome.onclick = () => this.leaveOnlineGame();

        this.ui.elements.modeRadios.forEach(radio => {
            radio.onchange = () => this.ui.syncModeUI();
        });
        
        // Online UI
        this.ui.elements.btnSaveNickname.onclick = () => this.saveNickname();
        this.ui.elements.btnCancelNickname.onclick = () => this.ui.hideModal('modalNickname');
        this.ui.elements.btnCreateRoom.onclick = () => this.createRoom();
        this.ui.elements.btnRefreshRooms.onclick = () => this.network.emit('getRoomList');
        this.ui.elements.btnLeaveRooms.onclick = () => this.leaveOnlineGame();
        this.ui.elements.btnLeaveWaiting.onclick = () => this.leaveOnlineGame();
        this.ui.elements.btnAlertOk.onclick = () => this.ui.hideAlert();
        
        window.addEventListener('resize', () => {
            this.renderer.forceRedraw();
            this.drawBoard();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // 延迟一下，确保浏览器完成切回应用的布局和资源恢复
                setTimeout(() => {
                    this.renderer.forceRedraw();
                    this.drawBoard();
                }, 100);
            }
        });

        // 监听 canvas 上下文丢失和恢复事件
        const handleContextRestored = () => {
            console.log('Canvas context restored');
            this.renderer.forceRedraw();
            this.drawBoard();
        };
        
        this.ui.elements.canvas.addEventListener('webglcontextrestored', handleContextRestored);
        this.ui.elements.canvasBg.addEventListener('webglcontextrestored', handleContextRestored);
        // 对于 2D context
        this.ui.elements.canvas.addEventListener('contextrestored', handleContextRestored);
        this.ui.elements.canvasBg.addEventListener('contextrestored', handleContextRestored);
    }

    loadSettings() {
        const defaults = {
            playerColor: 1,
            forbidden: false,
            boardSize: 15,
            mode: 'pve',
            difficulty: 4,
            pvpType: 'local'
        };
        const saved = localStorage.getItem('gomoku_settings');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    saveSettings() {
        localStorage.setItem('gomoku_settings', JSON.stringify(this.settings));
    }

    openSettings() {
        this.ui.setSettings(this.settings);
        this.ui.showModal('modalSettings');
    }

    closeSettings() {
        const newSettings = this.ui.getSettings();
        const modeChanged = this.settings.mode !== newSettings.mode;
        const typeChanged = this.settings.pvpType !== newSettings.pvpType;
        const sizeChanged = this.settings.boardSize !== newSettings.boardSize;
        const colorChanged = this.settings.playerColor !== newSettings.playerColor;
        const forbiddenChanged = this.settings.forbidden !== newSettings.forbidden;
        const diffChanged = this.settings.difficulty !== newSettings.difficulty;

        this.settings = newSettings;
        this.saveSettings();
        this.ui.hideModal('modalSettings');
        
        if (this.settings.mode === 'pvp' && this.settings.pvpType === 'online') {
            if (!this.isOnline || modeChanged || typeChanged) {
                this.enterOnlineMode();
            }
        } else {
            if (modeChanged || typeChanged || sizeChanged || colorChanged || forbiddenChanged || (this.settings.mode === 'pve' && diffChanged)) {
                this.isOnline = false;
                this.network.disconnect();
                this.startGame();
            }
        }
    }

    drawBoard() {
        this.renderer.drawBoard(this.gameState.board, this.gameState.historyMoves, this.hintPos, this.gameState.me);
    }

    startGame(isOnline = false) {
        this.isOnline = isOnline;
        this.gameState.init(this.settings.boardSize);
        this.renderer.setBoardSize(this.settings.boardSize);
        this.hintPos = null;
        
        this.ui.elements.btnRestart.style.display = 'inline-block';
        this.ui.elements.btnUndo.style.display = 'inline-block';
        this.ui.elements.btnHint.style.display = 'inline-block';
        this.ui.elements.btnSettings.style.display = this.isOnline ? 'none' : 'inline-block';
        this.ui.elements.btnHome.style.display = 'none';

        if (!this.isOnline) {
            this.ui.elements.btnRestart.innerText = "重新开始";
            this.ui.elements.btnHint.innerText = "提示";
        } else {
            this.ui.elements.btnRestart.innerText = "退出房间";
            this.ui.elements.btnHint.innerText = "和棋";
        }

        this.updateStatus();
        this.drawBoard();

        if (this.settings.mode === 'pve' && this.settings.playerColor === 2) {
            this.triggerAI();
        }
    }

    handleCanvasClick(e) {
        if (this.gameState.over || this.isAILoading) return;
        
        const rect = this.ui.elements.canvas.getBoundingClientRect();
        const scaleX = this.ui.elements.canvas.width / rect.width / (window.devicePixelRatio || 1);
        const scaleY = this.ui.elements.canvas.height / rect.height / (window.devicePixelRatio || 1);
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const i = Math.round((x - this.renderer.margin) / this.renderer.cellSize);
        const j = Math.round((y - this.renderer.margin) / this.renderer.cellSize);

        if (i >= 0 && i < this.settings.boardSize && j >= 0 && j < this.settings.boardSize && this.gameState.board[i][j] === 0) {
            if (this.isOnline) {
                const currentRole = this.gameState.me ? 1 : 2;
                if (currentRole === this.myRole) {
                    this.previousState = this.gameState.cloneState();
                    
                    if (currentRole === 1 && this.settings.forbidden) {
                        const msg = GomokuRules.checkForbidden(this.gameState.board, i, j, this.settings.boardSize);
                        if (msg) {
                            this.ui.updateStatus(`禁手：${msg}`, "#c0392b");
                            this.previousState = null;
                            return;
                        }
                    }

                    this.executeMove(i, j);
                    this.network.emit('requestMove', { roomId: this.currentRoomId, r: i, c: j });
                }
            } else {
                if (this.gameState.me && this.settings.forbidden) {
                    const msg = GomokuRules.checkForbidden(this.gameState.board, i, j, this.settings.boardSize);
                    if (msg) {
                        this.ui.updateStatus(`禁手：${msg}`, "#c0392b");
                        return;
                    }
                }
                this.executeMove(i, j);
            }
        }
    }

    executeMove(i, j) {
        const role = this.gameState.executeMove(i, j);
        this.renderer.animateMove(i, j, role);
        this.hintPos = null;

        if (GomokuRules.checkWin(this.gameState.board, i, j, role, this.settings.boardSize)) {
            this.gameState.over = true;
            this.gameState.winner = role;
            this.handleGameOver(role);
        } else if (this.gameState.historyMoves.length === this.settings.boardSize * this.settings.boardSize) {
            this.gameState.over = true;
            this.gameState.winner = 0;
            this.handleGameOver(0);
        } else {
            this.updateStatus();
            if (this.settings.mode === 'pve' && !this.gameState.over) {
                const nextRole = this.gameState.me ? 1 : 2;
                if (nextRole !== this.settings.playerColor) {
                    this.triggerAI();
                }
            }
        }
        this.drawBoard();
    }

    triggerAI(isHint = false) {
        this.isAILoading = true;
        this.ui.updateStatus(isHint ? "获取提示中..." : "AI思考中...");
        
        const startTime = Date.now();
        const minDelay = 500; 

        if (!this.aiWorker) {
            this.aiWorker = new Worker('ai-worker.js');
            this.aiWorker.onmessage = this.handleAIMessage.bind(this, startTime, minDelay);
        } else {
            this.aiWorker.onmessage = this.handleAIMessage.bind(this, startTime, minDelay);
        }

        this.aiWorker.postMessage({
            board: this.gameState.board,
            depth: this.settings.difficulty,
            aiRole: this.gameState.me ? 1 : 2,
            forbidden: this.settings.forbidden,
            isHint: isHint
        });
    }

    handleAIMessage(startTime, minDelay, e) {
        const timeTaken = Date.now() - startTime;
        const remainingDelay = Math.max(0, minDelay - timeTaken);

        setTimeout(() => {
            this.isAILoading = false;
            if (e.data.isHint) {
                this.hintPos = { x: e.data.r, y: e.data.c, start: performance.now() };
                this.drawBoard();
            } else {
                this.executeMove(e.data.r, e.data.c);
            }
            this.updateStatus();
        }, remainingDelay);
    }

    handleRestart() {
        if (this.isOnline) {
            if (this.gameState.over) {
                this.network.emit('rematchRequest', this.currentRoomId);
            } else if (confirm("确定要退出房间吗？")) {
                this.backToLobby();
            }
        } else {
            this.startGame();
        }
    }

    backToLobby() {
        this.network.emit('leaveRoom', this.currentRoomId);
        this.currentRoomId = null;
        this.isOnline = true;
        this.ui.hideModal('modalWaiting');
        this.ui.showModal('modalRoomList');
        this.network.emit('getRoomList');
        this.startGame(true); 
    }

    handleUndo() {
        if (this.isOnline) {
            this.network.emit('undoRequest', this.currentRoomId);
        } else {
            if (this.gameState.historyMoves.length === 0 || this.isAILoading) return;
            this.gameState.undoMove();
            if (this.settings.mode === 'pve' && this.gameState.historyMoves.length > 0) {
                this.gameState.undoMove();
            }
            this.updateStatus();
            this.drawBoard();
        }
    }

    handleHint() {
        if (this.isOnline) {
            this.network.emit('drawRequest', this.currentRoomId);
        } else {
            if (this.gameState.over || this.isAILoading || this.gameState.historyMoves.length === 0) return;
            this.triggerAI(true);
        }
    }

    updateStatus() {
        if (this.gameState.over) return;
        const colorStr = this.gameState.me ? '黑子' : '白子';
        let text = "";
        if (this.isOnline) {
            const isMyTurn = (this.gameState.me ? 1 : 2) === this.myRole;
            text = `轮到 ${isMyTurn ? '你' : '对方'} (${colorStr})`;
        } else if (this.settings.mode === 'pve') {
            const isMyTurn = (this.gameState.me ? 1 : 2) === this.settings.playerColor;
            text = `轮到 ${isMyTurn ? '你' : 'AI'} (${colorStr})`;
        } else {
            text = `轮到 ${colorStr}`;
        }
        this.ui.updateStatus(text, this.gameState.me ? "#2c3e50" : "#c0392b");
    }

    handleGameOver(winner) {
        let msg = "";
        if (winner === 0) msg = "平局！";
        else {
            const color = winner === 1 ? "黑子" : "白子";
            if (this.isOnline) {
                msg = winner === this.myRole ? "你赢了！" : "你输了！";
            } else {
                msg = color + " 胜利！";
            }
        }
        this.ui.updateStatus(msg, "#c0392b");
        this.ui.showAlert(msg);
        
        if (this.isOnline) {
            this.ui.elements.btnRestart.innerText = "再来一局";
            this.ui.elements.btnUndo.style.display = 'none'; 
            this.ui.elements.btnHint.style.display = 'none'; 
            this.ui.elements.btnHome.style.display = 'inline-block'; 
            this.ui.elements.btnSettings.style.display = 'none'; 
        }
    }

    enterOnlineMode() {
        const nickname = localStorage.getItem('gomoku_nickname');
        if (!nickname) this.ui.showModal('modalNickname');
        else {
            this.network.connect(nickname, { total: 0, win: 0 });
            this.ui.elements.currentNicknameSpan.innerText = nickname;
            this.ui.showModal('modalRoomList');
        }
    }

    saveNickname() {
        const name = this.ui.elements.nicknameInput.value.trim();
        if (!name || !/^[a-zA-Z0-9]+$/.test(name)) return this.ui.showAlert('昵称不合法');
        localStorage.setItem('gomoku_nickname', name);
        this.ui.hideModal('modalNickname');
        this.enterOnlineMode();
    }

    createRoom() {
        this.network.emit('createRoom', {
            boardSize: this.settings.boardSize,
            forbidden: this.settings.forbidden
        });
    }

    leaveOnlineGame() {
        if (this.aiWorker) {
            this.aiWorker.terminate();
            this.aiWorker = null;
            this.isAILoading = false;
        }
        this.network.emit('leaveRoom', this.currentRoomId);
        this.network.disconnect();
        this.isOnline = false;
        this.settings.mode = 'pve';
        this.settings.pvpType = 'local';
        this.saveSettings();
        this.ui.hideModal('modalRoomList');
        this.ui.hideModal('modalWaiting');
        this.startGame();
    }
}
