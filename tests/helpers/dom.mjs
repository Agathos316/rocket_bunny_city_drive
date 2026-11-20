// A just-enough browser stand-in so the game's modules can run under Node: canvases (for procedural textures),
// getElementById, window events and requestAnimationFrame. Install it BEFORE importing any game module.

export function installDom() {
  const ctx2d = new Proxy({}, {
    get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  });

  const makeElement = (id) => {
    const handlers = {};
    const classes = new Set();
    return {
      id, style: {}, hidden: false, value: '', textContent: '', width: 0, height: 0,
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
      getContext: () => ctx2d,
      addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
      removeEventListener() {},
      dispatch(type, event = {}) { (handlers[type] || []).forEach((fn) => fn(event)); },
      blur() {}, appendChild() {}, replaceChildren() {}, append() {},
    };
  };

  const elements = new Map();
  const document = {
    createElement: (tag) => makeElement(tag),
    getElementById: (id) => { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
    body: makeElement('body'),
  };

  const windowHandlers = {};
  Object.assign(globalThis, {
    document,
    window: globalThis,
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: (type, fn) => { (windowHandlers[type] ||= []).push(fn); },
    removeEventListener() {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });

  return {
    elements,
    fireWindow: (type, event = {}) => (windowHandlers[type] || []).forEach((fn) => fn(event)),
  };
}

/** A renderer that draws nothing, with just the surface the game touches. */
export function fakeRenderer() {
  return { domElement: {}, shadowMap: { needsUpdate: false }, renders: 0, setSize() {}, render() { this.renders++; } };
}

/** An input source the test controls directly. */
export function fakeInput() {
  return { value: { throttle: 0, brake: 0, steer: 0 }, read() { return this.value; }, dispose() {} };
}
