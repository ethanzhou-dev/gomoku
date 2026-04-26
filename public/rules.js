/**
 * 禁手判断通用模块
 */

function getWinningSpots(line) {
    let spots = [];
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '_') {
            let temp = line.substring(0, i) + 'X' + line.substring(i + 1);
            if (temp.includes('XXXXX') && !temp.includes('XXXXXX')) {
                spots.push(i);
            }
        }
    }
    return spots;
}

function isOpenThree(line) {
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '_') {
            let temp = line.substring(0, i) + 'X' + line.substring(i + 1);
            let winSpots = getWinningSpots(temp);
            if (winSpots.length >= 2) {
                return true;
            }
        }
    }
    return false;
}

/**
 * 判断指定位置是否为黑棋禁手
 * @param {Array} currentBoard 当前棋盘状态
 * @param {number} r 行坐标
 * @param {number} c 列坐标
 * @param {number} size 棋盘大小
 * @returns {string|null} 如果是禁手则返回禁手类型名称，否则返回 null
 */
function checkForbidden(currentBoard, r, c, size) {
    // 假设黑棋为 1，白棋为 2，空位为 0
    // 禁手仅针对黑棋 (1)
    const originalValue = currentBoard[r][c];
    currentBoard[r][c] = 1;

    let isFive = false;
    let isOverline = false;
    let fourSpots = new Set();
    let openThreeCount = 0;

    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (let dir of dirs) {
        let line = "";
        let coords = [];
        // 获取该方向上前后 5 个位置，共 11 个点
        for (let i = -5; i <= 5; i++) {
            let nr = r + dir[0] * i;
            let nc = c + dir[1] * i;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                let piece = currentBoard[nr][nc];
                line += piece === 0 ? '_' : (piece === 1 ? 'X' : 'O');
            } else {
                line += 'O'; // 边界等同于对方棋子，起到阻挡作用
            }
            coords.push(`${nr},${nc}`);
        }

        // 1. 长连禁手：超过 5 个子
        if (line.includes('XXXXXX')) isOverline = true;
        
        // 2. 五连：如果是五连，则不计为禁手（五连优先于禁手）
        if (line.includes('XXXXX') && !line.includes('XXXXXX')) isFive = true;

        // 3. 四四禁手：计算由于落子产生的所有“活四”或“冲四”的关键点
        let lineFourSpots = getWinningSpots(line);
        lineFourSpots.forEach(idx => {
            if (coords[idx]) {
                fourSpots.add(coords[idx]);
            }
        });

        // 4. 三三禁手：计算活三数量
        if (isOpenThree(line)) openThreeCount++;
    }

    currentBoard[r][c] = originalValue; // 还原棋盘

    if (isFive) return null; // 五连优先
    if (isOverline) return "长连禁手";
    if (fourSpots.size >= 2) return "双四禁手";
    if (openThreeCount >= 2) return "双三禁手";

    return null;
}

/**
 * 判断是否连成五子
 * @param {Array} board 棋盘状态
 * @param {number} r 行坐标
 * @param {number} c 列坐标
 * @param {number} role 玩家 (1 或 2)
 * @param {number} size 棋盘大小
 * @returns {boolean}
 */
function checkWin(board, r, c, role, size) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let dir of dirs) {
        let count = 1;
        for (let sign of [1, -1]) {
            for (let i = 1; i <= 4; i++) {
                let nr = r + dir[0] * i * sign;
                let nc = c + dir[1] * i * sign;
                if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === role) {
                    count++;
                } else {
                    break;
                }
            }
        }
        if (count >= 5) return true;
    }
    return false;
}

// 导出模块（兼容 worker、Node.js 和浏览器）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { checkForbidden, checkWin };
} else if (typeof self !== 'undefined') {
    // Worker 或 浏览器
    self.GomokuRules = { checkForbidden, checkWin };
}
