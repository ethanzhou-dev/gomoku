export class Renderer {
    constructor(bgCanvas, fgCanvas, n) {
        this.bgCanvas = bgCanvas;
        this.bgCtx = bgCanvas.getContext('2d');
        this.fgCanvas = fgCanvas;
        this.fgCtx = fgCanvas.getContext('2d');
        this.n = n;
        this.cellSize = 30;
        this.margin = 15;
        this.currentAnimation = null;
        this.animationFrameId = null;
        this.lastTargetWidth = 0; // track for resize
    }

    setBoardSize(n) {
        this.n = n;
        this.lastTargetWidth = 0; // force redraw bg
    }

    drawBoard(board, historyMoves, hintPos, me) {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        const rect = this.bgCanvas.getBoundingClientRect();
        const parentWidth = this.bgCanvas.parentElement ? this.bgCanvas.parentElement.clientWidth : 0;
        let maxSize = rect.width || Math.min(450, parentWidth - 12);
        
        if (maxSize <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        const targetWidth = Math.round(maxSize * dpr);
        
        let needsBgRedraw = false;
        if (this.bgCanvas.width !== targetWidth || this.lastTargetWidth !== targetWidth) {
            this.bgCanvas.width = targetWidth;
            this.bgCanvas.height = targetWidth;
            this.fgCanvas.width = targetWidth;
            this.fgCanvas.height = targetWidth;
            this.lastTargetWidth = targetWidth;
            needsBgRedraw = true;
        }
        
        this.cellSize = maxSize / (this.n + 0.5); 
        this.margin = this.cellSize * 0.75;

        if (needsBgRedraw) {
            this.drawBackground(dpr, maxSize);
        }

        // Always redraw pieces on foreground
        this.fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.fgCtx.clearRect(0, 0, maxSize, maxSize);
        
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
                
                this.fgCtx.save();
                this.fgCtx.globalAlpha = animOpts.globalAlpha;
                this.drawChess(this.currentAnimation.x, this.currentAnimation.y, this.currentAnimation.role === 1, animOpts);
                this.fgCtx.restore();
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

    drawBackground(dpr, maxSize) {
        this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.bgCtx.clearRect(0, 0, maxSize, maxSize);
        
        this.bgCtx.strokeStyle = "#4a2f18";
        this.bgCtx.lineWidth = 1;

        // Grid
        for (let i = 0; i < this.n; i++) {
            this.bgCtx.beginPath();
            this.bgCtx.moveTo(this.margin, this.margin + i * this.cellSize);
            this.bgCtx.lineTo(maxSize - this.margin, this.margin + i * this.cellSize);
            this.bgCtx.stroke();

            this.bgCtx.beginPath();
            this.bgCtx.moveTo(this.margin + i * this.cellSize, this.margin);
            this.bgCtx.lineTo(this.margin + i * this.cellSize, maxSize - this.margin);
            this.bgCtx.stroke();
        }
        
        // Coordinates
        this.bgCtx.textAlign = "center";
        this.bgCtx.textBaseline = "middle";
        this.bgCtx.font = `bold ${this.cellSize * 0.45}px 'Times New Roman', serif`;
        
        for (let i = 0; i < this.n; i++) {
            let letter = String.fromCharCode(65 + i);
            let num = (this.n - i).toString();
            let cx = this.margin + i * this.cellSize;
            let cy = this.margin + i * this.cellSize;
            let textPos = this.margin * 0.35;
            
            this.bgCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
            this.bgCtx.fillText(letter, cx, textPos + 1); 
            this.bgCtx.fillText(num, textPos + 1, cy + 1);    
            
            this.bgCtx.fillStyle = "rgba(60, 30, 10, 0.85)";
            this.bgCtx.fillText(letter, cx, textPos);
            this.bgCtx.fillText(num, textPos, cy);
        }

        // Star points
        let stars = [];
        if (this.n === 15) stars = [[3,3], [11,3], [3,11], [11,11], [7,7]];
        else if (this.n === 13) stars = [[3,3], [9,3], [3,9], [9,9], [6,6]];
        else if (this.n === 11) stars = [[2,2], [8,2], [2,8], [8,8], [5,5]];
        this.bgCtx.fillStyle = "#4a2f18";
        for(let star of stars) {
            this.bgCtx.beginPath();
            this.bgCtx.arc(this.margin + star[0] * this.cellSize, this.margin + star[1] * this.cellSize, 3, 0, 2 * Math.PI);
            this.bgCtx.fill();
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
        
        this.fgCtx.beginPath();
        this.fgCtx.arc(shadowX, shadowY, radius * shadowSpread, 0, 2 * Math.PI);
        const shadowGrad = this.fgCtx.createRadialGradient(shadowX, shadowY, radius * 0.3, shadowX, shadowY, radius * shadowSpread);
        shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.fgCtx.fillStyle = shadowGrad;
        this.fgCtx.fill();

        this.fgCtx.beginPath();
        this.fgCtx.arc(x, y, radius, 0, 2 * Math.PI);
        
        const gradient = this.fgCtx.createRadialGradient(x - radius/3, y - radius/3, radius/5, x, y, radius);
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
        
        this.fgCtx.fillStyle = gradient;
        this.fgCtx.fill();
        
        this.fgCtx.beginPath();
        if(this.fgCtx.ellipse) {
            this.fgCtx.ellipse(x - radius/3.5, y - radius/3.5, radius/2.5, radius/4.5, Math.PI / 4, 0, 2 * Math.PI);
        } else {
            this.fgCtx.arc(x - radius/3.5, y - radius/3.5, radius/3, 0, 2 * Math.PI); 
        }
        const highlight = this.fgCtx.createRadialGradient(x - radius/3.5, y - radius/3.5, 0, x - radius/3.5, y - radius/3.5, radius/2.5);
        if(isBlack) {
            highlight.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
            highlight.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        this.fgCtx.fillStyle = highlight;
        this.fgCtx.fill();
        
        if (!isBlack) {
            this.fgCtx.beginPath();
            this.fgCtx.arc(x, y, radius * 0.98, 0, 2 * Math.PI);
            const bottomReflect = this.fgCtx.createRadialGradient(x + radius/2.5, y + radius/2.5, 0, x, y, radius);
            bottomReflect.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
            bottomReflect.addColorStop(1, 'rgba(255, 255, 255, 0)');
            this.fgCtx.fillStyle = bottomReflect;
            this.fgCtx.fill();
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
        
        this.fgCtx.save();
        let glowRadius = this.cellSize * 1.2 * ease; 
        let glow = this.fgCtx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        glow.addColorStop(0, `rgba(243, 156, 18, ${(0.6 + 0.4 * pulse) * ease})`); 
        glow.addColorStop(0.4, `rgba(243, 156, 18, ${(0.2 + 0.2 * pulse) * ease})`); 
        glow.addColorStop(1, 'rgba(243, 156, 18, 0)');
        this.fgCtx.fillStyle = glow;
        this.fgCtx.beginPath();
        this.fgCtx.arc(cx, cy, glowRadius, 0, 2*Math.PI);
        this.fgCtx.fill();

        this.fgCtx.fillStyle = `rgba(255, 200, 50, ${(0.8 + 0.2 * pulse) * ease})`;
        this.fgCtx.beginPath();
        this.fgCtx.arc(cx, cy, this.cellSize * 0.15 * ease, 0, 2*Math.PI);
        this.fgCtx.fill();

        this.fgCtx.globalAlpha = (0.5 + 0.3 * pulse) * ease; 
        let animOpts = {
            offsetY: -30 * (1 - ease) + (-8 + 3 * pulse) * ease, 
            scale: 1 + 0.15 * (1 - ease) + 0.08 * ease,             
            shadowAlphaMult: 0.8 * ease     
        };
        this.drawChess(hintPos.x, hintPos.y, me, animOpts);
        this.fgCtx.restore();
    }

    drawLastMoveMarker(i, j) {
        const x = this.margin + i * this.cellSize;
        const y = this.margin + j * this.cellSize;
        this.fgCtx.fillStyle = "#e74c3c";
        this.fgCtx.beginPath();
        this.fgCtx.arc(x, y, this.cellSize * 0.15, 0, 2*Math.PI);
        this.fgCtx.fill();
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
