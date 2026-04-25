// ai-worker.js
// 采用 Alpha-Beta 剪枝的极小极大值搜索算法，结合启发式评估，提供专业级五子棋AI支持

const WIN_SCORE = 10000000;

self.onmessage = function(e) {
    const { board, depth, aiRole } = e.data;
    const humanRole = aiRole === 1 ? 2 : 1;
    const size = board.length;
    let bestMove = null;

    // 获取候选点 (只考虑已有棋子周围半径2以内的空位)
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
        
        // 启发式排序候选点 (极大地提高Alpha-Beta剪枝效率)
        candidates.forEach(pos => {
            pos.score = evaluatePoint(currentBoard, pos.r, pos.c, aiRole) + evaluatePoint(currentBoard, pos.r, pos.c, humanRole);
        });
        // 优先搜索得分高的点
        candidates.sort((a, b) => b.score - a.score);
        
        // 限制候选点数量，深度越大，需要裁剪的宽度越大以保证效率
        let maxCandidates = depth >= 6 ? 15 : 25;
        return candidates.slice(0, maxCandidates);
    }

    // 评估单个位置的得分
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
                        break; // 遇到空位停止
                    } else {
                        block++; break; // 遇到敌方棋子
                    }
                }
            }
            
            // 经典五子棋评分模型
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
        // 略微增加防守权重
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
                
                // 剪枝前快速检查是否能赢
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
    
    // 强制防守或直接进攻逻辑（避免深搜前被简单长连击败）
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

    // 第一层搜索
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