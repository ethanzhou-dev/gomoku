
let socket = null;
let currentRoomId = null;
let myRole = null; // 1 (black) or 2 (white)
let isOnline = false;
let playerColor = 1;

// DOM Elements
const pvpTypeSelector = document.getElementById('pvp-type-selector');
const pvpTypeRadios = document.getElementsByName('pvpType');
const modalNickname = document.getElementById('nickname-modal');
const nicknameInput = document.getElementById('nickname-input');
const btnSaveNickname = document.getElementById('btn-save-nickname');
const btnCancelNickname = document.getElementById('btn-cancel-nickname');
const modalRoomList = document.getElementById('room-list-modal');
const roomListContainer = document.getElementById('room-list-container');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
const btnLeaveRooms = document.getElementById('btn-leave-rooms');
const currentNicknameSpan = document.getElementById('current-nickname');
const btnChangeNickname = document.getElementById('btn-change-nickname');
const modalWaiting = document.getElementById('waiting-modal');
const waitingRoomIdSpan = document.getElementById('waiting-room-id');
const btnLeaveWaiting = document.getElementById('btn-leave-waiting');
const modalAlert = document.getElementById('alert-modal');
const alertMsg = document.getElementById('alert-msg');
const btnAlertOk = document.getElementById('btn-alert-ok');
const alertTitle = document.getElementById('alert-title');
const opponentInfo = document.getElementById('opponent-info');
const opponentNameElem = document.getElementById('opponent-name');
const opponentStatsElem = document.getElementById('opponent-stats');
const myInfo = document.getElementById('my-info');
const myNameElem = document.getElementById('my-name');
const myStatsElem = document.getElementById('my-stats');

function updateMyStats(isWin, isDraw) {
    let statsStr = localStorage.getItem('gomoku_stats');
    let stats = statsStr ? JSON.parse(statsStr) : { total: 0, win: 0 };
    if (!isDraw) {
        stats.total += 1;
        if (isWin) stats.win += 1;
    }
    localStorage.setItem('gomoku_stats', JSON.stringify(stats));
    return stats;
}

function getMyStats() {
    let statsStr = localStorage.getItem('gomoku_stats');
    return statsStr ? JSON.parse(statsStr) : { total: 0, win: 0 };
}


function showAlert(msg, title = "提示") {
    if(alertTitle) alertTitle.innerText = title;
    if(alertMsg) alertMsg.innerText = msg;
    if(modalAlert) modalAlert.style.display = 'flex';
}
if(btnAlertOk) btnAlertOk.onclick = () => modalAlert.style.display = 'none';






const canvas = document.getElementById('chessBoard');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const btnHint = document.getElementById('btn-hint');
const btnHome = document.getElementById('btn-home');
const btnSettings = document.getElementById('btn-settings');
const modalSettings = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const chkForbidden = document.getElementById('chk-forbidden');
const modeRadios = document.getElementsByName('mode');
const diffSelector = document.getElementById('diff-selector');
const diffRadios = document.getElementsByName('difficulty');
const sizeRadios = document.getElementsByName('boardSize');

function loadSettings() {
    const savedPlayerColor = localStorage.getItem('gomoku_playerColor');
    if (savedPlayerColor !== null) {
        playerColor = parseInt(savedPlayerColor);
        document.querySelectorAll('input[name="playerColor"]').forEach(radio => {
            radio.checked = parseInt(radio.value) === playerColor;
        });
    }

    const savedPvpType = localStorage.getItem('gomoku_pvpType');
    if (savedPvpType !== null) {
        pvpTypeRadios.forEach(radio => {
            radio.checked = radio.value === savedPvpType;
        });
    }

    const savedForbidden = localStorage.getItem('gomoku_forbidden');
    if (savedForbidden !== null) {
        chkForbidden.checked = savedForbidden === 'true';
    }

    const savedBoardSize = localStorage.getItem('gomoku_boardSize');
    if (savedBoardSize !== null) {
        n = parseInt(savedBoardSize);
    } else {
        const isMobile = window.innerWidth <= 480 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) n = 11;
        else n = 15;
    }
    sizeRadios.forEach(radio => {
        radio.checked = parseInt(radio.value) === n;
    });

    const savedMode = localStorage.getItem('gomoku_mode');
    if (savedMode !== null) {
        isPvE = savedMode === 'pve';
        modeRadios.forEach(radio => {
            radio.checked = radio.value === savedMode;
        });
        diffSelector.style.display = isPvE ? 'flex' : 'none';
        if(pvpTypeSelector) pvpTypeSelector.style.display = isPvE ? 'none' : 'flex';
    }

    const savedDiff = localStorage.getItem('gomoku_difficulty');
    if (savedDiff !== null) {
        aiDepth = parseInt(savedDiff);
        diffRadios.forEach(radio => {
            radio.checked = parseInt(radio.value) === aiDepth;
        });
    }
}

function saveSettings() {
    const checkedColor = document.querySelector('input[name="playerColor"]:checked');
    if (checkedColor) {
        playerColor = parseInt(checkedColor.value);
        localStorage.setItem('gomoku_playerColor', checkedColor.value);
    }
    
    localStorage.setItem('gomoku_forbidden', chkForbidden.checked);
    const checkedSize = document.querySelector('input[name="boardSize"]:checked');
    if (checkedSize) localStorage.setItem('gomoku_boardSize', checkedSize.value);
    const checkedMode = document.querySelector('input[name="mode"]:checked');
    if (checkedMode) localStorage.setItem('gomoku_mode', checkedMode.value);
    const checkedDiff = document.querySelector('input[name="difficulty"]:checked');
    if (checkedDiff) localStorage.setItem('gomoku_difficulty', checkedDiff.value);
    const checkedPvpType = document.querySelector('input[name="pvpType"]:checked');
    if (checkedPvpType) localStorage.setItem('gomoku_pvpType', checkedPvpType.value);
}

function syncModeUI() {
    const checkedMode = document.querySelector('input[name="mode"]:checked');
    if (checkedMode) {
        const isPvE_temp = checkedMode.value === 'pve';
        if(diffSelector) diffSelector.style.display = isPvE_temp ? 'flex' : 'none';
        if(pvpTypeSelector) pvpTypeSelector.style.display = isPvE_temp ? 'none' : 'flex';
    }
}

let initialSettingsState = {};

window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    
    btnSettings.onclick = () => {
        loadSettings(); // 重新加载以重置未保存的更改
        syncModeUI();
        initialSettingsState = {
            playerColor: document.querySelector('input[name="playerColor"]:checked')?.value,
            forbidden: chkForbidden.checked,
            boardSize: document.querySelector('input[name="boardSize"]:checked')?.value,
            mode: document.querySelector('input[name="mode"]:checked')?.value,
            difficulty: document.querySelector('input[name="difficulty"]:checked')?.value,
            pvpType: document.querySelector('input[name="pvpType"]:checked')?.value
        };
        modalSettings.style.display = 'flex';
    };
    
    btnCloseSettings.onclick = () => {
        modalSettings.style.display = 'none';
        
        let changed = false;
        if (initialSettingsState.playerColor !== document.querySelector('input[name="playerColor"]:checked')?.value) changed = true;
        if (initialSettingsState.forbidden !== chkForbidden.checked) changed = true;
        if (initialSettingsState.boardSize !== document.querySelector('input[name="boardSize"]:checked')?.value) changed = true;
        const newMode = document.querySelector('input[name="mode"]:checked')?.value;
        if (initialSettingsState.mode !== newMode) changed = true;
        if (initialSettingsState.difficulty !== document.querySelector('input[name="difficulty"]:checked')?.value) changed = true;
        const newPvpType = document.querySelector('input[name="pvpType"]:checked')?.value;
        if (initialSettingsState.pvpType !== newPvpType) changed = true;
        
        if (changed) {
            saveSettings();
            loadSettings();
            if (newMode === 'pvp' && newPvpType === 'online') {
                enterOnlineMode();
            } else {
                isOnline = false;
                if (socket) { socket.disconnect(); socket = null; }
                startGame();
            }
        } else {
            if (newMode === 'pvp' && newPvpType === 'online' && !isOnline) {
                enterOnlineMode();
            }
        }
    };
});

let cellSize = 30; 
let margin = 15; 

let board = [];
let me = true; 
let over = false;
let historyMoves = [];
let hintPos = null;

let isPvE = true;
let aiDepth = 4;
let isAILoading = false; 
let aiWorker = null; 

let currentAnimation = null; 

function easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5);
}

function initWorker() {
    if (aiWorker) {
        aiWorker.terminate();
    }
    aiWorker = new Worker('ai-worker.js');
    
    aiWorker.onmessage = function(e) {
        isAILoading = false;
        const data = e.data;
        
        if (data.isHint) {
            hintPos = { x: data.r, y: data.c, start: performance.now() };
            updateStatus();
            drawBoard();
        } else {
            playMove(data.r, data.c);
        }
    };
}

function initBoard() {
    board = [];
    for (let i = 0; i < n; i++) {
        board[i] = [];
        for (let j = 0; j < n; j++) {
            board[i][j] = 0;
        }
    }
}

function drawBoard() {
    const rect = canvas.getBoundingClientRect();
    const maxSize = rect.width || Math.min(450, canvas.parentElement.clientWidth - 12);
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = maxSize * dpr;
    canvas.height = maxSize * dpr;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, maxSize, maxSize);
    
    // n根线意味着有n-1个格子间距。总宽度 = (n - 1) * cellSize + 2 * margin
    // 将边距设为 0.75 个格子，既能放下坐标，又不会过度挤压棋盘
    cellSize = maxSize / (n + 0.5); 
    margin = cellSize * 0.75;

    ctx.strokeStyle = "#4a2f18";
    ctx.lineWidth = 1;

    // 绘制网格
    for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(margin, margin + i * cellSize);
        ctx.lineTo(maxSize - margin, margin + i * cellSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(margin + i * cellSize, margin);
        ctx.lineTo(margin + i * cellSize, maxSize - margin);
        ctx.stroke();
    }
    
    // 绘制拟物风格坐标系 (木刻/烙印效果，简约版：仅左侧和顶部)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 增大字体，使其更清晰易读
    ctx.font = `bold ${cellSize * 0.45}px 'Times New Roman', serif`;
    
    for (let i = 0; i < n; i++) {
        let letter = String.fromCharCode(65 + i); // A-O
        let num = (n - i).toString(); // n-1
        
        let cx = margin + i * cellSize;
        let cy = margin + i * cellSize;
        
        // 坐标放在边缘留白的中心略偏外的位置
        let textPos = margin * 0.35;
        
        // 1. 刻痕高光 (白色向下偏移，模拟凹陷边缘受光)
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.fillText(letter, cx, textPos + 1); 
        ctx.fillText(num, textPos + 1, cy + 1);    
        
        // 2. 刻痕暗部 (深褐色，模拟烙铁烧焦的凹陷底部)
        ctx.fillStyle = "rgba(60, 30, 10, 0.85)";
        ctx.fillText(letter, cx, textPos);
        ctx.fillText(num, textPos, cy);
    }

    let stars = [];
    if (n === 15) stars = [[3,3], [11,3], [3,11], [11,11], [7,7]];
    else if (n === 13) stars = [[3,3], [9,3], [3,9], [9,9], [6,6]];
    else if (n === 11) stars = [[2,2], [8,2], [2,8], [8,8], [5,5]];
    ctx.fillStyle = "#4a2f18";
    for(let star of stars) {
        ctx.beginPath();
        ctx.arc(margin + star[0] * cellSize, margin + star[1] * cellSize, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (board[i][j] === 0) continue;
            
            if (currentAnimation && currentAnimation.x === i && currentAnimation.y === j) {
                continue; 
            }
            
            if (board[i][j] === 1) drawChess(i, j, true);
            else if (board[i][j] === 2) drawChess(i, j, false);
        }
    }
    
    if (currentAnimation) {
        let now = performance.now();
        let progress = (now - currentAnimation.start) / currentAnimation.duration;
        
        if (progress >= 1) {
            drawChess(currentAnimation.x, currentAnimation.y, currentAnimation.role === 1);
            currentAnimation = null;
        } else {
            let ease = easeOutQuint(progress);
            let animOpts = {
                offsetY: -30 * (1 - ease),
                scale: 1 + 0.15 * (1 - ease),
                shadowOffset: 2 + 8 * (1 - ease),
                shadowAlphaMult: 0.5 + 0.5 * ease,
                globalAlpha: ease
            };
            
            ctx.save();
            ctx.globalAlpha = animOpts.globalAlpha;
            drawChess(currentAnimation.x, currentAnimation.y, currentAnimation.role === 1, animOpts);
            ctx.restore();
            
            requestAnimationFrame(drawBoard);
        }
    }
    
    if (hintPos) {
        let time = performance.now();
        let elapsed = time - hintPos.start;
        let entranceDuration = 400; // 400ms出现动画
        let entranceProgress = Math.min(elapsed / entranceDuration, 1);
        let ease = easeOutQuint(entranceProgress);

        let pulse = (Math.sin(time / 200) + 1) / 2; // 0 ~ 1 呼吸变化
        
        let cx = margin + hintPos.x * cellSize;
        let cy = margin + hintPos.y * cellSize;
        
        ctx.save();
        
        // 1. 底部呼吸发光的金色聚光灯效果，稍微扩大光晕范围并增强亮度
        let glowRadius = cellSize * 1.2 * ease; 
        let glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        glow.addColorStop(0, `rgba(243, 156, 18, ${(0.6 + 0.4 * pulse) * ease})`); // 更强的琥珀金中心
        glow.addColorStop(0.4, `rgba(243, 156, 18, ${(0.2 + 0.2 * pulse) * ease})`); 
        glow.addColorStop(1, 'rgba(243, 156, 18, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, 2*Math.PI);
        ctx.fill();

        // 绘制一个确切的落点指示（小实心圆点），以明确指示正下方哪一格
        ctx.fillStyle = `rgba(255, 200, 50, ${(0.8 + 0.2 * pulse) * ease})`; // 明亮的金黄色核心
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.15 * ease, 0, 2*Math.PI);
        ctx.fill();

        // 2. 绘制拟物的“幻影”悬浮棋子
        // 结合渐现透明度 (ease) 和呼吸透明度 (pulse)
        ctx.globalAlpha = (0.5 + 0.3 * pulse) * ease; 
        
        let animOpts = {
            // 从高处(-30)落下到悬浮位置(-8)，并伴随呼吸浮动
            offsetY: -30 * (1 - ease) + (-8 + 3 * pulse) * ease, 
            // 刚出现时较大(1.15)，稳定后缩小到悬浮大小(1.08)
            scale: 1 + 0.15 * (1 - ease) + 0.08 * ease,             
            // 阴影随之渐现，并显著加深阴影以增强立体感与定位感
            shadowAlphaMult: 0.8 * ease     
        };
        drawChess(hintPos.x, hintPos.y, me, animOpts);
        
        ctx.restore();
        
        requestAnimationFrame(drawBoard); 
    }
    
    if(historyMoves.length > 0) {
        let lastMove = historyMoves[historyMoves.length - 1];
        drawLastMoveMarker(lastMove.x, lastMove.y);
    }
}

function drawChess(i, j, isBlack, animOpts = null) {
    const baseX = margin + i * cellSize;
    const baseY = margin + j * cellSize;
    let radius = cellSize / 2 * 0.85;
    let x = baseX;
    let y = baseY;
    
    let shadowOffsetX = 2.5;
    let shadowOffsetY = 3.5;
    let shadowAlpha = 0.5;
    let shadowSpread = 1.35; 

    if (animOpts) {
        radius *= animOpts.scale;
        y += animOpts.offsetY; 
        
        let heightRatio = (animOpts.scale - 1) / 0.15; 
        shadowOffsetX += 4 * heightRatio;
        shadowOffsetY += 8 * heightRatio;
        shadowAlpha *= animOpts.shadowAlphaMult;
        shadowSpread += 0.5 * heightRatio;
    }

    let shadowX = baseX + shadowOffsetX;
    let shadowY = baseY + shadowOffsetY;
    
    ctx.beginPath();
    ctx.arc(shadowX, shadowY, radius * shadowSpread, 0, 2 * Math.PI);
    const shadowGrad = ctx.createRadialGradient(shadowX, shadowY, radius * 0.3, shadowX, shadowY, radius * shadowSpread);
    shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    
    const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, radius/5, x, y, radius);
    if (isBlack) {
        gradient.addColorStop(0, '#666'); 
        gradient.addColorStop(0.3, '#222'); 
        gradient.addColorStop(0.8, '#0a0a0a'); 
        gradient.addColorStop(1, '#000'); 
    } else {
        gradient.addColorStop(0, '#fff'); 
        gradient.addColorStop(0.4, '#f2f2f2'); 
        gradient.addColorStop(0.8, '#d8d8d8'); 
        gradient.addColorStop(1, '#b0b0b0'); 
    }
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.beginPath();
    if(ctx.ellipse) {
        ctx.ellipse(x - radius/3.5, y - radius/3.5, radius/2.5, radius/4.5, Math.PI / 4, 0, 2 * Math.PI);
    } else {
        ctx.arc(x - radius/3.5, y - radius/3.5, radius/3, 0, 2 * Math.PI); 
    }
    const highlight = ctx.createRadialGradient(x - radius/3.5, y - radius/3.5, 0, x - radius/3.5, y - radius/3.5, radius/2.5);
    if(isBlack) {
        highlight.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
        highlight.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.fillStyle = highlight;
    ctx.fill();
    
    if (!isBlack) {
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.98, 0, 2 * Math.PI);
        const bottomReflect = ctx.createRadialGradient(x + radius/2.5, y + radius/2.5, 0, x, y, radius);
        bottomReflect.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        bottomReflect.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = bottomReflect;
        ctx.fill();
    }
}

function drawLastMoveMarker(i, j) {
    const x = margin + i * cellSize;
    const y = margin + j * cellSize;
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.arc(x, y, cellSize * 0.15, 0, 2*Math.PI);
    ctx.fill();
}

// 禁手判断辅助函数
function getWinningSpots(line) {
    let spots = [];
    for(let i=0; i<line.length; i++) {
        if (line[i] === '_') {
            let temp = line.substring(0, i) + 'X' + line.substring(i+1);
            if (temp.includes('XXXXX') && !temp.includes('XXXXXX')) {
                spots.push(i);
            }
        }
    }
    return spots;
}

function isOpenThree(line) {
    for(let i=0; i<line.length; i++) {
        if (line[i] === '_') {
            let temp = line.substring(0, i) + 'X' + line.substring(i+1);
            let winSpots = getWinningSpots(temp);
            if (winSpots.length >= 2) {
                return true;
            }
        }
    }
    return false;
}

function checkForbidden(currentBoard, r, c) {
    currentBoard[r][c] = 1; 
    
    let isFive = false;
    let isOverline = false;
    let fourSpots = new Set(); 
    let openThreeCount = 0;
    
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    
    for (let dir of dirs) {
        let line = "";
        let coords = [];
        for(let i=-5; i<=5; i++) {
            let nr = r + dir[0]*i;
            let nc = c + dir[1]*i;
            if(nr>=0 && nr<n && nc>=0 && nc<n) {
                let piece = currentBoard[nr][nc];
                line += piece === 0 ? '_' : (piece === 1 ? 'X' : 'O');
            } else {
                line += 'O';
            }
            coords.push(`${nr},${nc}`);
        }
        
        if (line.includes('XXXXXX')) isOverline = true;
        if (line.includes('XXXXX') && !line.includes('XXXXXX')) isFive = true;
        
        let lineFourSpots = getWinningSpots(line);
        lineFourSpots.forEach(idx => fourSpots.add(coords[idx]));
        
        if (isOpenThree(line)) openThreeCount++;
    }
    
    currentBoard[r][c] = 0; 
    
    if (isFive) return null; 
    if (isOverline) return "长连禁手";
    if (fourSpots.size >= 2) return "双四禁手";
    if (openThreeCount >= 2) return "双三禁手";
    
    return null;
}

canvas.onclick = function (e) {
    if (over || isAILoading || currentAnimation) return;
    let currentRole = me ? 1 : 2;
    if (isPvE && currentRole !== playerColor) return;
    if (isOnline && currentRole !== myRole) return; 

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const i = Math.floor((x - margin + cellSize/2) / cellSize);
    const j = Math.floor((y - margin + cellSize/2) / cellSize);

    if (i >= 0 && i < n && j >= 0 && j < n && board[i][j] === 0) {
        
        if (me && chkForbidden && chkForbidden.checked) {
            let forbiddenMsg = checkForbidden(board, i, j);
            if (forbiddenMsg) {
                statusDiv.innerText = `禁手：${forbiddenMsg}，不可落子`;
                statusDiv.style.color = "#c0392b";
                setTimeout(() => {
                    if(!over) updateStatus();
                }, 2000);
                return; 
            }
        }
        
        hintPos = null;
        playMove(i, j);
    }
};

function playMove(i, j) {
    let role = me ? 1 : 2;
    board[i][j] = role;
    
    historyMoves.push({x: i, y: j, role: role});
    if (isOnline && ((role === 1 && myRole === 1) || (role === 2 && myRole === 2))) {
        socket.emit('playMove', { roomId: currentRoomId, r: i, c: j, role: role });
    }
    
    currentAnimation = {
        x: i,
        y: j,
        role: role,
        start: performance.now(),
        duration: 400 
    };
    drawBoard(); 

    if (checkWinDirect(i, j, role)) {
        setTimeout(() => {
            if(isOnline) {
        if (me && myRole === 1 || !me && myRole === 2) {
            statusDiv.innerText = '你赢了！';
        } else {
            statusDiv.innerText = '你输了！';
        }
        setTimeout(() => {
             showAlert(statusDiv.innerText);
             if(btnRestart) btnRestart.innerText = "再来一局";
             if(isOnline) updateOnlineGameOverUI();
        }, 1500);
    } else {
        statusDiv.innerText = (me ? "黑子" : "白子") + " 胜利！";
    }
            statusDiv.style.color = "#c0392b";
            over = true;
        }, 400); 
        return;
    }

    if (historyMoves.length === n * n) {
        setTimeout(() => {
            statusDiv.innerText = "平局！";
            statusDiv.style.color = "#8e44ad";
            over = true;
            if(isOnline && btnRestart) {
                btnRestart.innerText = "再来一局";
                updateOnlineGameOverUI();
            }
        }, 400);
        return;
    }

    me = !me;
    updateStatus();

    if (isPvE && !over) {
        let nextRole = me ? 1 : 2;
        if (nextRole !== playerColor) {
            statusDiv.innerText = "AI思考中...";
            isAILoading = true;
            
            setTimeout(() => {
                if(!aiWorker) initWorker();
                
                aiWorker.postMessage({
                    board: board,
                    depth: aiDepth,
                    aiRole: nextRole,
                    isHint: false
                });
            }, 250);
        }
    }
}

function checkWinDirect(r, c, role) {
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    for (let dir of dirs) {
        let count = 1;
        for(let sign of [1, -1]) {
            for(let i=1; i<=4; i++) {
                let nr = r + dir[0]*i*sign;
                let nc = c + dir[1]*i*sign;
                if(nr>=0 && nr<n && nc>=0 && nc<n && board[nr][nc] === role) count++;
                else break;
            }
        }
        if (count >= 5) return true;
    }
    return false;
}

function updateStatus() {
    if(over) return;
    let currentRole = me ? 1 : 2;
    if (isOnline && myRole) {
        let isMyTurn = currentRole === myRole;
        let colorStr = me ? '黑子' : '白子';
        statusDiv.innerText = `轮到 ${isMyTurn ? '你' : '对方'} (${colorStr})`;
    } else if (isPvE) {
        let isMyTurn = currentRole === playerColor;
        let colorStr = me ? '黑子' : '白子';
        statusDiv.innerText = `轮到 ${isMyTurn ? '你' : 'AI'} (${colorStr})`;
    } else {
        statusDiv.innerText = `轮到 ${me ? '黑子' : '白子'}`;
    }
    statusDiv.style.color = me ? "#2c3e50" : "#c0392b";
    statusDiv.style.textShadow = me ? "none" : "1px 1px 0px rgba(255,255,255,0.5)";
}

function leaveOnlineGame() {
    if (socket && currentRoomId) {
        socket.emit('leaveRoom', currentRoomId);
        currentRoomId = null;
    }
    isOnline = false;
    if (socket) { socket.disconnect(); socket = null; }
    
    const pveRadio = document.querySelector('input[name="mode"][value="pve"]');
    if(pveRadio) pveRadio.checked = true;
    
    const localRadio = document.querySelector('input[name="pvpType"][value="local"]');
    if(localRadio) localRadio.checked = true;
    
    syncModeUI();
    saveSettings();

    if(opponentInfo) opponentInfo.style.display = 'none';
    if(myInfo) myInfo.style.display = 'none';
    if(modalRoomList) modalRoomList.style.display = 'none';
    if(modalWaiting) modalWaiting.style.display = 'none';
    startGame();
}

function updateOnlineGameOverUI() {
    if (!isOnline) return;
    if (btnRestart) btnRestart.innerText = "再来一局";
    if (btnUndo) btnUndo.style.display = 'none';
    if (btnHint) btnHint.style.display = 'none';
    if (btnHome) btnHome.style.display = 'inline-block';
}

if (btnHome) {
    btnHome.onclick = () => {
        leaveOnlineGame();
    };
}

btnUndo.onclick = function() {
    if (historyMoves.length === 0 || (over && !isPvE && !isOnline) || isAILoading) return;
    if (isOnline) {
        if(socket && currentRoomId) {
            socket.emit('undoRequest', currentRoomId);
            showAlert('已发送悔棋请求，等待对方同意...');
        }
        return;
    } 
    
    currentAnimation = null;
    hintPos = null;
    if(over) over = false;

    if (isPvE) {
        let last = historyMoves.pop();
        board[last.x][last.y] = 0;
        
        let nextTurnRole = historyMoves.length % 2 === 0 ? 1 : 2;
        if (nextTurnRole !== playerColor && historyMoves.length > 0) {
            last = historyMoves.pop();
            board[last.x][last.y] = 0;
        }
    } else {
        let lastMove = historyMoves.pop();
        board[lastMove.x][lastMove.y] = 0;
    }
    
    me = (historyMoves.length % 2 === 0);
    
    updateStatus();
    drawBoard();
};

if (btnHint) {
    btnHint.onclick = function() {
        if (over || isAILoading || currentAnimation) return;
        if (isOnline) {
            if(socket && currentRoomId) {
                socket.emit('drawRequest', currentRoomId);
                showAlert('已发送和棋请求，等待对方同意...');
            }
            return;
        }
        let currentRole = me ? 1 : 2;
        if (historyMoves.length === 0 || (isPvE && currentRole !== playerColor)) return;
        
        isAILoading = true;

        setTimeout(() => {
            if(!aiWorker) initWorker();

            aiWorker.postMessage({
                board: board,
                depth: aiDepth,
                aiRole: me ? 1 : 2,
                isHint: true
            });
        }, 250);    };
}

btnRestart.onclick = () => {
    if(isOnline && currentRoomId) {
        if(over) {
            socket.emit('rematchRequest', currentRoomId);
            showAlert('已发送再来一局请求，等待对方同意...');
        } else {
            if(confirm("确定要退出房间吗？")) {
                leaveOnlineGame();
            }
        }
    } else {
        startGame();
    }
};

modeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        const isPvE_temp = this.value === 'pve';
        diffSelector.style.display = isPvE_temp ? 'flex' : 'none';
        if(pvpTypeSelector) pvpTypeSelector.style.display = isPvE_temp ? 'none' : 'flex';
    });
});

window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(drawBoard, 200);
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // 当页面从后台重新变为可见时，重绘棋盘
        // 可以加上少量延时以确保容器尺寸已经恢复
        setTimeout(drawBoard, 100);
    }
});

function startGame() {
    if (!isOnline) {
        if(opponentInfo) opponentInfo.style.display = 'none';
        if(myInfo) myInfo.style.display = 'none';
        if(btnRestart) btnRestart.innerText = "重新开始";
        if(btnHint) btnHint.innerText = "提示";
        if(btnUndo) btnUndo.style.display = 'inline-block';
        if(btnHint) btnHint.style.display = 'inline-block';
        if(btnHome) btnHome.style.display = 'none';
        if(btnSettings) btnSettings.style.display = 'inline-block';
    } else {
        if(btnRestart) btnRestart.innerText = "退出房间";
        if(btnHint) btnHint.innerText = "和棋";
        if(btnUndo) btnUndo.style.display = 'inline-block';
        if(btnHint) btnHint.style.display = 'inline-block';
        if(btnHome) btnHome.style.display = 'none';
        if(btnSettings) btnSettings.style.display = 'none';
    }
    if(aiWorker) {
        aiWorker.terminate();
        aiWorker = null;
    }
    
    initBoard();
    me = true;
    over = false;
    isAILoading = false;
    currentAnimation = null;
    historyMoves = [];
    hintPos = null;
    statusDiv.style.color = "#2c3e50";
    
    syncModeUI();
    
    const checkedDiff = document.querySelector('input[name="difficulty"]:checked');
    if(checkedDiff) {
        aiDepth = parseInt(checkedDiff.value);
    }
    
    updateStatus();
    requestAnimationFrame(drawBoard);

    if (isPvE && playerColor === 2) {
        statusDiv.innerText = "AI思考中...";
        isAILoading = true;
        
        setTimeout(() => {
            if(!aiWorker) initWorker();
            
            aiWorker.postMessage({
                board: board,
                depth: aiDepth,
                aiRole: 1, // AI 执黑
                isHint: false
            });
        }, 250);
    }
}

window.onload = startGame;


function enterOnlineMode() {
    isOnline = true;
    let nickname = localStorage.getItem('gomoku_nickname');
    if (!nickname) {
        if(modalNickname) modalNickname.style.display = 'flex';
    } else {
        connectSocket(nickname);
    }
}

if(btnSaveNickname) btnSaveNickname.onclick = () => {
    const name = nicknameInput.value.trim();
    if (!name) {
        showAlert('昵称不能为空');
        return;
    }
    
    // 仅允许英文和数字
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumericRegex.test(name)) {
        showAlert('昵称仅限英文和数字');
        return;
    }
    
    if (name.length > 10) {
        showAlert('昵称太长了（最多10个字符）');
        return;
    }

    localStorage.setItem('gomoku_nickname', name);
    modalNickname.style.display = 'none';
    connectSocket(name);
};

if(btnCancelNickname) btnCancelNickname.onclick = () => {
    modalNickname.style.display = 'none';
    if (!socket) {
        const localRadio = document.querySelector('input[name="pvpType"][value="local"]');
        if(localRadio) localRadio.checked = true;
        saveSettings();
        isOnline = false;
        startGame();
    }
};

if(btnChangeNickname) btnChangeNickname.onclick = (e) => {
    e.preventDefault();
    nicknameInput.value = localStorage.getItem('gomoku_nickname') || '';
    modalNickname.style.display = 'flex';
};

function connectSocket(nickname) {
    if (!socket) {
        socket = io();
        setupSocketEvents();
    }
    socket.emit('setNickname', { name: nickname, stats: getMyStats() });
    if(currentNicknameSpan) currentNicknameSpan.innerText = nickname;
    if(modalRoomList) modalRoomList.style.display = 'flex';
}

function setupSocketEvents() {
    socket.on('roomList', (rooms) => {
        if(!roomListContainer) return;
        roomListContainer.innerHTML = '';
        if (rooms.length === 0) {
            roomListContainer.innerHTML = '<div style="text-align: center; color: #555; padding: 20px;">暂无房间，去创建一个吧！</div>';
            return;
        }
        rooms.forEach(room => {
            const div = document.createElement('div');
            div.className = 'room-item';
            div.innerHTML = `
                <div class="room-info">
                    <div class="room-name">${room.hostName} 的房间</div>
                    <div class="room-details">大小: ${room.size}×${room.size} | 禁手: ${room.forbidden ? '开' : '关'}</div>
                </div>
                <button class="skeuo-btn join-btn" data-id="${room.id}" style="padding: 6px 12px; font-size: 14px;">加入</button>
            `;
            roomListContainer.appendChild(div);
        });
        
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.onclick = function() {
                const roomId = this.getAttribute('data-id');
                socket.emit('joinRoom', roomId);
            };
        });
    });

    socket.on('roomCreated', (roomId) => {
        currentRoomId = roomId;
        if(modalRoomList) modalRoomList.style.display = 'none';
        if(modalWaiting) modalWaiting.style.display = 'flex';
        if(waitingRoomIdSpan) waitingRoomIdSpan.innerText = roomId;
    });

    socket.on('gameStart', (data) => {
        if(modalWaiting) modalWaiting.style.display = 'none';
        if(modalRoomList) modalRoomList.style.display = 'none';
        
        currentRoomId = data.roomId;
        myRole = (socket.id === data.hostId) ? 1 : 2;
        
        n = parseInt(data.size);
        if(chkForbidden) chkForbidden.checked = data.forbidden;
        saveSettings();
        
        startGame();
        showAlert('对战开始！你是' + (myRole === 1 ? '黑子' : '白子'));
    });

    socket.on('opponentMoved', (data) => {
        if (!over) {
            playMove(data.r, data.c);
        }
    });

    socket.on('opponentLeft', () => {
        if (isOnline) {
            showAlert('对手已离开房间！');
            over = true;
            setTimeout(() => {
                currentRoomId = null;
                myRole = null;
                if(modalAlert) modalAlert.style.display = 'none';
                if(opponentInfo) opponentInfo.style.display = 'none';
                if(myInfo) myInfo.style.display = 'none';
                if(modalRoomList) modalRoomList.style.display = 'flex';
            }, 2000);
        }
    });

    socket.on('errorMsg', (msg) => {
        showAlert(msg);
    });

    socket.on('undoRequested', () => {
        if (confirm("对方请求悔棋，是否同意？")) {
            socket.emit('undoResponse', { roomId: currentRoomId, agreed: true });
            
            let requestRole = myRole === 1 ? 2 : 1;
            if (historyMoves.length === 1 && requestRole === 2) {
                // Cannot undo if requester hasn't played
            } else if (historyMoves.length > 0) {
                let last = historyMoves.pop();
                board[last.x][last.y] = 0;
                
                let nextTurnRole = historyMoves.length % 2 === 0 ? 1 : 2;
                if (nextTurnRole !== requestRole && historyMoves.length > 0) {
                    last = historyMoves.pop();
                    board[last.x][last.y] = 0;
                }
                
                me = (historyMoves.length % 2 === 0);
                
                if (over) over = false;
                if (isOnline && btnRestart) btnRestart.innerText = "退出房间";
                
                updateStatus();
                drawBoard();
            }
        } else {
            socket.emit('undoResponse', { roomId: currentRoomId, agreed: false });
        }
    });

    socket.on('undoResult', (agreed) => {
        if (agreed) {
            showAlert('对方同意悔棋！');
            let requestRole = myRole;
            if (historyMoves.length === 1 && requestRole === 2) {
                // Cannot undo
            } else if (historyMoves.length > 0) {
                let last = historyMoves.pop();
                board[last.x][last.y] = 0;
                
                let nextTurnRole = historyMoves.length % 2 === 0 ? 1 : 2;
                if (nextTurnRole !== requestRole && historyMoves.length > 0) {
                    last = historyMoves.pop();
                    board[last.x][last.y] = 0;
                }
                
                me = (historyMoves.length % 2 === 0);
                
                if (over) over = false;
                if (isOnline && btnRestart) btnRestart.innerText = "退出房间";
                
                updateStatus();
                drawBoard();
            }
        } else {
            showAlert('对方拒绝了您的悔棋请求。');
        }
    });

    socket.on('drawRequested', () => {
        if (confirm("对方请求和棋，是否同意？")) {
            socket.emit('drawResponse', { roomId: currentRoomId, agreed: true });
            over = true;
            statusDiv.innerText = "双方和棋！";
            statusDiv.style.color = "#8e44ad";
            statusDiv.style.textShadow = "none";
            if (isOnline && btnRestart) btnRestart.innerText = "再来一局";
            if(isOnline) updateOnlineGameOverUI();
            updateMyStats(false, true);
        } else {
            socket.emit('drawResponse', { roomId: currentRoomId, agreed: false });
        }
    });

    socket.on('drawResult', (agreed) => {
        if (agreed) {
            showAlert('对方同意和棋！');
            over = true;
            statusDiv.innerText = "双方和棋！";
            statusDiv.style.color = "#8e44ad";
            statusDiv.style.textShadow = "none";
            if (isOnline && btnRestart) btnRestart.innerText = "再来一局";
            if(isOnline) updateOnlineGameOverUI();
            updateMyStats(false, true);
        } else {
            showAlert('对方拒绝了您的和棋请求。');
        }
    });

    socket.on('rematchRequested', () => {
        if (confirm("对方请求再来一局，是否同意？")) {
            socket.emit('rematchResponse', { roomId: currentRoomId, agreed: true });
            myRole = myRole === 1 ? 2 : 1;
            startGame();
            showAlert('对战开始！你是' + (myRole === 1 ? '黑子' : '白子'));
        } else {
            socket.emit('rematchResponse', { roomId: currentRoomId, agreed: false });
        }
    });

    socket.on('rematchResult', (agreed) => {
        if (agreed) {
            myRole = myRole === 1 ? 2 : 1;
            showAlert('对方同意再来一局！你是' + (myRole === 1 ? '黑子' : '白子'));
            startGame();
        } else {
            showAlert('对方拒绝了再来一局的请求。');
        }
    });
}

if(btnCreateRoom) btnCreateRoom.onclick = () => {
    if (socket) {
        socket.emit('createRoom', {
            boardSize: document.querySelector('input[name="boardSize"]:checked').value,
            forbidden: chkForbidden ? chkForbidden.checked : false
        });
    }
};

if(btnRefreshRooms) btnRefreshRooms.onclick = () => {
    if (socket) socket.emit('getRoomList');
};

if(btnLeaveRooms) btnLeaveRooms.onclick = () => {
    if(modalRoomList) modalRoomList.style.display = 'none';
    isOnline = false;
    if (socket) { socket.disconnect(); socket = null; }
    
    const pveRadio = document.querySelector('input[name="mode"][value="pve"]');
    if(pveRadio) pveRadio.checked = true;
    
    const localRadio = document.querySelector('input[name="pvpType"][value="local"]');
    if(localRadio) localRadio.checked = true;
    
    syncModeUI();
    saveSettings();
    startGame();
};

if(btnLeaveWaiting) btnLeaveWaiting.onclick = () => {
    if (socket && currentRoomId) {
        socket.emit('leaveRoom', currentRoomId);
        currentRoomId = null;
    }
    isOnline = false;
    if (socket) { socket.disconnect(); socket = null; }
    const pveRadio = document.querySelector('input[name="mode"][value="pve"]');
    if(pveRadio) pveRadio.checked = true;
    const localRadio = document.querySelector('input[name="pvpType"][value="local"]');
    if(localRadio) localRadio.checked = true;
    
    syncModeUI();
    saveSettings();

    if(modalWaiting) modalWaiting.style.display = 'none';
    if(modalRoomList) modalRoomList.style.display = 'none';
    startGame();
};