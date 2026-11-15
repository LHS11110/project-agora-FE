import assert from 'node:assert/strict';
import test from 'node:test';
import { SOUND_CUE_PATTERNS, playSoundCue, resetSoundCueState } from '../src/canvas/audio/soundEffects.js';

function installMockAudioContext(state = 'running') {
  const oscillators = [];
  const gains = [];
  let resumed = 0;

  class MockAudioContext {
    constructor() {
      this.state = state;
      this.currentTime = 1.0;
      this.destination = {};
    }
    resume() {
      resumed += 1;
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime() {} },
        connect() {},
        disconnect() {},
        start(t) { osc.startedAt = t; },
        stop(t) { osc.stoppedAt = t; },
      };
      oscillators.push(osc);
      return osc;
    }
    createGain() {
      const gain = {
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
      gains.push(gain);
      return gain;
    }
  }

  const prevAudio = globalThis.AudioContext;
  const prevWindow = globalThis.window;
  const events = [];
  globalThis.AudioContext = MockAudioContext;
  globalThis.window = {
    dispatchEvent(event) { events.push(event); },
  };
  const prevCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  };

  return {
    oscillators,
    gains,
    events,
    get resumed() { return resumed; },
    restore() {
      resetSoundCueState();
      globalThis.AudioContext = prevAudio;
      globalThis.window = prevWindow;
      globalThis.CustomEvent = prevCustomEvent;
    },
  };
}

test('playSoundCue plays all four cues, deduplicates rapid bursts, and handles suspended context', async () => {
  const mock = installMockAudioContext('running');
  try {
    assert.equal(playSoundCue('voice_join', { now: 1000 }), true);
    assert.equal(playSoundCue('voice_join', { now: 1020 }), false); // within cooldown
    assert.equal(playSoundCue('screen_share_start', { now: 1030 }), true);
    assert.equal(playSoundCue('voice_leave', { now: 1100 }), true);
    assert.equal(playSoundCue('mention', { now: 1200 }), true);
    assert.equal(playSoundCue('unknown_cue', { now: 1300 }), false);

    const expectedOscillators = SOUND_CUE_PATTERNS.voice_join.length
      + SOUND_CUE_PATTERNS.screen_share_start.length
      + SOUND_CUE_PATTERNS.voice_leave.length
      + SOUND_CUE_PATTERNS.mention.length;
    assert.equal(mock.oscillators.length, expectedOscillators);
    assert.deepEqual(mock.events.map(e => e.detail.cue), ['voice_join', 'screen_share_start', 'voice_leave', 'mention']);

    resetSoundCueState();
    const suspended = installMockAudioContext('suspended');
    try {
      assert.equal(playSoundCue('mention', { now: 5000 }), true);
      assert.equal(suspended.resumed, 1);
      await Promise.resolve();
      assert.equal(suspended.oscillators.length, SOUND_CUE_PATTERNS.mention.length);
    } finally {
      suspended.restore();
    }
  } finally {
    mock.restore();
  }
});
