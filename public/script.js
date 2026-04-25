// 初始化 Socket.io 以备后续联机开发使用
// const socket = io();
// socket.on('connect', () => {
//     console.log('Connected to server with ID:', socket.id);
// });

const workerCode = `
const WIN_SCORE = 10000000;

self.onmessage = function(e) {
    const { board, depth, aiRole, isHint } = e.data;
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
            self.postMessage({r: pos.r, c: pos.c, isHint: isHint});
            return;
        }
        board[pos.r][pos.c] = 0;
    }
    for(let pos of candidates) {
        board[pos.r][pos.c] = humanRole;
        if(evaluatePoint(board, pos.r, pos.c, humanRole) >= 100000) {
            self.postMessage({r: pos.r, c: pos.c, isHint: isHint});
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

    let result = bestMove || candidates[0];
    self.postMessage({r: result.r, c: result.c, isHint: isHint});
};
`;

const canvas = document.getElementById('chessBoard');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const btnHint = document.getElementById('btn-hint');
const btnSettings = document.getElementById('btn-settings');
const modalSettings = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const chkForbidden = document.getElementById('chk-forbidden');
const modeRadios = document.getElementsByName('mode');
const diffSelector = document.getElementById('diff-selector');
const diffRadios = document.getElementsByName('difficulty');
const sizeRadios = document.getElementsByName('boardSize');

function loadSettings() {
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
    localStorage.setItem('gomoku_forbidden', chkForbidden.checked);
    const checkedSize = document.querySelector('input[name="boardSize"]:checked');
    if (checkedSize) localStorage.setItem('gomoku_boardSize', checkedSize.value);
    const checkedMode = document.querySelector('input[name="mode"]:checked');
    if (checkedMode) localStorage.setItem('gomoku_mode', checkedMode.value);
    const checkedDiff = document.querySelector('input[name="difficulty"]:checked');
    if (checkedDiff) localStorage.setItem('gomoku_difficulty', checkedDiff.value);
}

window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    
    btnSettings.onclick = () => {
        modalSettings.style.display = 'flex';
    };
    
    btnCloseSettings.onclick = () => {
        modalSettings.style.display = 'none';
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
    const blob = new Blob([workerCode], {type: 'application/javascript'});
    const workerUrl = URL.createObjectURL(blob);
    aiWorker = new Worker(workerUrl);
    
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
    if (isPvE && !me) return; 

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
            statusDiv.innerText = (me ? "黑子" : "白子") + " 胜利！";
            statusDiv.style.color = "#c0392b";
            over = true;
        }, 400); 
        return;
    }

    me = !me;
    updateStatus();

    if (isPvE && !me && !over) {
        statusDiv.innerText = "AI思考中...";
        isAILoading = true;
        
        setTimeout(() => {
            if(!aiWorker) initWorker();
            
            aiWorker.postMessage({
                board: board,
                depth: aiDepth,
                aiRole: 2,
                isHint: false
            });
        }, 250);
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
    statusDiv.style.color = me ? "#2c3e50" : "#c0392b";
    statusDiv.style.textShadow = me ? "none" : "1px 1px 0px rgba(255,255,255,0.5)";
}

btnUndo.onclick = function() {
    if (historyMoves.length === 0 || (over && !isPvE) || isAILoading) return; 
    
    currentAnimation = null;
    hintPos = null;
    if(over) over = false;

    if (isPvE) {
        if(!me) return; 
        
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

if (btnHint) {
    btnHint.onclick = function() {
        if (over || isAILoading || currentAnimation || historyMoves.length === 0) return;
        if (isPvE && !me) return; 
        
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

btnRestart.onclick = startGame;

chkForbidden.addEventListener('change', saveSettings);

modeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        isPvE = this.value === 'pve';
        diffSelector.style.display = isPvE ? 'flex' : 'none';
        saveSettings();
        startGame();
    });
});

diffRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        aiDepth = parseInt(this.value);
        saveSettings();
        startGame();
    });
});

sizeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        n = parseInt(this.value);
        saveSettings();
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
    hintPos = null;
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
    requestAnimationFrame(drawBoard);
}

window.onload = startGame;