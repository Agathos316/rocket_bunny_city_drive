import { Game } from './game.js';

function showFatal(error) {
  const box = document.getElementById('fatal');
  if (!box) return;
  box.hidden = false;
  box.replaceChildren();
  const title = document.createElement('b');
  title.textContent = 'Rocket Bunny City Drive could not start';
  const hint = document.createElement('span');
  hint.textContent = 'This game needs a browser with WebGL enabled, and must be opened from a web server (not as a file).';
  const detail = document.createElement('code');
  detail.textContent = String((error && error.message) || error);
  box.append(title, hint, detail);
}

try {
  const game = new Game({ parent: document.body });
  game.start();
  window.rocketBunny = { game };   // handy for debugging in the console
} catch (error) {
  console.error(error);
  showFatal(error);
}
