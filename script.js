const canvas = document.getElementById('chessBoard');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const modeRadios = document.getElementsByName('mode');

// 游戏参数
const n = 15; // 15x15 棋盘
let cellSize = 30; // 默认格子大小
let margin = 15; // 边缘留白

// 状态变量
let board = [];
let me = true; // true: 黑子, false: 白子
let over = false;
let historyMoves = []; // 悔棋用的历史记录

// 人机对战相关
let isPvE = false;

// 赢法数组
let wins = [];
// 赢法统计数组
let myWin = [];
let computerWin = [];
let count = 0; // 总赢法数

// 初始化棋盘数据
function initBoard() {
    board = [];
    for (let i = 0; i < n; i++) {
        board[i] = [];
        for (let j = 0; j < n; j++) {
            board[i][j] = 0;
        }
    }
}

// 初始化赢法数组
function initWins() {
    wins = [];
    for (let i = 0; i < n; i++) {
        wins[i] = [];
        for (let j = 0; j < n; j++) {
            wins[i][j] = [];
        }
    }
    count = 0;

    // 横线赢法
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - 4; j++) {
            for (let k = 0; k < 5; k++) {
                wins[i][j + k][count] = true;
            }
            count++;
        }
    }

    // 竖线赢法
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - 4; j++) {
            for (let k = 0; k < 5; k++) {
                wins[j + k][i][count] = true;
            }
            count++;
        }
    }

    // 正斜线赢法
    for (let i = 0; i < n - 4; i++) {
        for (let j = 0; j < n - 4; j++) {
            for (let k = 0; k < 5; k++) {
                wins[i + k][j + k][count] = true;
            }
            count++;
        }
    }

    // 反斜线赢法
    for (let i = 0; i < n - 4; i++) {
        for (let j = n - 1; j > 3; j--) {
            for (let k = 0; k < 5; k++) {
                wins[i + k][j - k][count] = true;
            }
            count++;
        }
    }

    for (let i = 0; i < count; i++) {
        myWin[i] = 0;
        computerWin[i] = 0;
    }
}

// 绘制棋盘
function drawBoard() {
    // 重新计算尺寸以适应不同屏幕
    const containerWidth = canvas.parentElement.clientWidth - 12; // 减去容器内边距
    const maxSize = Math.min(450, containerWidth);
    
    // 修复移动端模糊，使用设备像素比
    const dpr = window.devicePixelRatio || 1;
    canvas.width = maxSize * dpr;
    canvas.height = maxSize * dpr;
    canvas.style.width = maxSize + 'px';
    canvas.style.height = maxSize + 'px';
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, maxSize, maxSize);
    
    cellSize = maxSize / n;
    margin = cellSize / 2;

    ctx.strokeStyle = "#4a2f18";
    ctx.lineWidth = 1;

    for (let i = 0; i < n; i++) {
        // 横线
        ctx.beginPath();
        ctx.moveTo(margin, margin + i * cellSize);
        ctx.lineTo(maxSize - margin, margin + i * cellSize);
        ctx.stroke();

        // 竖线
        ctx.beginPath();
        ctx.moveTo(margin + i * cellSize, margin);
        ctx.lineTo(margin + i * cellSize, maxSize - margin);
        ctx.stroke();
    }
    
    // 画天元和星位 (拟物细节)
    const stars = [[3,3], [11,3], [3,11], [11,11], [7,7]];
    ctx.fillStyle = "#4a2f18";
    for(let star of stars) {
        ctx.beginPath();
        ctx.arc(margin + star[0] * cellSize, margin + star[1] * cellSize, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    // 重绘所有棋子
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (board[i][j] === 1) drawChess(i, j, true);
            else if (board[i][j] === 2) drawChess(i, j, false);
        }
    }
    
    // 标记最后一步
    if(historyMoves.length > 0) {
        let lastMove = historyMoves[historyMoves.length - 1];
        drawLastMoveMarker(lastMove.x, lastMove.y);
    }
}

// 绘制棋子 (拟物风格，3D高光阴影)
function drawChess(i, j, isBlack) {
    const x = margin + i * cellSize;
    const y = margin + j * cellSize;
    const radius = cellSize / 2 * 0.85;

    // 阴影
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fill();

    // 棋子本体及高光渐变
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    
    const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, radius/6, x, y, radius);
    if (isBlack) {
        gradient.addColorStop(0, '#555');
        gradient.addColorStop(0.3, '#222');
        gradient.addColorStop(1, '#050505');
    } else {
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(0.5, '#eee');
        gradient.addColorStop(1, '#ccc');
    }
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // 增加一点高光反射让拟物感更强
    ctx.beginPath();
    ctx.arc(x - radius/3, y - radius/3, radius/4, 0, 2 * Math.PI);
    const highlight = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x - radius/3, y - radius/3, radius/4);
    if(isBlack) {
        highlight.addColorStop(0, 'rgba(255,255,255,0.3)');
        highlight.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
        highlight.addColorStop(0, 'rgba(255,255,255,0.8)');
        highlight.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = highlight;
    ctx.fill();
}

function drawLastMoveMarker(i, j) {
    const x = margin + i * cellSize;
    const y = margin + j * cellSize;
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.arc(x, y, cellSize * 0.15, 0, 2*Math.PI);
    ctx.fill();
}

// 落子交互
canvas.onclick = function (e) {
    if (over) return;
    if (isPvE && !me) return; // 人机模式且轮到电脑时不能点击

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const i = Math.floor((x - margin + cellSize/2) / cellSize);
    const j = Math.floor((y - margin + cellSize/2) / cellSize);

    if (i >= 0 && i < n && j >= 0 && j < n && board[i][j] === 0) {
        playMove(i, j);
    }
};

function playMove(i, j) {
    board[i][j] = me ? 1 : 2;
    
    // 记录历史
    historyMoves.push({x: i, y: j, me: me, myWinRecord: [...myWin], compWinRecord: [...computerWin]});

    drawBoard();

    if (checkWin(i, j, me)) {
        statusDiv.innerText = (me ? "黑子" : "白子") + " 胜利！";
        statusDiv.style.color = "#c0392b";
        over = true;
        return;
    }

    me = !me;
    updateStatus();

    if (isPvE && !me && !over) {
        statusDiv.innerText = "电脑思考中...";
        setTimeout(computerAI, 300); // 稍微延迟一下
    }
}

function checkWin(i, j, isBlack) {
    let winArray = isBlack ? myWin : computerWin;
    let oppWinArray = isBlack ? computerWin : myWin;

    for (let k = 0; k < count; k++) {
        if (wins[i][j][k]) {
            winArray[k]++;
            oppWinArray[k] = 6; // 对方不可能在此赢法上获胜了
            if (winArray[k] === 5) {
                return true;
            }
        }
    }
    return false;
}

function updateStatus() {
    if(over) return;
    statusDiv.innerText = `轮到 ${me ? '黑子' : '白子'}`;
    statusDiv.style.color = me ? "#2c3e50" : "#fff";
}

// 简单 AI 算法
function computerAI() {
    let myScore = [];
    let computerScore = [];
    let max = 0;
    let u = 0, v = 0;

    for (let i = 0; i < n; i++) {
        myScore[i] = [];
        computerScore[i] = [];
        for (let j = 0; j < n; j++) {
            myScore[i][j] = 0;
            computerScore[i][j] = 0;
        }
    }

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (board[i][j] === 0) {
                for (let k = 0; k < count; k++) {
                    if (wins[i][j][k]) {
                        // 拦截玩家
                        if (myWin[k] === 1) myScore[i][j] += 200;
                        else if (myWin[k] === 2) myScore[i][j] += 400;
                        else if (myWin[k] === 3) myScore[i][j] += 2000;
                        else if (myWin[k] === 4) myScore[i][j] += 10000;

                        // 电脑自己获胜
                        if (computerWin[k] === 1) computerScore[i][j] += 220;
                        else if (computerWin[k] === 2) computerScore[i][j] += 420;
                        else if (computerWin[k] === 3) computerScore[i][j] += 2100;
                        else if (computerWin[k] === 4) computerScore[i][j] += 20000;
                    }
                }

                if (myScore[i][j] > max) {
                    max = myScore[i][j];
                    u = i;
                    v = j;
                } else if (myScore[i][j] === max) {
                    if (computerScore[i][j] > computerScore[u][v]) {
                        u = i;
                        v = j;
                    }
                }

                if (computerScore[i][j] > max) {
                    max = computerScore[i][j];
                    u = i;
                    v = j;
                } else if (computerScore[i][j] === max) {
                    if (myScore[i][j] > myScore[u][v]) {
                        u = i;
                        v = j;
                    }
                }
            }
        }
    }
    
    // 如果是电脑的第一步，且没有防守压力
    if (historyMoves.length === 1 && max < 400) {
        // 下在玩家附近
        let lastPlayerMove = historyMoves[0];
        let offsets = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
        let validOffsets = offsets.filter(off => {
            let ni = lastPlayerMove.x + off[0];
            let nj = lastPlayerMove.y + off[1];
            return ni>=0 && ni<n && nj>=0 && nj<n && board[ni][nj]===0;
        });
        if(validOffsets.length > 0) {
             let randOff = validOffsets[Math.floor(Math.random()*validOffsets.length)];
             u = lastPlayerMove.x + randOff[0];
             v = lastPlayerMove.y + randOff[1];
        }
    } else if (max === 0) { // 兜底随机下子
         let emptySpots = [];
         for(let i=0;i<n;i++){
             for(let j=0;j<n;j++){
                 if(board[i][j]===0) emptySpots.push({i,j});
             }
         }
         if(emptySpots.length > 0) {
             let spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
             u = spot.i; v = spot.j;
         }
    }

    playMove(u, v);
}

// 悔棋逻辑
btnUndo.onclick = function() {
    if (historyMoves.length === 0 || (over && !isPvE)) return; 
    
    // 如果游戏结束，允许悔棋继续
    if(over) over = false;

    if (isPvE) {
        // 人机模式下，如果当前是电脑思考阶段，不允许悔棋
        if(!me) return;
        
        // 人机对战需要撤回两步（电脑一步，玩家一步）
        if(historyMoves.length < 2 && historyMoves.length > 0) {
            // 只有玩家下了一步的情况
            let move = historyMoves.pop();
            board[move.x][move.y] = 0;
            resetWinRecordsToLast();
            me = true;
        } else if (historyMoves.length >= 2) {
            let compMove = historyMoves.pop();
            board[compMove.x][compMove.y] = 0;
            
            let playerMove = historyMoves.pop();
            board[playerMove.x][playerMove.y] = 0;
            
            resetWinRecordsToLast();
            me = true; // 悔棋后必定是玩家回合
        }
    } else {
        // 双人模式撤回一步
        let lastMove = historyMoves.pop();
        board[lastMove.x][lastMove.y] = 0;
        resetWinRecordsToLast();
        me = !me;
    }
    
    updateStatus();
    drawBoard();
};

function resetWinRecordsToLast() {
    if (historyMoves.length > 0) {
        let state = historyMoves[historyMoves.length - 1];
        myWin = [...state.myWinRecord];
        computerWin = [...state.compWinRecord];
    } else {
         for (let i = 0; i < count; i++) {
            myWin[i] = 0;
            computerWin[i] = 0;
        }
    }
}

btnRestart.onclick = startGame;

modeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        isPvE = this.value === 'pve';
        startGame();
    });
});

window.addEventListener('resize', () => {
    // 防抖
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(drawBoard, 200);
});

function startGame() {
    initBoard();
    initWins();
    me = true;
    over = false;
    historyMoves = [];
    statusDiv.style.color = "#2c3e50";
    
    // 检查当前模式
    const checkedRadio = document.querySelector('input[name="mode"]:checked');
    if(checkedRadio) {
        isPvE = checkedRadio.value === 'pve';
    }
    
    updateStatus();
    
    // 确保DOM加载后绘制
    setTimeout(drawBoard, 50);
}

// 页面加载完毕后启动
window.onload = startGame;
