export class UI {
    constructor() {
        this.elements = {
            pvpTypeSelector: document.getElementById('pvp-type-selector'),
            modalNickname: document.getElementById('nickname-modal'),
            nicknameInput: document.getElementById('nickname-input'),
            btnSaveNickname: document.getElementById('btn-save-nickname'),
            btnCancelNickname: document.getElementById('btn-cancel-nickname'),
            modalRoomList: document.getElementById('room-list-modal'),
            roomListContainer: document.getElementById('room-list-container'),
            btnCreateRoom: document.getElementById('btn-create-room'),
            btnRefreshRooms: document.getElementById('btn-refresh-rooms'),
            btnLeaveRooms: document.getElementById('btn-leave-rooms'),
            currentNicknameSpan: document.getElementById('current-nickname'),
            btnChangeNickname: document.getElementById('btn-change-nickname'),
            modalWaiting: document.getElementById('waiting-modal'),
            waitingRoomIdSpan: document.getElementById('waiting-room-id'),
            btnLeaveWaiting: document.getElementById('btn-leave-waiting'),
            modalAlert: document.getElementById('alert-modal'),
            alertMsg: document.getElementById('alert-msg'),
            btnAlertOk: document.getElementById('btn-alert-ok'),
            alertTitle: document.getElementById('alert-title'),
            opponentInfo: document.getElementById('opponent-info'),
            opponentNameElem: document.getElementById('opponent-name'),
            opponentStatsElem: document.getElementById('opponent-stats'),
            myInfo: document.getElementById('my-info'),
            myNameElem: document.getElementById('my-name'),
            myStatsElem: document.getElementById('my-stats'),
            canvas: document.getElementById('chessBoard'),
            statusDiv: document.getElementById('status'),
            btnRestart: document.getElementById('btn-restart'),
            btnUndo: document.getElementById('btn-undo'),
            btnHint: document.getElementById('btn-hint'),
            btnHome: document.getElementById('btn-home'),
            btnSettings: document.getElementById('btn-settings'),
            modalSettings: document.getElementById('settings-modal'),
            btnCloseSettings: document.getElementById('btn-close-settings'),
            chkForbidden: document.getElementById('chk-forbidden'),
            modeRadios: document.getElementsByName('mode'),
            diffSelector: document.getElementById('diff-selector'),
            diffRadios: document.getElementsByName('difficulty'),
            sizeRadios: document.getElementsByName('boardSize'),
            playerColorRadios: document.getElementsByName('playerColor'),
            pvpTypeRadios: document.getElementsByName('pvpType')
        };
    }

    showAlert(msg, title = "提示") {
        if(this.elements.alertTitle) this.elements.alertTitle.innerText = title;
        if(this.elements.alertMsg) this.elements.alertMsg.innerText = msg;
        if(this.elements.modalAlert) this.elements.modalAlert.style.display = 'flex';
    }

    hideAlert() {
        if(this.elements.modalAlert) this.elements.modalAlert.style.display = 'none';
    }

    updateStatus(text, color = "#2c3e50") {
        if(this.elements.statusDiv) {
            this.elements.statusDiv.innerText = text;
            this.elements.statusDiv.style.color = color;
        }
    }

    showModal(modalId) {
        const modal = this.elements[modalId] || document.getElementById(modalId);
        if(modal) modal.style.display = 'flex';
    }

    hideModal(modalId) {
        const modal = this.elements[modalId] || document.getElementById(modalId);
        if(modal) modal.style.display = 'none';
    }

    renderRoomList(rooms, onJoin) {
        if(!this.elements.roomListContainer) return;
        this.elements.roomListContainer.innerHTML = '';
        if (rooms.length === 0) {
            this.elements.roomListContainer.innerHTML = '<div style="text-align: center; color: #555; padding: 20px;">暂无房间，去创建一个吧！</div>';
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
            this.elements.roomListContainer.appendChild(div);
        });
        
        this.elements.roomListContainer.querySelectorAll('.join-btn').forEach(btn => {
            btn.onclick = () => onJoin(btn.getAttribute('data-id'));
        });
    }

    syncModeUI() {
        const checkedMode = Array.from(this.elements.modeRadios).find(r => r.checked)?.value;
        if (checkedMode) {
            const isPvE = checkedMode === 'pve';
            if(this.elements.diffSelector) this.elements.diffSelector.style.display = isPvE ? 'flex' : 'none';
            if(this.elements.pvpTypeSelector) this.elements.pvpTypeSelector.style.display = isPvE ? 'none' : 'flex';
        }
    }

    getSettings() {
        return {
            playerColor: parseInt(Array.from(this.elements.playerColorRadios).find(r => r.checked)?.value || 1),
            forbidden: this.elements.chkForbidden.checked,
            boardSize: parseInt(Array.from(this.elements.sizeRadios).find(r => r.checked)?.value || 15),
            mode: Array.from(this.elements.modeRadios).find(r => r.checked)?.value,
            difficulty: parseInt(Array.from(this.elements.diffRadios).find(r => r.checked)?.value || 4),
            pvpType: Array.from(this.elements.pvpTypeRadios).find(r => r.checked)?.value
        };
    }

    updatePlayerInfo(myInfo, opponentInfo) {
        if (myInfo) {
            this.elements.myInfo.style.display = 'flex';
            this.elements.myNameElem.innerText = myInfo.name;
            this.elements.myStatsElem.innerText = `${myInfo.stats.total}局 ${myInfo.stats.total > 0 ? Math.round(myInfo.stats.win/myInfo.stats.total*100) : 0}%胜`;
        } else {
            this.elements.myInfo.style.display = 'none';
        }

        if (opponentInfo) {
            this.elements.opponentInfo.style.display = 'flex';
            this.elements.opponentNameElem.innerText = opponentInfo.name;
            this.elements.opponentStatsElem.innerText = `${opponentInfo.stats.total}局 ${opponentInfo.stats.total > 0 ? Math.round(opponentInfo.stats.win/opponentInfo.stats.total*100) : 0}%胜`;
        } else {
            this.elements.opponentInfo.style.display = 'none';
        }
    }
}
