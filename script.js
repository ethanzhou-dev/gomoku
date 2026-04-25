const workerCode = `
const WIN_SCORE = 10000000;

self.onmessage = function(e) {
    const { board, depth, aiRole } = e.data;
    const humanRole = aiRole === 1 ? 2 : 1;
    const size = board.length;
    let bestMove = null;

    function getCandidates(currentBoard) {
        let candidates = [];
        let hasPiece = false;
        let visited = Array.from({length: size}, () => new Array(size).fill(false));

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (currentBoard[i][j] !== 0) {
                    hasPiece = true;
                    for (let x = Math.max(0, i - 2); x <= Math.min(size - 1, i + 2); x++) {
                        for (let y = Math.max(0, j - 2); y <= Math.min(size - 1, j + 2); y++) {
                            if (currentBoard[x][y] === 0 && !visited[x][y]) {
                                visited[x][y] = true;
                                candidates.push({r: x, c: y});
                            }
                        }
                    }
                }
            }
        }
        
        if (!hasPiece) {
            return [{r: Math.floor(size/2), c: Math.floor(size/2)}];
        }
        
        candidates.forEach(pos => {
            pos.score = evaluatePoint(currentBoard, pos.r, pos.c, aiRole) + evaluatePoint(currentBoard, pos.r, pos.c, humanRole);
        });
        candidates.sort((a, b) => b.score - a.score);
        
        let maxCandidates = depth >= 6 ? 15 : 25;
        return candidates.slice(0, maxCandidates);
    }

    function evaluatePoint(currentBoard, r, c, role) {
        let score = 0;
        const dirs = [[1,0], [0,1], [1,1], [1,-1]];
        
        for (let dir of dirs) {
            let count = 1;
            let block = 0;
            
            for(let sign of [1, -1]) {
                for (let i = 1; i <= 4; i++) {
                    let nr = r + dir[0] * i * sign;
                    let nc = c + dir[1] * i * sign;
                    if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
                        block++; break;
                    }
                    if (currentBoard[nr][nc] === role) {
                        count++;
                    } else if (currentBoard[nr][nc] === 0) {
                        break; 
                    } else {
                        block++; break; 
                    }
                }
            }
            
            if (count >= 5) score += 100000;
            else if (block === 0) {
                if (count === 4) score += 10000;
                else if (count === 3) score += 1000;
                else if (count === 2) score += 100;
                else if (count === 1) score += 10;
            } else if (block === 1) {
                if (count === 4) score += 1000;
                else if (count === 3) score += 100;
                else if (count === 2) score += 10;
                else if (count === 1) score += 1;
            }
        }
        return score;
    }

    function evaluateBoard(currentBoard) {
        let aiScore = 0;
        let humanScore = 0;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (currentBoard[i][j] === aiRole) {
                    aiScore += evaluatePoint(currentBoard, i, j, aiRole);
                } else if (currentBoard[i][j] === humanRole) {
                    humanScore += evaluatePoint(currentBoard, i, j, humanRole);
                }
            }
        }
        return aiScore - humanScore * 1.2; 
    }

    function minimax(currentBoard, depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return evaluateBoard(currentBoard);
        }

        const candidates = getCandidates(currentBoard);
        if (candidates.length === 0) return 0;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let pos of candidates) {
                currentBoard[pos.r][pos.c] = aiRole;
                
                if (evaluatePoint(currentBoard, pos.r, pos.c, aiRole) >= 100000) {
                    currentBoard[pos.r][pos.c] = 0;
                    return WIN_SCORE + depth;
                }
                
                let eval = minimax(currentBoard, depth - 1, alpha, beta, false);
                currentBoard[pos.r][pos.c] = 0;
                
                maxEval = Math.max(maxEval, eval);
                alpha = Math.max(alpha, eval);
                if (beta <= alpha) break; 
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let pos of candidates) {
                currentBoard[pos.r][pos.c] = humanRole;
                
                if (evaluatePoint(currentBoard, pos.r, pos.c, humanRole) >= 100000) {
                    currentBoard[pos.r][pos.c] = 0;
                    return -WIN_SCORE - depth; 
                }

                let eval = minimax(currentBoard, depth - 1, alpha, beta, true);
                currentBoard[pos.r][pos.c] = 0;
                
                minEval = Math.min(minEval, eval);
                beta = Math.min(beta, eval);
                if (beta <= alpha) break; 
            }
            return minEval;
        }
    }

    let candidates = getCandidates(board);
    
    for(let pos of candidates) {
        board[pos.r][pos.c] = aiRole;
        if(evaluatePoint(board, pos.r, pos.c, aiRole) >= 100000) {
            self.postMessage({r: pos.r, c: pos.c});
            return;
        }
        board[pos.r][pos.c] = 0;
    }
    for(let pos of candidates) {
        board[pos.r][pos.c] = humanRole;
        if(evaluatePoint(board, pos.r, pos.c, humanRole) >= 100000) {
            self.postMessage({r: pos.r, c: pos.c});
            return;
        }
        board[pos.r][pos.c] = 0;
    }

    let alpha = -Infinity;
    let beta = Infinity;

    for (let pos of candidates) {
        board[pos.r][pos.c] = aiRole;
        let eval = minimax(board, depth - 1, alpha, beta, false);
        board[pos.r][pos.c] = 0;

        if (eval > alpha) {
            alpha = eval;
            bestMove = pos;
        }
    }

    self.postMessage(bestMove || candidates[0]);
};
`;

const canvas = document.getElementById('chessBoard');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const modeRadios = document.getElementsByName('mode');
const diffSelector = document.getElementById('diff-selector');
const diffRadios = document.getElementsByName('difficulty');

// 游戏参数
const n = 15; // 15x15 棋盘
let cellSize = 30; // 默认格子大小
let margin = 15; // 边缘留白

// 状态变量
let board = [];
let me = true; // true: 黑子(玩家1), false: 白子(玩家2/AI)
let over = false;
let historyMoves = []; // 悔棋用的历史记录

// 人机对战相关
let isPvE = false;
let aiDepth = 4; // 默认难度普通 (深度4)
let isAILoading = false; // AI计算中锁定棋盘
let aiWorker = null; // Web Worker

// 动效状态
let currentAnimation = null; 

// 物理缓动函数（优雅的缓出）
function easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5);
}

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

// 绘制棋盘
function drawBoard() {
    const containerWidth = canvas.parentElement.clientWidth - 12;
    const maxSize = Math.min(450, containerWidth);
    
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
        ctx.beginPath();
        ctx.moveTo(margin, margin + i * cellSize);
        ctx.lineTo(maxSize - margin, margin + i * cellSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(margin + i * cellSize, margin);
        ctx.lineTo(margin + i * cellSize, maxSize - margin);
        ctx.stroke();
    }
    
    const stars = [[3,3], [11,3], [3,11], [11,11], [7,7]];
    ctx.fillStyle = "#4a2f18";
    for(let star of stars) {
        ctx.beginPath();
        ctx.arc(margin + star[0] * cellSize, margin + star[1] * cellSize, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (board[i][j] === 0) continue;
            
            // 如果这个棋子正在动画中，先跳过不画，最后单独画它
            if (currentAnimation && currentAnimation.x === i && currentAnimation.y === j) {
                continue; 
            }
            
            if (board[i][j] === 1) drawChess(i, j, true);
            else if (board[i][j] === 2) drawChess(i, j, false);
        }
    }
    
    // 绘制动画中的棋子
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
    let shadowOffsetX = 2;
    let shadowOffsetY = 2;
    let shadowAlpha = 0.4;

    if (animOpts) {
        radius *= animOpts.scale;
        y += animOpts.offsetY; 
        shadowOffsetX = animOpts.shadowOffset;
        shadowOffsetY = animOpts.shadowOffset; // 修正阴影Y轴
        shadowAlpha *= animOpts.shadowAlphaMult;
    }

    // 绘制阴影
    ctx.beginPath();
    ctx.arc(baseX + shadowOffsetX, baseY + shadowOffsetY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.fill();

    // 绘制棋子本体
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
    
    // 绘制高光
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
    if (over || isAILoading || currentAnimation) return;
    if (isPvE && !me) return; 

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
    let role = me ? 1 : 2;
    board[i][j] = role;
    
    historyMoves.push({x: i, y: j, role: role});
    
    currentAnimation = {
        x: i,
        y: j,
        role: role,
        start: performance.now(),
        duration: 400 // 动画持续时间 400ms
    };
    drawBoard(); // 启动动画

    if (checkWinDirect(i, j, role)) {
        setTimeout(() => {
            statusDiv.innerText = (me ? "黑子" : "白子") + " 胜利！";
            statusDiv.style.color = "#c0392b";
            over = true;
        }, 400); // 等待动画完成
        return;
    }

    me = !me;
    updateStatus();

    if (isPvE && !me && !over) {
        statusDiv.innerText = "专业AI思考中...";
        isAILoading = true;
        
        // 增加短暂延迟，让玩家的落子动画先跑起来
        setTimeout(() => {
            if(!aiWorker) {
                const blob = new Blob([workerCode], {type: 'application/javascript'});
                const workerUrl = URL.createObjectURL(blob);
                aiWorker = new Worker(workerUrl);
                aiWorker.onmessage = function(e) {
                    isAILoading = false;
                    const bestMove = e.data;
                    playMove(bestMove.r, bestMove.c);
                };
            }
            
            aiWorker.postMessage({
                board: board,
                depth: aiDepth,
                aiRole: 2
            });
        }, 50);
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
    statusDiv.innerText = `轮到 ${me ? '黑子' : '白子'}`;
    statusDiv.style.color = me ? "#2c3e50" : "#fff";
}

// 悔棋逻辑
btnUndo.onclick = function() {
    if (historyMoves.length === 0 || (over && !isPvE) || isAILoading) return; 
    
    currentAnimation = null;
    if(over) over = false;

    if (isPvE) {
        if(!me) return; // 电脑回合不允许悔棋
        
        if(historyMoves.length < 2 && historyMoves.length > 0) {
            let move = historyMoves.pop();
            board[move.x][move.y] = 0;
            me = true;
        } else if (historyMoves.length >= 2) {
            let compMove = historyMoves.pop();
            board[compMove.x][compMove.y] = 0;
            
            let playerMove = historyMoves.pop();
            board[playerMove.x][playerMove.y] = 0;
            
            me = true;
        }
    } else {
        let lastMove = historyMoves.pop();
        board[lastMove.x][lastMove.y] = 0;
        me = !me;
    }
    
    updateStatus();
    drawBoard();
};

btnRestart.onclick = startGame;

modeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        isPvE = this.value === 'pve';
        diffSelector.style.display = isPvE ? 'flex' : 'none';
        startGame();
    });
});

diffRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        aiDepth = parseInt(this.value);
        startGame();
    });
});

window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(drawBoard, 200);
});

function startGame() {
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
    statusDiv.style.color = "#2c3e50";
    
    const checkedMode = document.querySelector('input[name="mode"]:checked');
    if(checkedMode) {
        isPvE = checkedMode.value === 'pve';
        diffSelector.style.display = isPvE ? 'flex' : 'none';
    }
    
    const checkedDiff = document.querySelector('input[name="difficulty"]:checked');
    if(checkedDiff) {
        aiDepth = parseInt(checkedDiff.value);
    }
    
    updateStatus();
    setTimeout(drawBoard, 50);
}

window.onload = startGame;
