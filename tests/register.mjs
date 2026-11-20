// Loaded with `node --import ./tests/register.mjs`. Lets Node resolve `three` the way the browser's import map does.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
