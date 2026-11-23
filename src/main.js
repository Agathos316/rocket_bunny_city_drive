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

/** Turn the loading screen into the title screen and resolve on the first key press (or click/tap). */
function waitForKey() {
  const el = document.getElementById('loading');
  if (!el) return Promise.resolve();
  el.classList.add('ready');
  el.setAttribute('aria-live', 'off');
  return new Promise((resolve) => {
    const go = (e) => {
      if (e.type === 'keydown' && (e.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key))) return;
      e.preventDefault();
      e.stopImmediatePropagation();   // the key that starts the game must not also act in the game (e.g. Space opening the selector)
      window.removeEventListener('keydown', go, true);
      el.removeEventListener('pointerdown', go, true);
      resolve();
    };
    window.addEventListener('keydown', go, true);
    el.addEventListener('pointerdown', go, true);
  });
}

try {
  await loadCarLibrary();   // every vehicle is a model file, so the game cannot start until they have loaded
  const game = new Game({ parent: document.body });
  window.rocketBunny = { game };   // handy for debugging in the console
  await waitForKey();              // title screen: the game starts when the player presses a key
  game.audio.unlock();             // the key press above was the user gesture browsers require for sound
  game.start();
  hideLoading();
} catch (error) {
  console.error(error);
  document.getElementById('loading')?.remove();
  showFatal(error);
}
