import { Game } from './game.js';
import { loadCarLibrary } from './vehicles/carLibrary.js';

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

const hideLoading = () => {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('done');
  setTimeout(() => el.remove(), 700);
};

try {
  await loadCarLibrary();   // every vehicle is a model file, so the game cannot start until they have loaded
  const game = new Game({ parent: document.body });
  game.start();
  window.rocketBunny = { game };   // handy for debugging in the console
  hideLoading();
} catch (error) {
  console.error(error);
  document.getElementById('loading')?.remove();
  showFatal(error);
}
