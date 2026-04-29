import { Game } from './game.js';

window.addEventListener('load', () => {
    window.game = new Game();
    document.body.classList.add('loaded');
});
