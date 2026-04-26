importScripts('rules.js');

const WIN_SCORE = 10000000;

self.onmessage = function(e) {
    const { board, depth, aiRole, forbidden, isHint } = e.data;
    const humanRole = aiRole === 1 ? 2 : 1;
    const size = board.length;
    let bestMove = null;

    function getCandidates(currentBoard, role) {
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

        // 如果开启了禁手且当前是黑棋回合，过滤掉禁手位置
        if (forbidden && role === 1) {
            candidates = candidates.filter(pos => !checkForbidden(currentBoard, pos.r, pos.c, size));
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

        const currentRole = isMaximizing ? aiRole : humanRole;
        const candidates = getCandidates(currentBoard, currentRole);
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

    let candidates = getCandidates(board, aiRole);
    
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

    let result = bestMove || candidates[0];
    self.postMessage({r: result.r, c: result.c, isHint: isHint});
};