import { Game } from './game.js';

window.addEventListener('load', () => {
    window.game = new Game();
    document.documentElement.style.opacity = '1';
});
