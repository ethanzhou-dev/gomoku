export class GameStateManager {
    constructor(size) {
        this.init(size);
    }

    init(size) {
        this.size = size;
        this.board = [];
        for (let i = 0; i < size; i++) {
            this.board[i] = new Array(size).fill(0);
        }
        this.historyMoves = [];
        this.me = true; // true = turn 1 (black), false = turn 2 (white)
        this.over = false;
        this.winner = null;
    }

    setState(state) {
        this.board = state.board;
        this.historyMoves = state.historyMoves || state.history.map(m => ({ x: m.r, y: m.c, role: m.role }));
        this.me = state.me !== undefined ? state.me : (state.turn === 1);
        this.over = state.over;
        this.winner = state.winner;
    }

    executeMove(i, j) {
        const role = this.me ? 1 : 2;
        this.board[i][j] = role;
        this.historyMoves.push({ x: i, y: j, role });
        this.me = !this.me;
        return role;
    }

    undoMove() {
        if (this.historyMoves.length === 0) return false;
        const last = this.historyMoves.pop();
        this.board[last.x][last.y] = 0;
        this.me = !this.me;
        this.over = false;
        this.winner = null;
        return true;
    }

    cloneState() {
        return {
            board: JSON.parse(JSON.stringify(this.board)),
            historyMoves: [...this.historyMoves],
            me: this.me,
            over: this.over,
            winner: this.winner
        };
    }
}
