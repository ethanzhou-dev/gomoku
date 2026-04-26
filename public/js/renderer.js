export class Renderer {
    constructor(canvas, n) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.n = n;
        this.cellSize = 30;
        this.margin = 15;
        this.currentAnimation = null;
        this.animationFrameId = null;
    }

    setBoardSize(n) {
        this.n = n;
    }

    drawBoard(board, historyMoves, hintPos, me) {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        const rect = this.canvas.getBoundingClientRect();
        const parentWidth = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 0;
        let maxSize = rect.width || Math.min(450, parentWidth - 12);
        
        if (maxSize <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        const targetWidth = Math.round(maxSize * dpr);
        
        if (this.canvas.width !== targetWidth || this.canvas.height !== targetWidth) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetWidth;
        }
        
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.clearRect(0, 0, maxSize, maxSize);
        
        this.cellSize = maxSize / (this.n + 0.5); 
        this.margin = this.cellSize * 0.75;

        this.ctx.strokeStyle = "#4a2f18";
        this.ctx.lineWidth = 1;

        // Grid
        for (let i = 0; i < this.n; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.margin, this.margin + i * this.cellSize);
            this.ctx.lineTo(maxSize - this.margin, this.margin + i * this.cellSize);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(this.margin + i * this.cellSize, this.margin);
            this.ctx.lineTo(this.margin + i * this.cellSize, maxSize - this.margin);
            this.ctx.stroke();
        }
        
        // Coordinates
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = `bold ${this.cellSize * 0.45}px 'Times New Roman', serif`;
        
        for (let i = 0; i < this.n; i++) {
            let letter = String.fromCharCode(65 + i);
            let num = (this.n - i).toString();
            let cx = this.margin + i * this.cellSize;
            let cy = this.margin + i * this.cellSize;
            let textPos = this.margin * 0.35;
            
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            this.ctx.fillText(letter, cx, textPos + 1); 
            this.ctx.fillText(num, textPos + 1, cy + 1);    
            
            this.ctx.fillStyle = "rgba(60, 30, 10, 0.85)";
            this.ctx.fillText(letter, cx, textPos);
            this.ctx.fillText(num, textPos, cy);
        }

        // Star points
        let stars = [];
        if (this.n === 15) stars = [[3,3], [11,3], [3,11], [11,11], [7,7]];
        else if (this.n === 13) stars = [[3,3], [9,3], [3,9], [9,9], [6,6]];
        else if (this.n === 11) stars = [[2,2], [8,2], [2,8], [8,8], [5,5]];
        this.ctx.fillStyle = "#4a2f18";
        for(let star of stars) {
            this.ctx.beginPath();
            this.ctx.arc(this.margin + star[0] * this.cellSize, this.margin + star[1] * this.cellSize, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        }

        // Pieces
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (board[i][j] === 0) continue;
                if (this.currentAnimation && this.currentAnimation.x === i && this.currentAnimation.y === j) continue;
                this.drawChess(i, j, board[i][j] === 1);
            }
        }
        
        // Animation
        let needsNextFrame = false;
        if (this.currentAnimation) {
            let now = performance.now();
            let progress = (now - this.currentAnimation.start) / this.currentAnimation.duration;
            
            if (progress >= 1) {
                this.drawChess(this.currentAnimation.x, this.currentAnimation.y, this.currentAnimation.role === 1);
                this.currentAnimation = null;
            } else {
                let ease = this.easeOutQuint(progress);
                let animOpts = {
                    offsetY: -30 * (1 - ease),
                    scale: 1 + 0.15 * (1 - ease),
                    shadowOffset: 2 + 8 * (1 - ease),
                    shadowAlphaMult: 0.5 + 0.5 * ease,
                    globalAlpha: ease
                };
                
                this.ctx.save();
                this.ctx.globalAlpha = animOpts.globalAlpha;
                this.drawChess(this.currentAnimation.x, this.currentAnimation.y, this.currentAnimation.role === 1, animOpts);
                this.ctx.restore();
                needsNextFrame = true;
            }
        }
        
        // Hint
        if (hintPos) {
            this.drawHint(hintPos, me);
            needsNextFrame = true;
        }
        
        if (needsNextFrame) {
            this.animationFrameId = requestAnimationFrame(() => this.drawBoard(board, historyMoves, hintPos, me));
        }

        // Last move marker
        if(historyMoves.length > 0) {
            let lastMove = historyMoves[historyMoves.length - 1];
            this.drawLastMoveMarker(lastMove.x || lastMove.r, lastMove.y || lastMove.c);
        }
    }

    drawChess(i, j, isBlack, animOpts = null) {
        const baseX = this.margin + i * this.cellSize;
        const baseY = this.margin + j * this.cellSize;
        let radius = this.cellSize / 2 * 0.85;
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
        
        this.ctx.beginPath();
        this.ctx.arc(shadowX, shadowY, radius * shadowSpread, 0, 2 * Math.PI);
        const shadowGrad = this.ctx.createRadialGradient(shadowX, shadowY, radius * 0.3, shadowX, shadowY, radius * shadowSpread);
        shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        
        const gradient = this.ctx.createRadialGradient(x - radius/3, y - radius/3, radius/5, x, y, radius);
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
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        this.ctx.beginPath();
        if(this.ctx.ellipse) {
            this.ctx.ellipse(x - radius/3.5, y - radius/3.5, radius/2.5, radius/4.5, Math.PI / 4, 0, 2 * Math.PI);
        } else {
            this.ctx.arc(x - radius/3.5, y - radius/3.5, radius/3, 0, 2 * Math.PI); 
        }
        const highlight = this.ctx.createRadialGradient(x - radius/3.5, y - radius/3.5, 0, x - radius/3.5, y - radius/3.5, radius/2.5);
        if(isBlack) {
            highlight.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
            highlight.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        this.ctx.fillStyle = highlight;
        this.ctx.fill();
        
        if (!isBlack) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * 0.98, 0, 2 * Math.PI);
            const bottomReflect = this.ctx.createRadialGradient(x + radius/2.5, y + radius/2.5, 0, x, y, radius);
            bottomReflect.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
            bottomReflect.addColorStop(1, 'rgba(255, 255, 255, 0)');
            this.ctx.fillStyle = bottomReflect;
            this.ctx.fill();
        }
    }

    drawHint(hintPos, me) {
        let time = performance.now();
        let elapsed = time - hintPos.start;
        let entranceDuration = 400; 
        let entranceProgress = Math.min(elapsed / entranceDuration, 1);
        let ease = this.easeOutQuint(entranceProgress);
        let pulse = (Math.sin(time / 200) + 1) / 2; 
        
        let cx = this.margin + hintPos.x * this.cellSize;
        let cy = this.margin + hintPos.y * this.cellSize;
        
        this.ctx.save();
        let glowRadius = this.cellSize * 1.2 * ease; 
        let glow = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        glow.addColorStop(0, `rgba(243, 156, 18, ${(0.6 + 0.4 * pulse) * ease})`); 
        glow.addColorStop(0.4, `rgba(243, 156, 18, ${(0.2 + 0.2 * pulse) * ease})`); 
        glow.addColorStop(1, 'rgba(243, 156, 18, 0)');
        this.ctx.fillStyle = glow;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, glowRadius, 0, 2*Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = `rgba(255, 200, 50, ${(0.8 + 0.2 * pulse) * ease})`;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, this.cellSize * 0.15 * ease, 0, 2*Math.PI);
        this.ctx.fill();

        this.ctx.globalAlpha = (0.5 + 0.3 * pulse) * ease; 
        let animOpts = {
            offsetY: -30 * (1 - ease) + (-8 + 3 * pulse) * ease, 
            scale: 1 + 0.15 * (1 - ease) + 0.08 * ease,             
            shadowAlphaMult: 0.8 * ease     
        };
        this.drawChess(hintPos.x, hintPos.y, me, animOpts);
        this.ctx.restore();
    }

    drawLastMoveMarker(i, j) {
        const x = this.margin + i * this.cellSize;
        const y = this.margin + j * this.cellSize;
        this.ctx.fillStyle = "#e74c3c";
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.cellSize * 0.15, 0, 2*Math.PI);
        this.ctx.fill();
    }

    easeOutQuint(x) {
        return 1 - Math.pow(1 - x, 5);
    }

    animateMove(i, j, role) {
        this.currentAnimation = {
            x: i,
            y: j,
            role: role,
            start: performance.now(),
            duration: 400 
        };
    }
}
