import {
  buildBoss1Level,
  buildCastle1Level,
  buildCloud1Level,
  buildDesert1Level,
  buildLevel1,
  buildLevel2,
  buildSecretPowerupLevel,
  buildTrainingLevel,
} from "../levels/index.js";
import { createWorldData } from "../worlds/index.js";

export function createGameCore() {
  "use strict";
  const CONFIG = Object.freeze({
    gameWidth: 960,
    gameHeight: 544,
    tileSize: 32,

    gravity: 2400,

    // Movement feel (adds “Mario-like” polish).
    walkSpeed: 240,
    runSpeed: 330,
    accelGround: 2200,
    accelAir: 1400,
    decelGround: 2800,
    decelAir: 1600,
    coyoteTime: 0.12,
    jumpBuffer: 0.12,
    jumpForce: 900,
    bounceForce: 520,
    shortHopCut: 0.45,

    // Enemies.
    enemySpeed: 92,
    enemyFastSpeed: 118,

    // Game structure.
    timeLimit: 120,
    startingLives: 3,
    coinsPer1Up: 20,
    fallDeathPadding: 360,

    // Scoring.
    coinValue: 100,
    superCoinValue: 1000,
    powerValue: 1000,
    levelClearValue: 2000,
    timeBonusPerSecond: 50,

    // Power / damage.
    powerInvincibleSeconds: 1.15,
    hurtInvincibleSeconds: 1.4,
    bossStompInvincibleSeconds: 2.0,
    wingDurationSeconds: 30,
    wingGravityScale: 0.34,
    wingRiseSpeed: 390,
    wingGlideFallSpeed: 88,
    wingDiveFallSpeed: 250,
    wingLiftAccel: 1700,
    vineClimbSpeed: 170,
    vineJumpDetachSeconds: 0.2,
  });

  const STORAGE = Object.freeze({
    settings: "calgame_settings_v1",
    best: "calgame_best_v1",
    progress: "calgame_progress_v1",
  });

  const canvas = document.getElementById("game");
  if (!canvas) throw new Error('Missing <canvas id="game">');

  kaboom({
    canvas,
    width: CONFIG.gameWidth,
    height: CONFIG.gameHeight,
    crisp: true,
    background: [135, 206, 235],
  });

  const { WORLD_THEMES, WORLD_MAPS, worldIdForLevel } = createWorldData({
    rgb,
    vec2,
  });

  const GAMEPAD_STICK_DEADZONE = 0.35;

  // Kaboom gamepad names come from vendor/kaboom.js default mapping:
  // south/east/west/north, dpad-*, ltrigger/rtrigger, lshoulder/rshoulder, start/select.
  const INPUT = Object.freeze({
    left: {
      keys: ["left", "a"],
      buttons: ["dpad-left"],
      sticks: [{ stick: "left", axis: "x", dir: -1 }],
    },
    right: {
      keys: ["right", "d"],
      buttons: ["dpad-right"],
      sticks: [{ stick: "left", axis: "x", dir: 1 }],
    },
    up: {
      keys: ["up", "w"],
      buttons: ["dpad-up"],
      sticks: [{ stick: "left", axis: "y", dir: -1 }],
    },
    down: {
      keys: ["down", "s"],
      buttons: ["dpad-down"],
      sticks: [{ stick: "left", axis: "y", dir: 1 }],
    },
    jump: {
      keys: ["space", "up", "w"],
      // Cross / Circle + triggers.
      buttons: ["south", "east", "ltrigger", "rtrigger"],
    },
    run: {
      keys: ["shift"],
      // Square / Triangle + shoulders.
      buttons: ["west", "north", "lshoulder", "rshoulder"],
    },
    // "Options" is exposed as "start" on standard mappings.
    confirm: {
      keys: ["enter"],
      // Confirm can also use jump-style buttons on gamepad.
      buttons: ["start", "south", "east", "ltrigger", "rtrigger"],
    },
    restart: {
      keys: ["r"],
      buttons: ["select"],
    },
    pause: {
      keys: ["escape", "p"],
      buttons: ["start"],
    },
    mute: {
      keys: ["m"],
      buttons: ["home"],
    },
  });

  const SECRET_POWERUP_LEVEL_ID = "secretPowerup";

  function stickBindingDown(stickBinding) {
    if (!stickBinding) return false;
    const stickName = stickBinding.stick ?? "left";
    const axisName = stickBinding.axis === "y" ? "y" : "x";
    const axis = getGamepadStick(stickName);
    const value = axisName === "y" ? axis.y : axis.x;
    const threshold = stickBinding.threshold ?? GAMEPAD_STICK_DEADZONE;
    return stickBinding.dir < 0 ? value <= -threshold : value >= threshold;
  }

  function anyInputDown(binding) {
    const keys = binding?.keys ?? [];
    if (keys.some((k) => isKeyDown(k))) return true;

    const buttons = binding?.buttons ?? [];
    if (buttons.some((b) => isGamepadButtonDown(b))) return true;

    const sticks = binding?.sticks ?? [];
    return sticks.some((stick) => stickBindingDown(stick));
  }

  function onAnyInputPress(binding, fn) {
    const cancels = [];
    const stickDownState = [];

    for (const key of binding?.keys ?? []) {
      cancels.push(onKeyPress(key, () => fn(key)));
    }
    for (const button of binding?.buttons ?? []) {
      cancels.push(onGamepadButtonPress(button, () => fn(button)));
    }
    for (const stick of binding?.sticks ?? []) {
      stickDownState.push(false);
      const stickIndex = stickDownState.length - 1;
      cancels.push(
        onUpdate(() => {
          const down = stickBindingDown(stick);
          const wasDown = stickDownState[stickIndex];
          if (down && !wasDown) fn(stick.stick ?? "left");
          stickDownState[stickIndex] = down;
        }),
      );
    }

    return {
      cancel() {
        cancels.forEach((c) => c.cancel());
      },
    };
  }

  function onAnyInputRelease(binding, fn) {
    const cancels = [];
    const stickDownState = [];

    for (const key of binding?.keys ?? []) {
      cancels.push(onKeyRelease(key, () => fn(key)));
    }
    for (const button of binding?.buttons ?? []) {
      cancels.push(onGamepadButtonRelease(button, () => fn(button)));
    }
    for (const stick of binding?.sticks ?? []) {
      stickDownState.push(false);
      const stickIndex = stickDownState.length - 1;
      cancels.push(
        onUpdate(() => {
          const down = stickBindingDown(stick);
          const wasDown = stickDownState[stickIndex];
          if (!down && wasDown) fn(stick.stick ?? "left");
          stickDownState[stickIndex] = down;
        }),
      );
    }

    return {
      cancel() {
        cancels.forEach((c) => c.cancel());
      },
    };
  }

  function approach(current, target, delta) {
    if (current < target) return Math.min(current + delta, target);
    if (current > target) return Math.max(current - delta, target);
    return target;
  }

  function loadStored(key, fallback) {
    const stored = getData(key, null);
    return stored ?? fallback;
  }

  const settings = loadStored(STORAGE.settings, { audio: true });
  function saveSettings() {
    setData(STORAGE.settings, settings);
  }

  const audioBus = (() => {
    const ctx = audioCtx;
    const master = ctx.createGain();
    const bgm = ctx.createGain();
    const sfx = ctx.createGain();

    master.gain.value = settings.audio ? 0.9 : 0.0;
    bgm.gain.value = 0.22;
    sfx.gain.value = 0.65;

    bgm.connect(master);
    sfx.connect(master);
    master.connect(ctx.destination);

    return { ctx, master, bgm, sfx };
  })();

  const best = loadStored(STORAGE.best, {
    bestScore: 0,
    bestCoins: 0,
    bestTime: null,
  });
  function saveBest() {
    setData(STORAGE.best, best);
  }

  const progress = loadStored(STORAGE.progress, {
    completedLevelIds: [],
    lastSelectedLevelId: "training",
  });
  if (!Array.isArray(progress.completedLevelIds))
    progress.completedLevelIds = [];
  if (typeof progress.lastSelectedLevelId !== "string")
    progress.lastSelectedLevelId = "training";
  function saveProgress() {
    setData(STORAGE.progress, progress);
  }

  function hasCompletedLevel(levelId) {
    return progress.completedLevelIds.includes(levelId);
  }

  function markLevelCompleted(levelId) {
    if (hasCompletedLevel(levelId)) return;
    progress.completedLevelIds.push(levelId);
    saveProgress();
  }

  function setLastSelectedLevelId(levelId) {
    if (typeof levelId !== "string" || levelId.length === 0) return;
    progress.lastSelectedLevelId = levelId;
    saveProgress();
  }

  function maybeUpdateBest({ score, coins, completionSeconds }) {
    let changed = false;
    if (score > best.bestScore) {
      best.bestScore = score;
      changed = true;
    }
    if (coins > best.bestCoins) {
      best.bestCoins = coins;
      changed = true;
    }
    if (
      typeof completionSeconds === "number" &&
      (best.bestTime === null || completionSeconds < best.bestTime)
    ) {
      best.bestTime = completionSeconds;
      changed = true;
    }
    if (changed) saveBest();
  }

  function ensureAudioReady() {
    if (!settings.audio) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {}
  }

  const SILENT_GAIN = 0.0001;

  function holdParamAtTime(param, when) {
    if (typeof param.cancelAndHoldAtTime === "function") {
      param.cancelAndHoldAtTime(when);
      return;
    }
    param.cancelScheduledValues(when);
    param.setValueAtTime(param.value, when);
  }

  function rampGainTo(gainParam, target, seconds = 0.04) {
    const now = audioCtx.currentTime;
    holdParamAtTime(gainParam, now);
    gainParam.linearRampToValueAtTime(target, now + Math.max(0.005, seconds));
  }

  function playTone({
    type = "square",
    freq = 440,
    freqEnd = null,
    duration = 0.12,
    gain = 0.04,
  }) {
    if (!settings.audio) return;
    ensureAudioReady();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, freqEnd),
        now + duration,
      );
    }

    amp.gain.setValueAtTime(SILENT_GAIN, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(SILENT_GAIN, gain), now + 0.01);
    amp.gain.exponentialRampToValueAtTime(SILENT_GAIN, now + duration);

    osc.connect(amp);
    amp.connect(audioBus.sfx);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playJingle(notes) {
    if (!settings.audio) return;
    ensureAudioReady();
    const ctx = audioCtx;
    const start = ctx.currentTime + 0.01;

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const t0 = start + n.t;
      const t1 = t0 + n.d;

      osc.type = n.type ?? "square";
      osc.frequency.setValueAtTime(n.f, t0);
      if (n.f2 != null)
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, n.f2), t1);

      amp.gain.setValueAtTime(SILENT_GAIN, t0);
      amp.gain.exponentialRampToValueAtTime(
        Math.max(SILENT_GAIN, n.g ?? 0.04),
        t0 + 0.01,
      );
      amp.gain.exponentialRampToValueAtTime(SILENT_GAIN, t1);

      osc.connect(amp);
      amp.connect(audioBus.sfx);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }

  function playSfx(name) {
    switch (name) {
      case "ui":
        playTone({
          type: "triangle",
          freq: 660,
          freqEnd: 990,
          duration: 0.07,
          gain: 0.035,
        });
        break;
      case "jump":
        playTone({
          type: "triangle",
          freq: 620,
          freqEnd: 240,
          duration: 0.13,
          gain: 0.045,
        });
        break;
      case "coin":
        playTone({
          type: "square",
          freq: 1200,
          freqEnd: 1800,
          duration: 0.08,
          gain: 0.04,
        });
        break;
      case "bump":
        playTone({
          type: "square",
          freq: 220,
          freqEnd: 170,
          duration: 0.09,
          gain: 0.035,
        });
        break;
      case "stomp":
        playTone({
          type: "square",
          freq: 140,
          freqEnd: 90,
          duration: 0.11,
          gain: 0.04,
        });
        break;
      case "hurt":
        playTone({
          type: "sawtooth",
          freq: 260,
          freqEnd: 70,
          duration: 0.18,
          gain: 0.05,
        });
        break;
      case "power":
        playJingle([
          { t: 0.0, f: 392, d: 0.08, type: "triangle", g: 0.04 },
          { t: 0.1, f: 523, d: 0.08, type: "triangle", g: 0.04 },
          { t: 0.2, f: 784, d: 0.1, type: "triangle", g: 0.045 },
        ]);
        break;
      case "powerdown":
        playJingle([
          { t: 0.0, f: 784, d: 0.08, type: "triangle", g: 0.04 },
          { t: 0.1, f: 523, d: 0.08, type: "triangle", g: 0.04 },
          { t: 0.2, f: 392, d: 0.1, type: "triangle", g: 0.04 },
        ]);
        break;
      case "1up":
        playJingle([
          { t: 0.0, f: 523, d: 0.08, type: "triangle", g: 0.04 },
          { t: 0.1, f: 659, d: 0.08, type: "triangle", g: 0.04 },
          { t: 0.2, f: 784, d: 0.12, type: "triangle", g: 0.05 },
        ]);
        break;
      case "clear":
        playJingle([
          { t: 0.0, f: 523, d: 0.1, type: "square", g: 0.04 },
          { t: 0.12, f: 659, d: 0.1, type: "square", g: 0.04 },
          { t: 0.24, f: 784, d: 0.12, type: "square", g: 0.045 },
          { t: 0.38, f: 988, d: 0.18, type: "square", g: 0.05 },
        ]);
        break;
      case "spring":
        playTone({
          type: "triangle",
          freq: 330,
          freqEnd: 880,
          duration: 0.12,
          gain: 0.05,
        });
        break;
      default:
        break;
    }
  }

  function midiToFreq(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  const N = null;

  const BGM_TRACKS = Object.freeze({
    overworld: {
      bpm: 168,
      stepsPerBeat: 2, // 8th notes
      // Upbeat chiptune loop (original melody; inspired by classic platformers).
      melody: [
        // 16 bars (8 steps per bar)
        76,
        N,
        79,
        81,
        79,
        76,
        74,
        72,
        74,
        N,
        79,
        83,
        81,
        79,
        76,
        74,
        72,
        N,
        76,
        81,
        79,
        76,
        74,
        72,
        77,
        79,
        81,
        N,
        79,
        77,
        76,
        74,

        72,
        74,
        76,
        N,
        74,
        72,
        71,
        72,
        74,
        N,
        79,
        81,
        83,
        81,
        79,
        76,
        76,
        79,
        84,
        N,
        83,
        81,
        79,
        76,
        74,
        N,
        76,
        79,
        81,
        79,
        76,
        72,

        77,
        N,
        81,
        84,
        86,
        84,
        83,
        81,
        76,
        N,
        79,
        83,
        84,
        83,
        81,
        79,
        76,
        79,
        83,
        N,
        81,
        79,
        76,
        74,
        72,
        N,
        76,
        81,
        84,
        81,
        79,
        76,

        77,
        79,
        81,
        84,
        81,
        79,
        77,
        76,
        74,
        N,
        79,
        83,
        79,
        76,
        74,
        72,
        76,
        79,
        84,
        83,
        81,
        79,
        76,
        74,
        72,
        N,
        74,
        76,
        79,
        76,
        74,
        72,
      ],
      harmony: [
        // chord tones / light counterline
        64,
        N,
        67,
        N,
        64,
        N,
        67,
        N,
        67,
        N,
        71,
        N,
        67,
        N,
        71,
        N,
        69,
        N,
        72,
        N,
        69,
        N,
        72,
        N,
        65,
        N,
        69,
        N,
        65,
        N,
        69,
        N,

        62,
        N,
        65,
        N,
        62,
        N,
        65,
        N,
        67,
        N,
        71,
        N,
        67,
        N,
        71,
        N,
        64,
        N,
        67,
        N,
        64,
        N,
        72,
        N,
        64,
        N,
        67,
        N,
        64,
        N,
        67,
        N,

        65,
        N,
        69,
        N,
        65,
        N,
        69,
        N,
        67,
        N,
        71,
        N,
        67,
        N,
        71,
        N,
        67,
        N,
        71,
        N,
        67,
        N,
        71,
        N,
        69,
        N,
        72,
        N,
        69,
        N,
        72,
        N,

        65,
        N,
        69,
        N,
        65,
        N,
        69,
        N,
        67,
        N,
        71,
        N,
        67,
        N,
        71,
        N,
        64,
        N,
        67,
        N,
        64,
        N,
        67,
        N,
        67,
        N,
        71,
        N,
        67,
        N,
        71,
        N,
      ],
      bass: [
        // bass mostly on strong beats
        48,
        N,
        48,
        N,
        48,
        N,
        50,
        N,
        43,
        N,
        43,
        N,
        43,
        N,
        45,
        N,
        45,
        N,
        45,
        N,
        45,
        N,
        43,
        N,
        41,
        N,
        41,
        N,
        41,
        N,
        43,
        N,

        50,
        N,
        50,
        N,
        50,
        N,
        48,
        N,
        43,
        N,
        43,
        N,
        43,
        N,
        45,
        N,
        48,
        N,
        48,
        N,
        48,
        N,
        47,
        N,
        48,
        N,
        48,
        N,
        48,
        N,
        50,
        N,

        41,
        N,
        41,
        N,
        41,
        N,
        43,
        N,
        43,
        N,
        43,
        N,
        43,
        N,
        45,
        N,
        40,
        N,
        40,
        N,
        40,
        N,
        43,
        N,
        45,
        N,
        45,
        N,
        45,
        N,
        43,
        N,

        41,
        N,
        41,
        N,
        41,
        N,
        43,
        N,
        43,
        N,
        43,
        N,
        43,
        N,
        45,
        N,
        48,
        N,
        48,
        N,
        48,
        N,
        50,
        N,
        43,
        N,
        43,
        N,
        43,
        N,
        48,
        N,
      ],
      arp: [
        // subtle sparkle (very low gain)
        72, 76, 79, 76, 72, 76, 79, 76, 71, 74, 79, 74, 71, 74, 79, 74, 69, 72,
        76, 72, 69, 72, 76, 72, 69, 72, 77, 72, 69, 72, 77, 72,

        67, 71, 74, 71, 67, 71, 74, 71, 71, 74, 79, 74, 71, 74, 79, 74, 72, 76,
        79, 76, 72, 76, 84, 79, 72, 76, 79, 76, 72, 76, 79, 76,

        69, 72, 77, 72, 69, 72, 77, 72, 71, 74, 79, 74, 71, 74, 79, 74, 67, 71,
        76, 71, 67, 71, 76, 71, 69, 72, 76, 72, 69, 72, 76, 72,

        69, 72, 77, 72, 69, 72, 77, 72, 71, 74, 79, 74, 71, 74, 79, 74, 72, 76,
        79, 76, 72, 76, 79, 76, 71, 74, 79, 74, 71, 74, 79, 74,
      ],
    },
  });

  function toMinorColor(midi) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    // Lower major color tones to minor (E->Eb, A->Ab, B->Bb) for darker mood.
    if (pc === 4 || pc === 9 || pc === 11) return midi - 1;
    return midi;
  }

  const SPECIAL_BGM_TRACKS = Object.freeze({
    "overworld-castle": Object.freeze({
      bpm: 136,
      stepsPerBeat: BGM_TRACKS.overworld.stepsPerBeat,
      melody: BGM_TRACKS.overworld.melody.map((m) => toMinorColor(m)),
      harmony: BGM_TRACKS.overworld.harmony.map((m) =>
        m == null ? N : toMinorColor(m) - 12,
      ),
      bass: BGM_TRACKS.overworld.bass.map((m) =>
        m == null ? N : toMinorColor(m) - 2,
      ),
      arp: BGM_TRACKS.overworld.arp.map((m, i) =>
        m == null || i % 2 === 1 ? N : toMinorColor(m) - 12,
      ),
      melodyType: "triangle",
      harmonyType: "sawtooth",
      bassType: "square",
      arpType: "sine",
      melodyGain: 0.026,
      harmonyGain: 0.0085,
      bassGain: 0.023,
      arpGain: 0.0035,
      durFactor: 0.96,
      accentStrength: 0.32,
      groove: "tense",
    }),
  });

  function createBgmPlayer() {
    const ctx = audioBus.ctx;
    const out = audioBus.bgm;
    const baseGain = out.gain.value;

    let desiredTrack = null;
    let playingTrack = null;
    let intervalId = null;
    let nextStepTime = 0;
    let step = 0;

    const lookaheadMs = 25;
    const scheduleAhead = 0.35;
    const scheduleSafety = 0.012;

    function getTrack(trackName) {
      if (!trackName) return null;
      return BGM_TRACKS[trackName] ?? SPECIAL_BGM_TRACKS[trackName] ?? null;
    }

    function stepDurationSeconds(track) {
      const beat = 60 / track.bpm;
      return beat / track.stepsPerBeat;
    }

    const noiseBuffer = (() => {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = rand(-1, 1);
      return buf;
    })();

    function sanitizeStart(time, dur) {
      const start = Math.max(time, ctx.currentTime + 0.002);
      const duration = Math.max(0.015, dur);
      return { start, end: start + duration };
    }

    function scheduleOsc({ type, midi, time, dur, gain, freqEnd = null }) {
      if (!settings.audio) return;
      if (midi == null) return;

      const { start, end } = sanitizeStart(time, dur);
      const attack = Math.min(0.01, Math.max(0.004, (end - start) * 0.3));
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();

      osc.type = type;
      const f0 = midiToFreq(midi);
      osc.frequency.setValueAtTime(f0, start);
      if (freqEnd != null) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, freqEnd),
          end,
        );
      }

      amp.gain.setValueAtTime(SILENT_GAIN, start);
      amp.gain.exponentialRampToValueAtTime(
        Math.max(SILENT_GAIN, gain),
        start + attack,
      );
      amp.gain.exponentialRampToValueAtTime(SILENT_GAIN, end);

      osc.connect(amp);
      amp.connect(out);
      osc.start(start);
      osc.stop(end + 0.03);
    }

    function scheduleNoise({
      time,
      dur,
      gain,
      type = "highpass",
      freq = 6500,
      q = 0.9,
    }) {
      const { start, end } = sanitizeStart(time, dur);
      const attack = Math.min(0.008, Math.max(0.003, (end - start) * 0.3));
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(freq, start);
      filter.Q.setValueAtTime(q, start);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(SILENT_GAIN, start);
      amp.gain.exponentialRampToValueAtTime(
        Math.max(SILENT_GAIN, gain),
        start + attack,
      );
      amp.gain.exponentialRampToValueAtTime(SILENT_GAIN, end);

      src.connect(filter);
      filter.connect(amp);
      amp.connect(out);

      src.start(start);
      src.stop(end + 0.03);
    }

    function scheduleKick(time, gain = 0.026) {
      // Tiny 8-bit “kick” thump.
      const { start, end } = sanitizeStart(time, 0.075);
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, start);
      osc.frequency.exponentialRampToValueAtTime(55, start + 0.06);
      amp.gain.setValueAtTime(SILENT_GAIN, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(SILENT_GAIN, gain), start + 0.008);
      amp.gain.exponentialRampToValueAtTime(SILENT_GAIN, end);
      osc.connect(amp);
      amp.connect(out);
      osc.start(start);
      osc.stop(end + 0.02);
    }

    function scheduleSnare(time, gain = 0.018) {
      scheduleNoise({
        time,
        dur: 0.095,
        gain,
        type: "bandpass",
        freq: 1800,
        q: 0.7,
      });
    }

    function scheduleHat(time, gain = 0.006) {
      scheduleNoise({
        time,
        dur: 0.03,
        gain,
        type: "highpass",
        freq: 7600,
        q: 0.9,
      });
    }

    function schedulerTick() {
      if (!settings.audio) return;
      if (!playingTrack) return;

      const track = getTrack(playingTrack);
      if (!track) return;
      const stepDur = stepDurationSeconds(track);
      const steps = track.melody.length;
      const scheduleFrom = ctx.currentTime + scheduleSafety;

      if (nextStepTime < scheduleFrom - stepDur) {
        const skippedSteps = Math.floor((scheduleFrom - nextStepTime) / stepDur);
        if (skippedSteps > 0) {
          step += skippedSteps;
          nextStepTime += skippedSteps * stepDur;
        }
      }
      if (nextStepTime < scheduleFrom) nextStepTime = scheduleFrom;

      while (nextStepTime < ctx.currentTime + scheduleAhead) {
        const i = step % steps;
        const t = nextStepTime;
        const dur = stepDur * (track.durFactor ?? 0.92);
        const beatStep = i % 8;
        const rawAccent = beatStep === 0 ? 1.18 : beatStep === 4 ? 1.08 : 1.0;
        const accentStrength = track.accentStrength ?? 1.0;
        const accent = 1 + (rawAccent - 1) * accentStrength;

        scheduleOsc({
          type: track.melodyType ?? "square",
          midi: track.melody[i],
          time: t,
          dur,
          gain: (track.melodyGain ?? 0.03) * accent,
        });
        scheduleOsc({
          type: track.harmonyType ?? "square",
          midi: track.harmony[i],
          time: t,
          dur,
          gain: track.harmonyGain ?? 0.011,
        });
        scheduleOsc({
          type: track.bassType ?? "triangle",
          midi: track.bass[i],
          time: t,
          dur,
          gain: track.bassGain ?? 0.02,
        });
        if (track.arp) {
          scheduleOsc({
            type: track.arpType ?? "triangle",
            midi: track.arp[i],
            time: t,
            dur: stepDur * (track.arpDurFactor ?? 0.55),
            gain: track.arpGain ?? 0.007,
          });
        }

        if (track.groove === "tense") {
          // Sparse, suspenseful pulse for castle variation.
          if (beatStep === 0 || beatStep === 5) scheduleKick(t, 0.021);
          if (beatStep === 4) scheduleSnare(t, 0.012);
          if (beatStep % 2 === 1) scheduleHat(t, beatStep === 7 ? 0.005 : 0.0036);
        } else {
          // Classic platformer groove: kick on 1/3, snare on 2/4, hats on 8ths.
          if (beatStep === 0 || beatStep === 4) scheduleKick(t);
          if (beatStep === 2 || beatStep === 6) scheduleSnare(t);
          scheduleHat(t, beatStep % 2 === 1 ? 0.007 : 0.0055);
        }

        step += 1;
        nextStepTime += stepDur;
      }
    }

    function start(trackName) {
      if (!settings.audio) return;
      if (!trackName) return;
      if (!getTrack(trackName)) return;
      if (playingTrack === trackName && intervalId) return;
      const restartFade = 0.06;
      stop(restartFade);

      desiredTrack = trackName;
      playingTrack = trackName;
      step = 0;
      const fadeInAt = ctx.currentTime + restartFade;
      nextStepTime = fadeInAt + 0.02;

      out.gain.setValueAtTime(0, fadeInAt);
      out.gain.linearRampToValueAtTime(baseGain, fadeInAt + 0.12);

      intervalId = setInterval(schedulerTick, lookaheadMs);
      schedulerTick();
    }

    function stop(fadeSeconds = 0.12) {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      const now = ctx.currentTime;
      holdParamAtTime(out.gain, now);
      out.gain.linearRampToValueAtTime(0, now + Math.max(0.02, fadeSeconds));

      playingTrack = null;
      step = 0;
    }

    function requestTrack(trackName) {
      desiredTrack = trackName;
      refresh();
    }

    function refresh() {
      if (!settings.audio || !desiredTrack) {
        stop();
        return;
      }
      start(desiredTrack);
    }

    return {
      requestTrack,
      stop,
      refresh,
      get desiredTrack() {
        return desiredTrack;
      },
    };
  }

  const bgm = createBgmPlayer();

  function toggleAudio() {
    settings.audio = !settings.audio;
    saveSettings();

    if (settings.audio) ensureAudioReady();

    rampGainTo(audioBus.master.gain, settings.audio ? 0.9 : 0.0, 0.04);
    bgm.refresh();

    playSfx("ui");
  }

  function registerCommonHotkeys({ characterId = "cal" } = {}) {
    onAnyInputPress(INPUT.mute, () => {
      ensureAudioReady();
      toggleAudio();
    });

    for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      onKeyPress(key, () => {
        const ctrlDown = isKeyDown("ctrl") || isKeyDown("control");
        if (!ctrlDown || !isKeyDown("shift")) return;

        const bossLevelId = `boss${key}`;
        if (!LEVELS[bossLevelId]) return;

        ensureAudioReady();
        playSfx("ui");
        go("game", { characterId, levelId: bossLevelId });
      });
    }
  }

  const ASSETS = Object.freeze({
    cal: "assets/cal.svg",
    robotRed: "assets/robot-red.svg",
    robotBlue: "assets/robot-blue.svg",
    robotPink: "assets/robot-pink.svg",
    ground: "assets/ground.svg",
    groundCastle: "assets/ground-castle.svg",
    groundDesert: "assets/ground-desert.svg",
    groundCloud: "assets/ground-cloud.svg",
    block: "assets/block.svg",
    blockCastle: "assets/block-castle.svg",
    question: "assets/question.svg",
    usedBlock: "assets/used-block.svg",
    coin: "assets/coin.svg",
    superCoin: "assets/super-coin.svg",
    battery: "assets/battery.svg",
    wing: "assets/wing.svg",
    vine: "assets/vine.svg",
    spring: "assets/spring.svg",
    heart: "assets/heart.svg",
    boss: "assets/ufo-boss.svg",
    lava: "assets/lava.svg",
    fire: "assets/fire.svg",
    doorCastle: "assets/door-castle.svg",
    pole: "assets/pole.svg",
    flagRobot: "assets/flag-robot.svg",
    flagC: "assets/flag-c.svg",
  });

  loadSprite("cal", ASSETS.cal);
  loadSprite("robot-red", ASSETS.robotRed);
  loadSprite("robot-blue", ASSETS.robotBlue);
  loadSprite("robot-pink", ASSETS.robotPink);
  loadSprite("ground", ASSETS.ground);
  loadSprite("ground-castle", ASSETS.groundCastle);
  loadSprite("ground-desert", ASSETS.groundDesert);
  loadSprite("ground-cloud", ASSETS.groundCloud);
  loadSprite("block", ASSETS.block);
  loadSprite("block-castle", ASSETS.blockCastle);
  loadSprite("question", ASSETS.question);
  loadSprite("used-block", ASSETS.usedBlock);
  loadSprite("coin", ASSETS.coin);
  loadSprite("super-coin", ASSETS.superCoin);
  loadSprite("battery", ASSETS.battery);
  loadSprite("wing", ASSETS.wing);
  loadSprite("vine", ASSETS.vine);
  loadSprite("spring", ASSETS.spring);
  loadSprite("heart", ASSETS.heart);
  loadSprite("ufo-boss", ASSETS.boss);
  loadSprite("lava", ASSETS.lava);
  loadSprite("fire", ASSETS.fire);
  loadSprite("door-castle", ASSETS.doorCastle);
  loadSprite("pole", ASSETS.pole);
  loadSprite("flag-robot", ASSETS.flagRobot);
  loadSprite("flag-c", ASSETS.flagC);

  const CHARACTERS = Object.freeze([
    {
      id: "cal",
      displayName: "CAL",
      description: "Jump, stomp, collect coins, and flip the flag to a big C.",
      sprite: "cal",
    },
  ]);

  const LEVELS = Object.freeze({
    training: {
      id: "training",
      title: "TRAINING GROVE",
      buildMap: buildTrainingLevel,
      timeLimit: 240,
      nextLevelId: "level1",
      music: "overworld",
      tutorialSteps: [
        { x: 0, text: "Move with Arrows / A-D. Hold Shift to RUN." },
        {
          x: 10 * CONFIG.tileSize,
          text: "Jump with Space. Tap for a short hop.",
        },
        {
          x: 16 * CONFIG.tileSize,
          text: "Collect coins (o). Every 20 coins = 1UP.",
        },
        {
          x: 18 * CONFIG.tileSize,
          text: "Hit ? blocks from below to pop coins.",
        },
        {
          x: 28 * CONFIG.tileSize,
          text: "Hit * to spawn a battery. Collect it to get CHARGED.",
        },
        {
          x: 32 * CONFIG.tileSize,
          text: "While CHARGED (until hit): break B bricks and survive 1 hit.",
        },
        {
          x: 44 * CONFIG.tileSize,
          text: "Bounce on the spring (^) to reach high coins.",
        },
        {
          x: 64 * CONFIG.tileSize,
          text: "Moving platforms (~) help cross pits safely.",
        },
        { x: 82 * CONFIG.tileSize, text: "Stomp robots by landing on top!" },
        {
          x: 104 * CONFIG.tileSize,
          text: "Touch the goal pole to flip the flag to a C!",
        },
      ],
    },
    level1: {
      id: "level1",
      title: "GRASSY PLAINS",
      buildMap: buildLevel1,
      timeLimit: CONFIG.timeLimit,
      nextLevelId: "level2",
      music: "overworld",
      tutorialSteps: null,
    },
    level2: {
      id: "level2",
      title: "ROBO FRONTIER",
      buildMap: buildLevel2,
      timeLimit: CONFIG.timeLimit + 30,
      nextLevelId: "castle1",
      music: "overworld",
      tutorialSteps: null,
    },
    castle1: {
      id: "castle1",
      title: "IRON CITADEL",
      buildMap: buildCastle1Level,
      timeLimit: CONFIG.timeLimit + 35,
      nextLevelId: "boss1",
      music: "overworld-castle",
      levelStyle: "castle",
      doorTargetLevelId: "boss1",
      tutorialSteps: null,
    },
    boss1: {
      id: "boss1",
      title: "ROBO OVERLORD",
      buildMap: buildBoss1Level,
      timeLimit: CONFIG.timeLimit + 40,
      nextLevelId: "desert1",
      music: "overworld-castle",
      levelStyle: "castle",
      isBossLevel: true,
      tutorialSteps: null,
    },
    desert1: {
      id: "desert1",
      title: "SUNSCORCH RUN",
      buildMap: buildDesert1Level,
      timeLimit: CONFIG.timeLimit + 25,
      nextLevelId: "cloud1",
      music: "overworld",
      tutorialSteps: null,
    },
    cloud1: {
      id: "cloud1",
      title: "SKY VINE ASCENT",
      buildMap: buildCloud1Level,
      timeLimit: CONFIG.timeLimit + 40,
      nextLevelId: null,
      music: "overworld",
      levelStyle: "cloud",
      tutorialSteps: [
        {
          x: 18 * CONFIG.tileSize,
          text: "Wing blocks (W) grant 30s of flight. Hold jump to rise, release to glide.",
        },
        {
          x: 60 * CONFIG.tileSize,
          text: "Leafy vines (v) are climbable. Use Up/Down to move between cloud lanes.",
        },
        {
          x: 110 * CONFIG.tileSize,
          text: "Crumble clouds (c) vanish briefly after you land. Keep moving.",
        },
        {
          x: 150 * CONFIG.tileSize,
          text: "Red robots fly in this world. Time their swoops before committing.",
        },
      ],
    },
    [SECRET_POWERUP_LEVEL_ID]: {
      id: SECRET_POWERUP_LEVEL_ID,
      title: "SECRET POWER STASH",
      buildMap: buildSecretPowerupLevel,
      timeLimit: 70,
      nextLevelId: null,
      music: "overworld",
      tutorialSteps: null,
      isSecretBonus: true,
    },
  });

  const run = {
    lives: CONFIG.startingLives,
    coins: 0,
    score: 0,
    power: "normal", // "normal" | "charged" | "winged"
    wingSecondsLeft: 0,
  };

  function resetRun() {
    run.lives = CONFIG.startingLives;
    run.coins = 0;
    run.score = 0;
    run.power = "normal";
    run.wingSecondsLeft = 0;
  }

  function addFloatingText(message, worldPos, col = rgb(255, 255, 255)) {
    add([
      text(message, { size: 18 }),
      pos(worldPos),
      anchor("center"),
      color(col.r, col.g, col.b),
      opacity(0.95),
      lifespan(0.65, { fade: 0.35 }),
      move(UP, 60),
      z(2000),
    ]);
  }

  function addScore(points, worldPos) {
    run.score += points;
    if (worldPos) addFloatingText(`+${points}`, worldPos, rgb(255, 255, 255));
  }

  function awardOneUp(worldPos, label = "1UP!") {
    run.lives += 1;
    playSfx("1up");
    if (worldPos) addFloatingText(label, worldPos, rgb(52, 199, 89));
  }

  function addCoin(worldPos) {
    run.coins += 1;
    run.score += CONFIG.coinValue;
    playSfx("coin");
    if (worldPos)
      addFloatingText(`+${CONFIG.coinValue}`, worldPos, rgb(255, 214, 10));

    if (run.coins > 0 && run.coins % CONFIG.coinsPer1Up === 0) {
      awardOneUp(worldPos);
    }
  }

  function setPower(power, worldPos) {
    if (run.power === power) return;
    run.power = power;
    if (power === "charged") {
      playSfx("power");
      if (worldPos) addFloatingText("CHARGED!", worldPos, rgb(52, 199, 89));
      return;
    }
    if (power === "winged") {
      playSfx("power");
      if (worldPos) addFloatingText("WINGED!", worldPos, rgb(170, 235, 255));
      return;
    }
    if (power === "normal") {
      run.wingSecondsLeft = 0;
      playSfx("powerdown");
      if (worldPos) addFloatingText("POWER DOWN", worldPos, rgb(255, 100, 100));
    } else {
      playSfx("ui");
    }
  }

  function centerBoxText(content, y, size = 22, opts = {}) {
    return add([
      text(content, {
        size,
        width: CONFIG.gameWidth - 80,
        lineSpacing: 6,
        ...opts,
      }),
      pos(CONFIG.gameWidth / 2, y),
      anchor("center"),
      fixed(),
    ]);
  }

  function addFadeIn(duration = 0.22) {
    const overlay = add([
      rect(width(), height()),
      pos(0, 0),
      color(0, 0, 0),
      opacity(1),
      fixed(),
      z(9999),
    ]);
    tween(1, 0, duration, (o) => (overlay.opacity = o), easings.linear).then(
      () => destroy(overlay),
    );
  }

  function drawStars() {
    // Simple animated “special” title background.
    const stars = [];
    for (let i = 0; i < 110; i++) {
      stars.push({
        x: rand(0, width()),
        y: rand(0, height()),
        r: rand(1, 2.2),
        s: rand(12, 28),
        o: rand(0.25, 0.85),
      });
    }

    onDraw(() => {
      drawRect({
        pos: vec2(0),
        width: width(),
        height: height(),
        color: rgb(0, 0, 0),
        fixed: true,
      });
      for (const st of stars) {
        const twinkle = 0.6 + 0.4 * Math.sin(time() * 2 + st.x * 0.02);
        drawCircle({
          pos: vec2(st.x, st.y),
          radius: st.r,
          color: rgb(255, 255, 255),
          opacity: st.o * twinkle,
          fixed: true,
        });
        st.y += dt() * st.s;
        if (st.y > height() + 5) {
          st.y = -5;
          st.x = rand(0, width());
        }
      }
    });
  }

  return {
    CONFIG,
    STORAGE,
    SECRET_POWERUP_LEVEL_ID,
    WORLD_THEMES,
    WORLD_MAPS,
    worldIdForLevel,
    GAMEPAD_STICK_DEADZONE,
    INPUT,
    stickBindingDown,
    anyInputDown,
    onAnyInputPress,
    onAnyInputRelease,
    approach,
    settings,
    saveSettings,
    best,
    saveBest,
    progress,
    saveProgress,
    hasCompletedLevel,
    markLevelCompleted,
    setLastSelectedLevelId,
    maybeUpdateBest,
    ensureAudioReady,
    playSfx,
    bgm,
    toggleAudio,
    registerCommonHotkeys,
    ASSETS,
    CHARACTERS,
    LEVELS,
    run,
    resetRun,
    addFloatingText,
    addScore,
    awardOneUp,
    addCoin,
    setPower,
    centerBoxText,
    addFadeIn,
    drawStars,
  };
}
