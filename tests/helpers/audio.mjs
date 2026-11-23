// A stand-in for the Web Audio API that records what the game asked for, so audio logic can be tested under Node.
// It cannot tell you what anything SOUNDS like; the browser test measures the real output for that.

class Param {
  constructor(value = 0) { this.value = value; this.history = []; }
  setValueAtTime(v) { this.value = v; this.history.push(['set', v]); }
  setTargetAtTime(v) { this.value = v; this.history.push(['target', v]); }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
  cancelScheduledValues() {}
}

class Node {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.connected = []; this.started = false; this.stopped = false; }
  connect(n) { this.connected.push(n); return n; }
  disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

export function fakeAudioContext() {
  const ctx = {
    currentTime: 0, sampleRate: 8000, state: 'suspended', destination: { kind: 'destination' },
    nodes: [], resumed: 0, suspended: 0, closed: false,
    resume() { this.state = 'running'; this.resumed++; return Promise.resolve(); },
    suspend() { this.state = 'suspended'; this.suspended++; return Promise.resolve(); },
    close() { this.closed = true; },
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createGain() { return track(new Node(ctx, 'gain'), { gain: new Param(1) }); },
    createOscillator() { return track(new Node(ctx, 'osc'), { frequency: new Param(440), type: 'sine' }); },
    createBufferSource() { return track(new Node(ctx, 'noise'), { playbackRate: new Param(1), loop: false, buffer: null }); },
    createBiquadFilter() { return track(new Node(ctx, 'filter'), { frequency: new Param(350), Q: new Param(1), type: 'lowpass' }); },
    createAnalyser() { return track(new Node(ctx, 'analyser'), { fftSize: 2048 }); },
  };
  function track(node, props) { Object.assign(node, props); ctx.nodes.push(node); return node; }
  ctx.count = (kind) => ctx.nodes.filter((n) => n.kind === kind).length;
  return ctx;
}

/** Records one-shot calls the game makes on its audio manager. */
export function recordingAudio() {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls, enabled: true, volume: 0.6, paused: false, voice: null,
    setPaused(on) { this.paused = on; }, setVoice(name) { this.voice = name; },
    unlock: rec('unlock'), update: rec('update'), crash: rec('crash'), thud: rec('thud'),
    bump: rec('bump'), landing: rec('landing'), setEnabled: rec('setEnabled'), setVolume: rec('setVolume'), dispose() {},
    count: (name) => calls.filter((c) => c[0] === name).length,
  };
}
