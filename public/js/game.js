import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { Network } from './network.js';

export class Game {
    constructor() {
        this.ui = new UI();
        this.renderer = new Renderer(this.ui.elements.canvas, 15);
        this.network = new Network(this.getNetworkCallbacks());
        
        this.board = [];
        this.historyMoves = [];
        this.me = true; // Whose turn (local or logic)
        this.over = false;
        this.hintPos = null;
        this.isOnline = false;
        this.myRole = null; // 1 or 2
        this.currentRoomId = null;
        this.settings = this.loadSettings();
        
        this.aiWorker = null;
        this.isAILoading = false;
        this.previousState = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.ui.syncModeUI();
        this.startGame();
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
                this.renderer.setBoardSize(data.size);
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
                const wasOver = this.over;
                
                this.previousState = null; // Clear optimistic state
                this.board = state.board;
                // Convert history format if needed (server sends {r, c, role}, client uses {x, y, role})
                this.historyMoves = state.history.map(m => ({ x: m.r, y: m.c, role: m.role }));
                this.me = (state.turn === 1);
                this.over = state.over;
                
                // Only animate if it's the opponent's move
                if (state.lastMove && !isMyMove) {
                    this.renderer.animateMove(state.lastMove.r, state.lastMove.c, state.lastMove.role);
                }
                
                if (this.over) {
                    if (!wasOver) {
                        this.handleGameOver(state.winner);
                    }
                } else {
                    this.updateStatus();
                }
                this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me);
            },
            onOpponentLeft: () => {
                this.ui.showAlert('对手已离开房间，正在返回大厅...');
                this.backToLobby();
            },
            onOpponentDisconnected: (data) => {
                this.ui.updateStatus(`对方已断开，等待重连 (${data.timeout}s)...`, "#f39c12");
            },
            onOpponentReconnected: () => {
                this.ui.updateStatus('对方已重连', "#27ae60");
                setTimeout(() => this.updateStatus(), 2000);
            },
            onErrorMsg: (msg) => {
                this.ui.showAlert(msg);
                
                // Rollback optimistic state if a move error occurred
                if (this.previousState && (msg.includes('禁手') || msg.includes('不符合规则') || msg.includes('不是你的回合'))) {
                    this.board = this.previousState.board;
                    this.historyMoves = this.previousState.historyMoves;
                    this.me = this.previousState.me;
                    this.over = this.previousState.over;
                    this.previousState = null;
                    this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me);
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
        
        window.addEventListener('resize', () => this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me));
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
        // 简单对比是否发生实质变化
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
            // 如果切到了联网模式，且当前并不是在联网状态（或者就是想刷出房间列表）
            if (!this.isOnline || modeChanged || typeChanged) {
                this.enterOnlineMode();
            }
        } else {
            // 如果是 PVE 或 本地 PVP
            if (modeChanged || typeChanged || sizeChanged || colorChanged || forbiddenChanged || (this.settings.mode === 'pve' && diffChanged)) {
                this.isOnline = false;
                this.network.disconnect();
                this.startGame();
            }
        }
    }

    startGame(isOnline = false) {
        this.isOnline = isOnline;
        this.over = false;
        this.board = [];
        for (let i = 0; i < this.settings.boardSize; i++) {
            this.board[i] = new Array(this.settings.boardSize).fill(0);
        }
        this.historyMoves = [];
        this.me = true;
        this.hintPos = null;
        this.renderer.setBoardSize(this.settings.boardSize);
        
        // 重置所有按钮显示状态
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
        this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me);

        if (this.settings.mode === 'pve' && this.settings.playerColor === 2) {
            this.triggerAI();
        }
    }

    handleCanvasClick(e) {
        if (this.over || this.isAILoading) return;
        
        const rect = this.ui.elements.canvas.getBoundingClientRect();
        const scaleX = this.ui.elements.canvas.width / rect.width / (window.devicePixelRatio || 1);
        const scaleY = this.ui.elements.canvas.height / rect.height / (window.devicePixelRatio || 1);
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const i = Math.round((x - this.renderer.margin) / this.renderer.cellSize);
        const j = Math.round((y - this.renderer.margin) / this.renderer.cellSize);

        if (i >= 0 && i < this.settings.boardSize && j >= 0 && j < this.settings.boardSize && this.board[i][j] === 0) {
            if (this.isOnline) {
                const currentRole = this.me ? 1 : 2;
                if (currentRole === this.myRole) {
                    // Optimistic update: Save state for rollback
                    this.previousState = {
                        board: JSON.parse(JSON.stringify(this.board)),
                        historyMoves: [...this.historyMoves],
                        me: this.me,
                        over: this.over
                    };
                    
                    // Local forbidden check for immediate feedback
                    if (currentRole === 1 && this.settings.forbidden) {
                        const msg = GomokuRules.checkForbidden(this.board, i, j, this.settings.boardSize);
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
                // Local or PvE move
                if (this.me && this.settings.forbidden) {
                    const msg = GomokuRules.checkForbidden(this.board, i, j, this.settings.boardSize);
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
        const role = this.me ? 1 : 2;
        this.board[i][j] = role;
        this.historyMoves.push({ x: i, y: j, role });
        this.renderer.animateMove(i, j, role);
        this.hintPos = null;

        if (GomokuRules.checkWin(this.board, i, j, role, this.settings.boardSize)) {
            this.over = true;
            this.handleGameOver(role);
        } else if (this.historyMoves.length === this.settings.boardSize * this.settings.boardSize) {
            this.over = true;
            this.handleGameOver(0);
        } else {
            this.me = !this.me;
            this.updateStatus();
            if (this.settings.mode === 'pve' && !this.over) {
                const nextRole = this.me ? 1 : 2;
                if (nextRole !== this.settings.playerColor) {
                    this.triggerAI();
                }
            }
        }
        this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me);
    }

    triggerAI(isHint = false) {
        this.isAILoading = true;
        this.ui.updateStatus(isHint ? "获取提示中..." : "AI思考中...");
        
        const startTime = Date.now();
        const minDelay = 500; // 500ms minimum delay

        if (!this.aiWorker) {
            this.aiWorker = new Worker('ai-worker.js');
            this.aiWorker.onmessage = (e) => {
                const timeTaken = Date.now() - startTime;
                const remainingDelay = Math.max(0, minDelay - timeTaken);

                setTimeout(() => {
                    this.isAILoading = false;
                    if (e.data.isHint) {
                        this.hintPos = { x: e.data.r, y: e.data.c, start: performance.now() };
                        this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me);
                    } else {
                        this.executeMove(e.data.r, e.data.c);
                    }
                    this.updateStatus();
                }, remainingDelay);
            };
        } else {
            // Re-bind onmessage to use current startTime if worker already exists
            this.aiWorker.onmessage = (e) => {
                const timeTaken = Date.now() - startTime;
                const remainingDelay = Math.max(0, minDelay - timeTaken);

                setTimeout(() => {
                    this.isAILoading = false;
                    if (e.data.isHint) {
                        this.hintPos = { x: e.data.r, y: e.data.c, start: performance.now() };
                        this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me);
                    } else {
                        this.executeMove(e.data.r, e.data.c);
                    }
                    this.updateStatus();
                }, remainingDelay);
            };
        }

        this.aiWorker.postMessage({
            board: this.board,
            depth: this.settings.difficulty,
            aiRole: this.me ? 1 : 2,
            forbidden: this.settings.forbidden,
            isHint: isHint
        });
    }

    handleRestart() {
        if (this.isOnline) {
            // 如果游戏已经结束，且对手可能已经离开了，则跳转回大厅
            // 或者通过 UI 状态判断：如果按钮文字是“再来一局”，发送重连请求
            if (this.over) {
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
        this.isOnline = true; // 保持在线模式
        this.ui.hideModal('modalWaiting');
        this.ui.showModal('modalRoomList');
        this.network.emit('getRoomList');
        this.startGame(true); // 重置棋盘但保持联网 UI 状态
    }

    handleUndo() {
        if (this.isOnline) {
            this.network.emit('undoRequest', this.currentRoomId);
        } else {
            if (this.historyMoves.length === 0 || this.isAILoading) return;
            this.over = false;
            let last = this.historyMoves.pop();
            this.board[last.x][last.y] = 0;
            if (this.settings.mode === 'pve' && this.historyMoves.length > 0) {
                last = this.historyMoves.pop();
                this.board[last.x][last.y] = 0;
            }
            this.me = (this.historyMoves.length % 2 === 0);
            this.updateStatus();
            this.renderer.drawBoard(this.board, this.historyMoves, this.hintPos, this.me);
        }
    }

    handleHint() {
        if (this.isOnline) {
            this.network.emit('drawRequest', this.currentRoomId);
        } else {
            if (this.over || this.isAILoading) return;
            this.triggerAI(true);
        }
    }

    updateStatus() {
        if (this.over) return;
        const colorStr = this.me ? '黑子' : '白子';
        let text = "";
        if (this.isOnline) {
            const isMyTurn = (this.me ? 1 : 2) === this.myRole;
            text = `轮到 ${isMyTurn ? '你' : '对方'} (${colorStr})`;
        } else if (this.settings.mode === 'pve') {
            const isMyTurn = (this.me ? 1 : 2) === this.settings.playerColor;
            text = `轮到 ${isMyTurn ? '你' : 'AI'} (${colorStr})`;
        } else {
            text = `轮到 ${colorStr}`;
        }
        this.ui.updateStatus(text, this.me ? "#2c3e50" : "#c0392b");
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
            this.ui.elements.btnUndo.style.display = 'none'; // 隐藏悔棋
            this.ui.elements.btnHint.style.display = 'none'; // 隐藏和棋
            this.ui.elements.btnHome.style.display = 'inline-block'; // 显示返回首页
            this.ui.elements.btnSettings.style.display = 'none'; // 隐藏设置
        }
    }

    enterOnlineMode() {
        const nickname = localStorage.getItem('gomoku_nickname');
        if (!nickname) this.ui.showModal('modalNickname');
        else {
            this.network.connect(nickname, { total: 0, win: 0 }); // Fetch actual stats later if needed
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
