import {
  buildBoss1Level,
  buildCastle1Level,
  buildCloud1Level,
  buildDesert1Level,
  buildLevel1,
  buildLevel2,
  buildSecretPowerupLevel,
  buildTrainingLevel,
} from "./levels/index.js";
import { createWorldData } from "./worlds/index.js";

(() => {
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

  scene("intro", () => {
    registerCommonHotkeys();
    bgm.requestTrack(null);
    drawStars();
    addFadeIn();

    centerBoxText("CAL vs. The Robo-Empire", 120, 36, { align: "center" });
    centerBoxText(
      [
        "My name is Cal.",
        "A Bad Robot is capturing things.",
        "I must save the day!",
        "",
        "Press Enter to continue.",
      ].join("\n"),
      260,
      22,
      { align: "center" },
    );

    centerBoxText("Tip: Hold Shift to RUN • Press M to mute", 440, 16, {
      align: "center",
      opacity: 0.85,
    });

    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      go("characterSelect");
    });
  });

  scene("characterSelect", () => {
    registerCommonHotkeys();
    bgm.requestTrack(null);
    add([rect(width(), height()), pos(0, 0), color(0, 0, 0), fixed()]);
    addFadeIn();

    centerBoxText("Choose Your Hero", 110, 30);

    const selected = 0;
    const character = CHARACTERS[selected];

    add([
      sprite(character.sprite),
      pos(CONFIG.gameWidth / 2, 210),
      anchor("center"),
      scale(4),
      fixed(),
    ]);

    centerBoxText(character.displayName, 330, 26, { align: "center" });
    centerBoxText(character.description, 370, 18, { align: "center" });

    const bestTimeLine =
      best.bestTime === null ? "—" : `${best.bestTime.toFixed(1)}s (fastest)`;
    centerBoxText(
      `Best Score: ${best.bestScore}   Best Coins: ${best.bestCoins}   Best Time: ${bestTimeLine}`,
      420,
      16,
      { align: "center", opacity: 0.9 },
    );
    centerBoxText("Press Enter to open the World Map", 470, 18, {
      align: "center",
    });

    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      resetRun();
      go("worldMap", {
        characterId: character.id,
        worldId: "world1",
        focusLevelId: "training",
      });
    });
  });

  scene("worldMap", (data) => {
    const characterId = data?.characterId ?? "cal";
    registerCommonHotkeys({ characterId });
    addFadeIn();

    const worldId =
      data?.worldId ??
      (typeof data?.focusLevelId === "string"
        ? worldIdForLevel(data.focusLevelId)
        : null) ??
      "world1";
    const world = WORLD_MAPS[worldId] ?? WORLD_MAPS.world1;
    const theme = WORLD_THEMES[world.themeId] ?? WORLD_THEMES.grassy;
    const worldMapLabel = document.getElementById("world-map-label");
    if (worldMapLabel) worldMapLabel.textContent = `World Map: ${world.title}`;

    ensureAudioReady();
    bgm.requestTrack("overworld");

    function getNode(levelId) {
      return world.nodes.find((n) => n.levelId === levelId) ?? null;
    }

    function isUnlocked(node) {
      if (!node) return false;
      const requires = Array.isArray(node.requires) ? node.requires : [];
      return requires.every((id) => hasCompletedLevel(id));
    }

    function isCompleted(node) {
      return !!node && hasCompletedLevel(node.levelId);
    }

    function bestDefaultFocusLevelId() {
      for (const node of world.nodes) {
        if (!isUnlocked(node)) continue;
        if (!isCompleted(node)) return node.levelId;
      }
      return world.startLevelId ?? world.nodes[0]?.levelId ?? "training";
    }

    let selectedLevelId =
      data?.focusLevelId ??
      (typeof progress.lastSelectedLevelId === "string"
        ? progress.lastSelectedLevelId
        : null) ??
      bestDefaultFocusLevelId();

    if (!getNode(selectedLevelId)) selectedLevelId = bestDefaultFocusLevelId();
    setLastSelectedLevelId(selectedLevelId);

    function moveSelection(delta) {
      const idx = world.nodes.findIndex((n) => n.levelId === selectedLevelId);
      const nextIdx = (idx + delta + world.nodes.length) % world.nodes.length;
      selectedLevelId = world.nodes[nextIdx].levelId;
      setLastSelectedLevelId(selectedLevelId);
      playSfx("ui");
    }

    function moveWorld(delta) {
      const ids = Object.keys(WORLD_MAPS);
      if (ids.length <= 1) return;
      const currentIndex = ids.indexOf(world.id);
      if (currentIndex < 0) return;
      const nextWorldId = ids[(currentIndex + delta + ids.length) % ids.length];
      const nextWorld = WORLD_MAPS[nextWorldId];
      if (!nextWorld) return;

      const focusLevelId =
        nextWorld.startLevelId ?? nextWorld.nodes[0]?.levelId ?? "training";
      go("worldMap", {
        characterId,
        worldId: nextWorldId,
        focusLevelId,
      });
    }

    function quadBezier(p0, p1, p2, t) {
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      return p0.scale(a).add(p1.scale(b)).add(p2.scale(c));
    }

    function drawGrassyMapBackground() {
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [theme.skyTop, theme.skyBottom],
        fixed: true,
      });

      const cloudCol = rgb(255, 255, 255);
      drawEllipse({
        pos: vec2(160, 120),
        radiusX: 54,
        radiusY: 20,
        color: cloudCol,
        opacity: 0.9,
        fixed: true,
      });
      drawEllipse({
        pos: vec2(420, 82),
        radiusX: 70,
        radiusY: 24,
        color: cloudCol,
        opacity: 0.86,
        fixed: true,
      });
      drawEllipse({
        pos: vec2(740, 130),
        radiusX: 58,
        radiusY: 20,
        color: cloudCol,
        opacity: 0.88,
        fixed: true,
      });

      drawCircle({
        pos: vec2(140, 360),
        radius: 160,
        color: theme.hillDark,
        fixed: true,
      });
      drawCircle({
        pos: vec2(360, 384),
        radius: 190,
        color: theme.hillLight,
        fixed: true,
      });
      drawCircle({
        pos: vec2(720, 372),
        radius: 200,
        color: theme.hillDark,
        fixed: true,
      });
      drawCircle({
        pos: vec2(920, 396),
        radius: 230,
        color: theme.hillLight,
        fixed: true,
      });

      const grassY = 320;
      const dirtY = 440;
      drawRect({
        pos: vec2(0, grassY),
        width: width(),
        height: dirtY - grassY,
        gradient: [theme.grassTop, theme.grassBottom],
        fixed: true,
      });
      drawRect({
        pos: vec2(0, dirtY),
        width: width(),
        height: height() - dirtY,
        gradient: [theme.dirtTop, theme.dirtBottom],
        fixed: true,
      });

      for (let x = 16; x < width(); x += 64) {
        const wobble = Math.sin(time() * 0.8 + x * 0.03) * 3;
        drawRect({
          pos: vec2(x + wobble, grassY - 6),
          width: 18,
          height: 10,
          color: theme.grassTop,
          fixed: true,
        });
      }
    }

    function drawDesertMapBackground() {
      const sceneryDrop = CONFIG.tileSize;

      function drawFlatPyramid({
        centerX,
        baseY,
        width,
        height,
        leftColor,
        rightColor,
      }) {
        const half = width / 2;
        const apex = vec2(centerX, baseY - height);
        const left = vec2(centerX - half, baseY);
        const right = vec2(centerX + half, baseY);
        const mid = vec2(centerX, baseY);

        drawTriangle({
          p1: left,
          p2: apex,
          p3: mid,
          color: leftColor,
          fixed: true,
        });
        drawTriangle({
          p1: mid,
          p2: apex,
          p3: right,
          color: rightColor,
          fixed: true,
        });
        drawLine({
          p1: apex,
          p2: mid,
          width: 2,
          color: rgb(130, 92, 44),
          opacity: 0.45,
          fixed: true,
        });
      }

      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [theme.skyTop, theme.skyBottom],
        fixed: true,
      });

      drawCircle({
        pos: vec2(820, 108),
        radius: 48,
        color: theme.sun,
        opacity: 0.95,
        fixed: true,
      });

      drawFlatPyramid({
        centerX: 250,
        baseY: 460 + sceneryDrop,
        width: 170,
        height: 130,
        leftColor: rgb(202, 150, 80),
        rightColor: rgb(178, 126, 63),
      });
      drawFlatPyramid({
        centerX: 652,
        baseY: 460 + sceneryDrop,
        width: 200,
        height: 160,
        leftColor: rgb(214, 162, 86),
        rightColor: rgb(188, 136, 68),
      });
      drawFlatPyramid({
        centerX: 786,
        baseY: 455 + sceneryDrop,
        width: 132,
        height: 125,
        leftColor: rgb(202, 150, 80),
        rightColor: rgb(178, 126, 63),
      });

      drawCircle({
        pos: vec2(170, 414 + sceneryDrop),
        radius: 170,
        color: theme.duneDark,
        fixed: true,
      });
      drawCircle({
        pos: vec2(430, 430 + sceneryDrop),
        radius: 210,
        color: theme.duneLight,
        fixed: true,
      });
      drawCircle({
        pos: vec2(760, 420 + sceneryDrop),
        radius: 190,
        color: theme.duneDark,
        fixed: true,
      });
      drawCircle({
        pos: vec2(960, 444 + sceneryDrop),
        radius: 220,
        color: theme.duneLight,
        fixed: true,
      });

      const sandBandY = 338;
      drawRect({
        pos: vec2(0, sandBandY),
        width: width(),
        height: height() - sandBandY,
        gradient: [theme.sandTop, theme.sandBottom],
        fixed: true,
      });
    }

    function drawCloudMapBackground() {
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [theme.skyTop, theme.skyBottom],
        fixed: true,
      });

      drawCircle({
        pos: vec2(180, 96),
        radius: 40,
        color: rgb(255, 249, 192),
        opacity: 0.72,
        fixed: true,
      });

      for (let x = 90; x <= width() + 160; x += 210) {
        const y = 124 + Math.sin(time() * 0.5 + x * 0.015) * 7;
        drawEllipse({
          pos: vec2(x - 54, y),
          radiusX: 52,
          radiusY: 16,
          color: rgb(255, 255, 255),
          opacity: 0.82,
          fixed: true,
        });
        drawEllipse({
          pos: vec2(x, y - 10),
          radiusX: 56,
          radiusY: 20,
          color: rgb(255, 255, 255),
          opacity: 0.92,
          fixed: true,
        });
        drawEllipse({
          pos: vec2(x + 54, y),
          radiusX: 52,
          radiusY: 16,
          color: rgb(255, 255, 255),
          opacity: 0.82,
          fixed: true,
        });
      }

      const islandY = 368;
      for (let x = 40; x < width() + 80; x += 160) {
        const lift = Math.sin(time() * 0.8 + x * 0.02) * 3;
        drawRect({
          pos: vec2(x, islandY + lift),
          width: 110,
          height: 18,
          radius: 8,
          color: rgb(252, 252, 255),
          fixed: true,
        });
        drawRect({
          pos: vec2(x + 10, islandY + 16 + lift),
          width: 90,
          height: 11,
          radius: 5,
          color: rgb(212, 232, 255),
          opacity: 0.9,
          fixed: true,
        });
        drawLine({
          p1: vec2(x + 54, islandY + 28 + lift),
          p2: vec2(x + 54, islandY + 108 + lift),
          width: 4,
          color: rgb(74, 170, 92),
          opacity: 0.55,
          fixed: true,
        });
      }
    }

    function drawConnections() {
      for (const c of world.connections) {
        const from = getNode(c.fromLevelId);
        const to = getNode(c.toLevelId);
        if (!from || !to) continue;

        const active = isUnlocked(to);
        const pathCol = active ? theme.pathActive : theme.pathInactive;

        // Soft shadow under path.
        drawLine({
          p1: from.pos.add(2, 2),
          p2: to.pos.add(2, 2),
          width: 8,
          color: theme.nodeShadow,
          opacity: 0.16,
          fixed: true,
        });

        // Dotted curve (SMW-ish).
        const p0 = from.pos;
        const p1 = c.control ?? from.pos.add(to.pos).scale(0.5).add(0, -80);
        const p2 = to.pos;

        const dots = 18;
        for (let i = 0; i <= dots; i++) {
          const t = i / dots;
          const p = quadBezier(p0, p1, p2, t);
          drawCircle({
            pos: p,
            radius: 3.1,
            color: pathCol,
            opacity: active ? 0.95 : 0.55,
            fixed: true,
          });
        }
      }
    }

    onDraw(() => {
      if (theme.mapStyle === "desert") drawDesertMapBackground();
      else if (theme.mapStyle === "cloud") drawCloudMapBackground();
      else drawGrassyMapBackground();
      drawConnections();
    });

    const title = centerBoxText(world.title, 60, 26, { align: "center" });
    title.use(color(theme.textDark.r, theme.textDark.g, theme.textDark.b));

    const stats = centerBoxText(
      `Lives: ${run.lives}   Coins: ${run.coins}   Score: ${run.score}`,
      98,
      16,
      {
        align: "center",
        opacity: 0.92,
      },
    );
    stats.use(color(theme.textDark.r, theme.textDark.g, theme.textDark.b));

    const info = centerBoxText("", 466, 18, { align: "center", opacity: 0.95 });
    info.use(color(theme.textDark.r, theme.textDark.g, theme.textDark.b));

    centerBoxText(
      "Left/Right: Level • Up/Down: World • Enter/Start/Jump: Play • M/Home: Mute",
      506,
      14,
      {
        align: "center",
        opacity: 0.8,
      },
    ).use(color(theme.textDark.r, theme.textDark.g, theme.textDark.b));

    const NODE_RADIUS = 22;

    for (const node of world.nodes) {
      add([
        pos(node.pos),
        fixed(),
        z(2000),
        {
          draw() {
            const unlocked = isUnlocked(node);
            const completed = isCompleted(node);
            const selected = selectedLevelId === node.levelId;

            const baseOpacity = unlocked ? 1 : 0.42;
            const lift = selected ? 2 + Math.sin(time() * 6) * 1.5 : 0;
            const nodePos = this.pos.add(0, -lift);

            // Shadow.
            drawCircle({
              pos: nodePos.add(3, 5),
              radius: NODE_RADIUS + 1,
              color: theme.nodeShadow,
              opacity: 0.22 * baseOpacity,
              fixed: true,
            });

            const lockedFill = rgb(140, 140, 140);
            const trainingFill = rgb(255, 255, 255);
            const levelFill = node.dotColor ?? theme.levelDot;

            if (node.kind === "training") {
              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS,
                color: unlocked ? trainingFill : lockedFill,
                opacity: baseOpacity,
                outline: { width: 4, color: rgb(255, 255, 255) },
                fixed: true,
              });

              // Dotted ring for Training.
              const ringR = NODE_RADIUS + 7;
              const dots = 14;
              for (let i = 0; i < dots; i++) {
                const a = (i / dots) * Math.PI * 2;
                const p = nodePos.add(Math.cos(a) * ringR, Math.sin(a) * ringR);
                drawCircle({
                  pos: p,
                  radius: 2.6,
                  color: unlocked ? theme.trainingDot : rgb(180, 180, 180),
                  opacity: 0.95 * baseOpacity,
                  fixed: true,
                });
              }
            } else {
              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS,
                color: unlocked ? levelFill : lockedFill,
                opacity: baseOpacity,
                outline: { width: 4, color: rgb(255, 255, 255) },
                fixed: true,
              });
            }

            // Completed check.
            if (completed) {
              drawCircle({
                pos: nodePos.add(NODE_RADIUS - 6, -NODE_RADIUS + 6),
                radius: 8,
                color: rgb(255, 255, 255),
                opacity: 0.96 * baseOpacity,
                fixed: true,
              });
              drawCircle({
                pos: nodePos.add(NODE_RADIUS - 6, -NODE_RADIUS + 6),
                radius: 6,
                color: rgb(52, 199, 89),
                opacity: 0.96 * baseOpacity,
                fixed: true,
              });
            }

            // Selection ring.
            if (selected) {
              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS + 14 + Math.sin(time() * 6) * 2,
                fill: false,
                outline: { width: 3, color: rgb(255, 255, 255) },
                opacity: 0.85,
                fixed: true,
              });
            }
          },
        },
      ]);

      // Node label.
      const labelSize = node.kind === "training" ? 16 : 18;
      const label = add([
        text(node.label, { size: labelSize, align: "center" }),
        pos(node.pos),
        anchor("center"),
        fixed(),
        z(2100),
        opacity(1),
        color(theme.textDark.r, theme.textDark.g, theme.textDark.b),
      ]);
      label.onUpdate(() => {
        const unlocked = isUnlocked(node);
        label.opacity = unlocked ? 1 : 0.55;

        const selected = selectedLevelId === node.levelId;
        const lift = selected ? 2 + Math.sin(time() * 6) * 1.5 : 0;
        label.pos = node.pos.add(0, -lift);
      });
    }

    // Player marker (Cal) hovering above selection.
    const marker = add([
      sprite("cal"),
      pos(0, 0),
      anchor("center"),
      scale(2),
      fixed(),
      z(2200),
    ]);

    function selectedNodePos() {
      return getNode(selectedLevelId)?.pos ?? vec2(width() / 2, height() / 2);
    }

    marker.onUpdate(() => {
      const base = selectedNodePos().add(0, -56);
      const bounce = Math.sin(time() * 5) * 2.5;
      marker.pos = marker.pos.lerp(base.add(0, bounce), 0.18);
    });

    const WORLD_MAP_NAV_REPEAT_DELAY = 0.24;
    const WORLD_MAP_NAV_REPEAT_INTERVAL = 0.12;
    const WORLD_MAP_AXIS_SWITCH_THRESHOLD = 0.12;

    function anyDigitalInputDown(binding) {
      const keys = binding?.keys ?? [];
      if (keys.some((k) => isKeyDown(k))) return true;

      const buttons = binding?.buttons ?? [];
      return buttons.some((b) => isGamepadButtonDown(b));
    }

    function dominantDirectionFromVector(x, y, deadzone, previousDirection = null) {
      const absX = Math.abs(x);
      const absY = Math.abs(y);
      if (Math.max(absX, absY) < deadzone) return null;

      let preferHorizontal = absX >= absY;
      if (
        previousDirection &&
        Math.abs(absX - absY) < WORLD_MAP_AXIS_SWITCH_THRESHOLD
      ) {
        preferHorizontal =
          previousDirection === "left" || previousDirection === "right";
      }

      if (preferHorizontal) return x < 0 ? "left" : "right";
      return y < 0 ? "up" : "down";
    }

    function resolveWorldMapDirection(previousDirection) {
      const digitalX =
        (anyDigitalInputDown(INPUT.left) ? -1 : 0) +
        (anyDigitalInputDown(INPUT.right) ? 1 : 0);
      const digitalY =
        (anyDigitalInputDown(INPUT.up) ? -1 : 0) +
        (anyDigitalInputDown(INPUT.down) ? 1 : 0);

      if (digitalX !== 0 || digitalY !== 0) {
        return dominantDirectionFromVector(
          digitalX,
          digitalY,
          0,
          previousDirection,
        );
      }

      const stick = getGamepadStick("left");
      return dominantDirectionFromVector(
        stick.x,
        stick.y,
        GAMEPAD_STICK_DEADZONE,
        previousDirection,
      );
    }

    function stepWorldMapNav(direction) {
      if (direction === "left") moveSelection(-1);
      else if (direction === "right") moveSelection(1);
      else if (direction === "up") moveWorld(-1);
      else if (direction === "down") moveWorld(1);
    }

    const initialNavDirection = resolveWorldMapDirection(null);
    const navRepeat = {
      heldDirection: initialNavDirection,
      nextAt: initialNavDirection ? Number.POSITIVE_INFINITY : 0,
    };

    onAnyInputPress(INPUT.confirm, () => {
      const node = getNode(selectedLevelId);
      if (!node) return;

      if (!isUnlocked(node)) {
        playSfx("hurt");
        return;
      }

      ensureAudioReady();
      playSfx("ui");
      go("game", { characterId, levelId: node.levelId });
    });

    onUpdate(() => {
      const navDirection = resolveWorldMapDirection(navRepeat.heldDirection);
      if (!navDirection) {
        navRepeat.heldDirection = null;
        navRepeat.nextAt = 0;
      } else if (navRepeat.heldDirection !== navDirection) {
        navRepeat.heldDirection = navDirection;
        navRepeat.nextAt = time() + WORLD_MAP_NAV_REPEAT_DELAY;
        stepWorldMapNav(navDirection);
      } else if (time() >= navRepeat.nextAt) {
        navRepeat.nextAt = time() + WORLD_MAP_NAV_REPEAT_INTERVAL;
        stepWorldMapNav(navDirection);
      }

      stats.text = `Lives: ${run.lives}   Coins: ${run.coins}   Score: ${run.score}`;

      const node = getNode(selectedLevelId);
      if (!node) {
        info.text = "";
        return;
      }

      const levelTitle = LEVELS[node.levelId]?.title ?? node.levelId;
      if (!isUnlocked(node)) {
        const needs = (node.requires ?? [])
          .map((id) => LEVELS[id]?.title ?? id)
          .join(", ");
        info.text = needs
          ? `${levelTitle} — LOCKED (clear: ${needs})`
          : `${levelTitle} — LOCKED`;
        return;
      }

      info.text = isCompleted(node)
        ? `${levelTitle} — CLEARED (press Enter to replay)`
        : `${levelTitle} — READY (press Enter)`;
    });
  });

  scene("gameOver", (data) => {
    registerCommonHotkeys();
    bgm.requestTrack(null);
    add([rect(width(), height()), pos(0, 0), color(0, 0, 0), fixed()]);
    addFadeIn();

    centerBoxText("GAME OVER", 170, 48, { align: "center" });
    centerBoxText(`Score: ${data.score}   Coins: ${data.coins}`, 250, 22, {
      align: "center",
    });

    const bestTimeLine =
      best.bestTime === null ? "—" : `${best.bestTime.toFixed(1)}s`;
    centerBoxText(
      `Best Score: ${best.bestScore}   Best Coins: ${best.bestCoins}   Best Time: ${bestTimeLine}`,
      310,
      18,
      { align: "center", opacity: 0.9 },
    );

    centerBoxText("Press Enter to play again.", 390, 20, { align: "center" });
    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      go("characterSelect");
    });
  });

  scene("levelClear", (data) => {
    registerCommonHotkeys({ characterId: data?.characterId ?? "cal" });
    bgm.requestTrack(null);
    add([rect(width(), height()), pos(0, 0), color(0, 0, 0), fixed()]);
    addFadeIn();

    const bonusLabel = data.bonusLabel ?? "Flag Bonus";
    centerBoxText(data.title ?? "LEVEL CLEAR!", 160, 46, { align: "center" });
    centerBoxText(
      `${bonusLabel}: ${data.flagBonus}   Time Bonus: ${data.timeBonus}`,
      240,
      20,
      {
        align: "center",
      },
    );
    centerBoxText(`Score: ${data.score}   Coins: ${data.coins}`, 290, 22, {
      align: "center",
    });

    const nextId = data.nextLevelId ?? null;
    const nextTitle = nextId ? (LEVELS[nextId]?.title ?? "NEXT") : null;
    centerBoxText(
      nextId
        ? `Path unlocked: ${nextTitle}`
        : "Sneak peek complete — more levels coming soon.",
      360,
      18,
      { align: "center", opacity: 0.9 },
    );
    centerBoxText("Press Enter to return to the World Map.", 420, 18, {
      align: "center",
    });
    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      const focusLevelId = nextId ?? data.levelId ?? "training";
      go("worldMap", {
        characterId: data.characterId ?? "cal",
        worldId: data.worldId ?? worldIdForLevel(focusLevelId),
        focusLevelId,
      });
    });
  });

  scene("game", (data) => {
    registerCommonHotkeys({ characterId: data?.characterId ?? "cal" });
    setGravity(CONFIG.gravity);
    addFadeIn();

    const characterId = data?.characterId ?? "cal";
    const levelId = data?.levelId ?? "training";
    const levelSpec = LEVELS[levelId] ?? LEVELS.level1;
    const returnLevelId =
      typeof data?.returnLevelId === "string" ? data.returnLevelId : null;
    const returnWorldId =
      typeof data?.returnWorldId === "string" ? data.returnWorldId : null;
    const forcedNextLevelId = levelSpec.isSecretBonus ? returnLevelId : null;
    const forcedWorldId = levelSpec.isSecretBonus ? returnWorldId : null;
    const restartGameData = {
      characterId,
      levelId,
      ...(forcedNextLevelId ? { returnLevelId: forcedNextLevelId } : {}),
      ...(forcedWorldId ? { returnWorldId: forcedWorldId } : {}),
    };
    const levelWorldId = worldIdForLevel(levelId);
    const levelWorld = WORLD_MAPS[levelWorldId] ?? WORLD_MAPS.world1;
    const levelTheme = WORLD_THEMES[levelWorld.themeId] ?? WORLD_THEMES.grassy;
    const levelStyle = levelSpec.levelStyle ?? levelTheme.levelStyle;
    const isDesertLevel = levelStyle === "desert";
    const isCastleLevel = levelStyle === "castle";
    const isCloudLevel = levelStyle === "cloud";
    const isBossLevel = levelSpec.isBossLevel === true;

    let playerSpawnTile = vec2(0, 0);
    let goalPoleTile = null;
    let goalDoorTile = null;
    let bossTile = null;

    const map = levelSpec.buildMap();
    const mapGroundY = map.length - 1;
    const tileSize = CONFIG.tileSize;
    const groundSpriteName = isCastleLevel
      ? "ground-castle"
      : isDesertLevel
        ? "ground-desert"
        : isCloudLevel
          ? "ground-cloud"
        : "ground";
    const blockSpriteName = isCastleLevel
      ? "block-castle"
      : isCloudLevel
        ? "ground-cloud"
        : "block";

    function tileTintFor(spriteName) {
      if (!isDesertLevel) return null;
      if (spriteName === "block") return rgb(216, 172, 110);
      if (spriteName === "spring") return rgb(226, 194, 132);
      return null;
    }

    function solidTile(spriteName, extra = []) {
      const tint = tileTintFor(spriteName);
      return [
        sprite(spriteName),
        ...(tint ? [color(tint.r, tint.g, tint.b)] : []),
        area(),
        body({ isStatic: true }),
        "solid",
        ...extra,
      ];
    }

    function movingPlatform({
      axis = "x",
      range = 42,
      speed = 1.1,
      phase = 0,
    }) {
      let origin = null;
      return {
        id: "movingPlatform",
        require: ["pos"],
        add() {
          origin = this.pos.clone();
        },
        update() {
          if (!origin) return;
          const t = time() * speed + phase;
          if (axis === "y") this.pos.y = origin.y + Math.sin(t) * range;
          else this.pos.x = origin.x + Math.sin(t) * range;
        },
      };
    }

    function vineTile() {
      let baseX = null;
      let swayPhase = 0;
      return [
        sprite("vine"),
        area({
          scale: vec2(0.42, 1),
          offset: vec2(9.2, 0),
        }),
        "vine",
        {
          add() {
            swayPhase = rand(0, Math.PI * 2);
          },
          update() {
            if (baseX == null) baseX = this.pos.x;
            this.pos.x = baseX + Math.sin(time() * 2.2 + swayPhase) * 0.9;
          },
        },
      ];
    }

    function fragileCloudTile() {
      let collapseAt = Infinity;
      let respawnAt = Infinity;
      let wobblePhase = 0;
      return [
        sprite("ground-cloud"),
        area(),
        body({ isStatic: true }),
        "solid",
        "platform",
        "cloudSemi",
        "fragileCloud",
        {
          collapsing: false,
          active: true,
          solidEnabled: true,
          add() {
            wobblePhase = rand(0, Math.PI * 2);
          },
          update() {
            if (this.collapsing) {
              const pulse = 0.6 + Math.abs(Math.sin(time() * 24 + wobblePhase)) * 0.4;
              this.opacity = pulse;
            } else if (this.active) {
              this.opacity = 1;
            }

            if (this.collapsing && time() >= collapseAt) {
              this.collapsing = false;
              this.active = false;
              this.solidEnabled = false;
              this.opacity = 0.2;
              this.unuse("body");
              this.unuse("area");
              respawnAt = time() + 1.8;
            }

            if (!this.active && time() >= respawnAt) {
              this.use(area());
              this.use(body({ isStatic: true }));
              this.active = true;
              this.solidEnabled = true;
              this.opacity = 1;
              collapseAt = Infinity;
              respawnAt = Infinity;
            }
          },
          triggerCollapse() {
            if (!this.active || this.collapsing) return;
            this.collapsing = true;
            collapseAt = time() + 0.28;
          },
        },
      ];
    }

    const POWERUP_SPECS = Object.freeze({
      battery: Object.freeze({
        sprite: "battery",
        power: "charged",
        text: "CHARGED!",
        textColor: rgb(52, 199, 89),
        apply() {
          run.wingSecondsLeft = 0;
          setPower("charged", player.pos.add(tileSize / 2, 0));
          setInvincible(CONFIG.powerInvincibleSeconds);
        },
      }),
      wing: Object.freeze({
        sprite: "wing",
        power: "winged",
        text: "FLIGHT +30s",
        textColor: rgb(170, 235, 255),
        apply() {
          run.wingSecondsLeft = CONFIG.wingDurationSeconds;
          setPower("winged", player.pos.add(tileSize / 2, 0));
          setInvincible(CONFIG.powerInvincibleSeconds);
        },
      }),
    });

    function powerupSpec(kind) {
      return POWERUP_SPECS[kind] ?? POWERUP_SPECS.battery;
    }

    function questionBlockTile(reward) {
      return [
        sprite("question"),
        area(),
        body({ isStatic: true }),
        "solid",
        "question",
        {
          used: false,
          reward,
        },
      ];
    }

    function coinTile() {
      let baseY = null;
      let phase = 0;
      return [
        sprite("coin"),
        area(),
        "coin",
        {
          add() {
            phase = rand(0, Math.PI * 2);
          },
          update() {
            if (baseY == null) baseY = this.pos.y;
            this.pos.y = baseY + Math.sin(time() * 4 + phase) * 2;
          },
        },
      ];
    }

    function superCoinTile({ activeAtStart = true } = {}) {
      let baseY = null;
      let phase = 0;
      return [
        sprite("super-coin"),
        area(),
        "superCoin",
        {
          active: activeAtStart,
          add() {
            phase = rand(0, Math.PI * 2);
            if (this.active) baseY = this.pos.y;
          },
          update() {
            if (!this.active) return;
            if (baseY == null) baseY = this.pos.y;
            this.pos.y = baseY + Math.sin(time() * 4.6 + phase) * 2.4;
            this.opacity = 0.84 + Math.abs(Math.sin(time() * 8.2 + phase)) * 0.16;
          },
        },
      ];
    }

    function lavaTile() {
      let baseY = null;
      let phase = 0;
      return [
        sprite("lava"),
        area({
          scale: vec2(0.9, 0.5),
          offset: vec2(1.5, 14.5),
        }),
        "hazard",
        "lava",
        {
          add() {
            phase = rand(0, Math.PI * 2);
          },
          update() {
            if (baseY == null) baseY = this.pos.y;
            this.pos.y = baseY + Math.sin(time() * 5 + phase) * 1.4;
          },
        },
      ];
    }

    function fireTile() {
      let baseY = null;
      let phase = 0;
      return [
        sprite("fire"),
        area({
          scale: vec2(0.52, 0.74),
          offset: vec2(7.7, 6.8),
        }),
        "hazard",
        "fire",
        {
          add() {
            phase = rand(0, Math.PI * 2);
          },
          update() {
            if (baseY == null) baseY = this.pos.y;
            const bob = Math.sin(time() * 7 + phase) * 1.8;
            this.pos.y = baseY + bob;
            this.opacity = 0.84 + Math.sin(time() * 10 + phase) * 0.16;
          },
        },
      ];
    }

    function enemyTile(spriteName, opts = {}, tilePos = null) {
      const phase =
        opts.flightPhase ??
        (tilePos ? tilePos.x * 0.31 + tilePos.y * 0.47 : rand(0, Math.PI * 2));
      if (opts.flying) {
        return [
          sprite(spriteName),
          area({
            scale: vec2(0.74, 0.74),
            offset: vec2(4.2, 6.6),
          }),
          "enemy",
          "danger",
          "flyingEnemy",
          {
            home: null,
            flightRangeX: opts.flightRangeX ?? 84,
            flightRangeY: opts.flightRangeY ?? 22,
            flightSpeed: opts.flightSpeed ?? 1.75,
            flightSwoopFactor: opts.flightSwoopFactor ?? 2.1,
            flightPhase: phase,
            update() {
              if (!this.home) this.home = this.pos.clone();
              const t = time() * this.flightSpeed + this.flightPhase;
              const nextX = this.home.x + Math.sin(t) * this.flightRangeX;
              const nextY =
                this.home.y + Math.sin(t * this.flightSwoopFactor) * this.flightRangeY;
              this.flipX = nextX > this.pos.x;
              this.pos = vec2(nextX, nextY);
              const deathY = level.levelHeight() + CONFIG.fallDeathPadding;
              if (this.pos.y > deathY) destroy(this);
            },
          },
        ];
      }
      return [
        sprite(spriteName),
        // Slightly tighter hurtbox so contact matches visible robot pixels.
        area({
          scale: vec2(0.78, 0.8),
          offset: vec2(3.5, 6.4),
        }),
        body(),
        "enemy",
        "danger",
        {
          dir: -1,
          speed: opts.speed,
          smart: opts.smart ?? true,
        },
      ];
    }

    const level = addLevel(map, {
      tileWidth: tileSize,
      tileHeight: tileSize,
      tiles: {
        "=": (tilePos) =>
          solidTile(
            groundSpriteName,
            isCloudLevel && tilePos.y < mapGroundY ? ["cloudSemi"] : [],
          ),
        "#": (tilePos) =>
          solidTile(
            blockSpriteName,
            isCloudLevel && tilePos.y < mapGroundY ? ["cloudSemi"] : [],
          ),
        B: () => solidTile(blockSpriteName, ["brick", "breakable"]),
        "~": () => [
          ...solidTile(
            blockSpriteName,
            isCloudLevel ? ["platform", "cloudSemi"] : ["platform"],
          ),
          movingPlatform({
            range: isCloudLevel ? 68 : 56,
            speed: isCloudLevel ? 1.12 : 1.05,
          }),
        ],
        "|": (tilePos) => [
          ...solidTile(
            blockSpriteName,
            isCloudLevel ? ["platform", "cloudSemi"] : ["platform"],
          ),
          movingPlatform({
            axis: "y",
            range: isCloudLevel ? 66 : 52,
            speed: 1.0,
            phase: tilePos.x * 0.33 + tilePos.y * 0.21,
          }),
        ],
        c: () => fragileCloudTile(),
        "^": () => solidTile("spring", ["spring"]),
        L: () => lavaTile(),
        F: () => fireTile(),
        o: () => coinTile(),
        v: () => vineTile(),
        "?": () => questionBlockTile("coin"),
        "*": () => questionBlockTile("battery"),
        W: () => questionBlockTile("wing"),
        S: () => questionBlockTile("supercoin"),
        O: () => superCoinTile(),
        "@": (tilePos) => {
          playerSpawnTile = tilePos.clone();
          return null;
        },
        "!": (tilePos) => {
          goalPoleTile = tilePos.clone();
          return null;
        },
        D: (tilePos) => {
          goalDoorTile = tilePos.clone();
          return null;
        },
        U: (tilePos) => {
          bossTile = tilePos.clone();
          return null;
        },
        r: (tilePos) =>
          enemyTile(
            "robot-red",
            isCloudLevel
              ? {
                  flying: true,
                  flightRangeX: 92,
                  flightRangeY: 24,
                  flightSpeed: 1.62,
                  flightSwoopFactor: 2.2,
                }
              : { speed: CONFIG.enemySpeed, smart: true },
            tilePos,
          ),
        b: () =>
          enemyTile("robot-blue", {
            speed: CONFIG.enemyFastSpeed,
            smart: true,
          }),
        p: () =>
          enemyTile("robot-pink", {
            speed: CONFIG.enemySpeed - 14,
            smart: true,
          }),
      },
    });

    function addGrassyLevelBackdrop() {
      const cloudLayer = add([pos(0, 0), z(-200)]);
      const levelW = level.levelWidth();
      cloudLayer.add([
        rect(levelW + 400, height() + 20),
        pos(-200, -10),
        color(126, 207, 247),
        opacity(1),
      ]);
      for (let i = 0; i < 24; i++) {
        const x = rand(0, levelW);
        const y = rand(30, 190);
        const w = rand(46, 110);
        const h = rand(18, 40);
        cloudLayer.add([
          rect(w, h, { radius: 18 }),
          pos(x, y),
          color(255, 255, 255),
          opacity(0.24),
        ]);
      }
    }

    function addDesertLevelBackdrop() {
      const sceneryDrop = tileSize;

      function addFlatPyramid(
        layer,
        { x, baseY, width, height, leftColor, rightColor, alpha = 0.56 },
      ) {
        const half = width / 2;
        layer.add([
          polygon([vec2(0, 0), vec2(half, -height), vec2(half, 0)]),
          pos(x - half, baseY),
          color(leftColor.r, leftColor.g, leftColor.b),
          opacity(alpha),
        ]);
        layer.add([
          polygon([vec2(0, 0), vec2(half, -height), vec2(width, 0)]),
          pos(x - half, baseY),
          color(rightColor.r, rightColor.g, rightColor.b),
          opacity(alpha),
        ]);
        layer.add([
          rect(2, height),
          pos(x - 1, baseY - height),
          color(130, 92, 44),
          opacity(alpha * 0.6),
        ]);
      }

      const backdrop = add([pos(0, 0), z(-220)]);
      const levelW = level.levelWidth();

      backdrop.add([
        rect(levelW + 400, height() + 20),
        pos(-200, -10),
        color(
          levelTheme.skyBottom.r,
          levelTheme.skyBottom.g,
          levelTheme.skyBottom.b,
        ),
        opacity(1),
      ]);

      backdrop.add([
        circle(56),
        pos(220, 92),
        color(levelTheme.sun.r, levelTheme.sun.g, levelTheme.sun.b),
        opacity(0.94),
      ]);

      const duneY = 420 + sceneryDrop;
      backdrop.add([
        circle(175),
        pos(130, duneY),
        color(
          levelTheme.duneDark.r,
          levelTheme.duneDark.g,
          levelTheme.duneDark.b,
        ),
        opacity(0.92),
      ]);
      backdrop.add([
        circle(210),
        pos(390, duneY + 14),
        color(
          levelTheme.duneLight.r,
          levelTheme.duneLight.g,
          levelTheme.duneLight.b,
        ),
        opacity(0.9),
      ]);
      backdrop.add([
        circle(190),
        pos(700, duneY + 8),
        color(
          levelTheme.duneDark.r,
          levelTheme.duneDark.g,
          levelTheme.duneDark.b,
        ),
        opacity(0.92),
      ]);
      backdrop.add([
        circle(220),
        pos(980, duneY + 18),
        color(
          levelTheme.duneLight.r,
          levelTheme.duneLight.g,
          levelTheme.duneLight.b,
        ),
        opacity(0.9),
      ]);

      const pyramidLayer = add([pos(0, 0), z(-215)]);
      const pyramidBaseY = 330 + sceneryDrop;
      const pyramidStep = 520;
      for (let x = 140; x < levelW + 240; x += pyramidStep) {
        addFlatPyramid(pyramidLayer, {
          x: x + 86,
          baseY: pyramidBaseY + 150,
          width: 172,
          height: 150,
          leftColor: rgb(210, 160, 88),
          rightColor: rgb(186, 136, 68),
          alpha: 0.54,
        });
        addFlatPyramid(pyramidLayer, {
          x: x + 292,
          baseY: pyramidBaseY + 154,
          width: 144,
          height: 130,
          leftColor: rgb(218, 170, 98),
          rightColor: rgb(194, 144, 76),
          alpha: 0.5,
        });
      }
    }

    function addCloudLevelBackdrop() {
      const backdrop = add([pos(0, 0), z(-230)]);
      const levelW = level.levelWidth();

      backdrop.add([
        rect(levelW + 400, height() + 20),
        pos(-200, -10),
        color(levelTheme.skyBottom.r, levelTheme.skyBottom.g, levelTheme.skyBottom.b),
        opacity(1),
      ]);

      backdrop.add([
        circle(42),
        pos(180, 84),
        color(255, 248, 194),
        opacity(0.74),
      ]);

      for (let x = -120; x < levelW + 320; x += 178) {
        const y = 72 + Math.sin(x * 0.014) * 18;
        backdrop.add([
          rect(116, 24, { radius: 14 }),
          pos(x, y),
          color(255, 255, 255),
          opacity(0.44),
        ]);
        backdrop.add([
          rect(78, 18, { radius: 10 }),
          pos(x + 18, y - 12),
          color(255, 255, 255),
          opacity(0.52),
        ]);
      }

      const cloudIslandLayer = add([pos(0, 0), z(-222)]);
      for (let x = -80; x < levelW + 260; x += 124) {
        const y = 356 + Math.sin(x * 0.02) * 5;
        cloudIslandLayer.add([
          rect(108, 22, { radius: 10 }),
          pos(x, y),
          color(252, 252, 255),
          opacity(0.88),
        ]);
        cloudIslandLayer.add([
          rect(82, 12, { radius: 6 }),
          pos(x + 13, y + 18),
          color(214, 234, 255),
          opacity(0.8),
        ]);
      }

      const vineLayer = add([pos(0, 0), z(-221)]);
      for (let x = 120; x < levelW + 180; x += 220) {
        vineLayer.add([
          rect(4, 104),
          pos(x, 260),
          color(74, 170, 92),
          opacity(0.35),
        ]);
      }
    }

    function addCastleLevelBackdrop({ includeEmbers = true } = {}) {
      const backdrop = add([pos(0, 0), z(-230)]);
      const levelW = level.levelWidth();

      backdrop.add([
        rect(levelW + 400, height() + 20),
        pos(-200, -10),
        color(22, 24, 34),
        opacity(1),
      ]);

      backdrop.add([
        rect(levelW + 400, 160),
        pos(-200, height() - 160),
        color(68, 26, 20),
        opacity(0.38),
      ]);

      backdrop.add([
        circle(44),
        pos(170, 88),
        color(255, 208, 150),
        opacity(0.18),
      ]);

      const towerLayer = add([pos(0, 0), z(-225)]);
      for (let x = -80; x < levelW + 240; x += 186) {
        const towerH = rand(120, 200);
        towerLayer.add([
          rect(68, towerH),
          pos(x, 378 - towerH),
          color(54, 59, 72),
          opacity(0.72),
        ]);
        towerLayer.add([
          polygon([vec2(0, 0), vec2(34, -46), vec2(68, 0)]),
          pos(x, 378 - towerH),
          color(46, 50, 62),
          opacity(0.72),
        ]);
      }

      if (includeEmbers) {
        for (let i = 0; i < 26; i++) {
          backdrop.add([
            circle(rand(14, 34)),
            pos(i * 80 + rand(-30, 20), height() - rand(20, 58)),
            color(170, 64, 36),
            opacity(rand(0.1, 0.22)),
          ]);
        }
      }
    }

    if (isCastleLevel) addCastleLevelBackdrop({ includeEmbers: !isBossLevel });
    else if (isDesertLevel) addDesertLevelBackdrop();
    else if (isCloudLevel) addCloudLevelBackdrop();
    else addGrassyLevelBackdrop();

    const playerStartPos = level.tile2Pos(playerSpawnTile).add(0, -tileSize);

    const player = add([
      sprite("cal"),
      pos(playerStartPos),
      area(),
      body(),
      opacity(1),
      "player",
    ]);

    let facing = 1;
    let velX = 0;
    let ending = false;
    let invincibleUntil = 0;
    let jumpQueuedAt = -Infinity;
    let lastGroundedAt = -Infinity;
    let stompCombo = 0;
    let lastStompAt = -Infinity;
    let vineTouchUntil = -Infinity;
    let vineDetachUntil = -Infinity;
    let climbingVine = false;
    let crossedGoalPoleWithoutGrab = false;
    const secretRouteExitX = level.levelWidth() + tileSize * 0.6;
    const flightCeilingY = -tileSize * 2;

    const aura = add([
      circle(18),
      pos(player.pos.add(tileSize / 2, tileSize / 2)),
      scale(1),
      color(52, 199, 89),
      opacity(0.0),
      outline(2, rgb(52, 199, 89)),
      z(1990),
    ]);

    function setInvincible(seconds) {
      invincibleUntil = Math.max(invincibleUntil, time() + seconds);
    }

    function isInvincible() {
      return time() < invincibleUntil;
    }

    function spawnDust(at) {
      add([
        circle(rand(2, 4)),
        pos(at),
        color(255, 255, 255),
        opacity(0.25),
        lifespan(0.35, { fade: 0.2 }),
        move(vec2(rand(-1, 1), rand(-1, -0.2)), rand(40, 90)),
        z(1500),
      ]);
    }

    function loseLife(reason = "hurt") {
      if (ending) return;
      ending = true;

      bgm.stop(0.08);
      run.lives -= 1;
      run.power = "normal";
      run.wingSecondsLeft = 0;
      playSfx("hurt");
      shake(6);

      const msg =
        run.lives > 0
          ? `TRY AGAIN!\nLives left: ${run.lives}`
          : "CAL WAS CAPTURED!";

      centerBoxText(msg, 240, 34, { align: "center" });

      wait(0.9, () => {
        if (run.lives > 0) {
          go("game", restartGameData);
        } else {
          maybeUpdateBest({
            score: run.score,
            coins: run.coins,
            completionSeconds: null,
          });
          go("gameOver", { score: run.score, coins: run.coins });
        }
      });
    }

    function spawnPowerup(kind, worldPos) {
      const spec = powerupSpec(kind);
      const p = add([
        sprite(spec.sprite),
        pos(worldPos),
        area(),
        body(),
        "powerup",
        {
          kind,
          dir: 1,
          speed: 110,
          active: false,
        },
      ]);

      p.gravityScale = 0;
      tween(
        p.pos.y,
        p.pos.y - tileSize,
        0.35,
        (y) => (p.pos.y = y),
        easings.easeOutQuad,
      ).then(() => {
        p.gravityScale = 1;
        p.active = true;
      });

      p.onUpdate(() => {
        if (!p.active || ending) return;
        p.move(p.dir * p.speed, 0);
        const deathY = level.levelHeight() + CONFIG.fallDeathPadding;
        if (p.pos.y > deathY) destroy(p);
      });

      p.onCollide("solid", (_solid, col) => {
        if (col.isLeft() || col.isRight()) p.dir *= -1;
      });

      return p;
    }

    function spawnSuperCoin(worldPos) {
      const superCoin = add([
        ...superCoinTile({ activeAtStart: false }),
        pos(worldPos),
        z(1600),
      ]);

      tween(
        superCoin.pos.y,
        superCoin.pos.y - tileSize,
        0.3,
        (y) => (superCoin.pos.y = y),
        easings.easeOutQuad,
      ).then(() => {
        superCoin.active = true;
      });

      return superCoin;
    }

    function spawnFallingPowerup(kind, spawnX) {
      const spec = powerupSpec(kind);
      const x = clamp(spawnX, tileSize * 3, level.levelWidth() - tileSize * 3);
      const p = add([
        sprite(spec.sprite),
        pos(x, tileSize * 3),
        area(),
        body(),
        "powerup",
        {
          kind,
          dir: rand() < 0.5 ? -1 : 1,
          speed: 96,
          active: true,
        },
      ]);

      p.onUpdate(() => {
        if (ending) return;
        p.move(p.dir * p.speed, 0);
        const deathY = level.levelHeight() + CONFIG.fallDeathPadding;
        if (p.pos.y > deathY) destroy(p);
      });

      p.onCollide("solid", (_solid, col) => {
        if (col.isLeft() || col.isRight()) p.dir *= -1;
      });

      addFloatingText("POWER DROP", vec2(x, tileSize * 2.2), spec.textColor);

      return p;
    }

    function bumpBlock(block, reward) {
      if (block.used) return;
      block.used = true;

      playSfx("bump");
      const startY = block.pos.y;
      tween(
        startY,
        startY - 8,
        0.12,
        (y) => (block.pos.y = y),
        easings.easeOutQuad,
      ).then(() =>
        tween(
          startY - 8,
          startY,
          0.12,
          (y) => (block.pos.y = y),
          easings.easeInQuad,
        ),
      );

      if (reward === "coin") {
        addCoin(block.pos.add(tileSize / 2, -4));
        const coinFx = add([
          sprite("coin"),
          pos(block.pos.add(0, -tileSize)),
          opacity(0.95),
          lifespan(0.35, { fade: 0.15 }),
          move(UP, 120),
          z(1600),
        ]);
        wait(0.4, () => destroy(coinFx));
      } else if (reward === "supercoin") {
        spawnSuperCoin(block.pos.clone());
      } else if (POWERUP_SPECS[reward]) {
        spawnPowerup(reward, block.pos.clone());
      }

      block.use(sprite("used-block"));
    }

    function breakBrick(brick) {
      playSfx("bump");
      shake(5);
      const center = brick.pos.add(tileSize / 2, tileSize / 2);
      for (let i = 0; i < 10; i++) {
        add([
          rect(rand(2, 6), rand(2, 6), { radius: 1 }),
          pos(center),
          color(200, 140, 70),
          opacity(0.9),
          lifespan(0.6, { fade: 0.3 }),
          move(vec2(rand(-1, 1), rand(-1, -0.1)), rand(120, 260)),
          z(1600),
        ]);
      }
      destroy(brick);
    }

    // HUD.
    const hudScore = add([
      text("SCORE 0", { size: 16 }),
      pos(12, 10),
      fixed(),
      z(5000),
    ]);
    const hudCoinIcon = add([
      sprite("coin"),
      pos(12, 34),
      fixed(),
      scale(0.65),
      z(5000),
    ]);
    const hudCoins = add([
      text("x0", { size: 16 }),
      pos(42, 36),
      fixed(),
      z(5000),
    ]);
    const hudHeartIcon = add([
      sprite("heart"),
      pos(12, 58),
      fixed(),
      scale(1),
      z(5000),
    ]);
    const hudLives = add([
      text(`x${run.lives}`, { size: 16 }),
      pos(42, 60),
      fixed(),
      z(5000),
    ]);
    const hudTime = add([
      text("", { size: 16 }),
      pos(width() - 12, 10),
      anchor("topright"),
      fixed(),
      z(5000),
    ]);
    const hudPower = add([
      text("", { size: 16 }),
      pos(width() - 12, 34),
      anchor("topright"),
      color(255, 255, 255),
      fixed(),
      z(5000),
    ]);
    const hudAudio = add([
      text("", { size: 16 }),
      pos(width() - 12, 58),
      anchor("topright"),
      fixed(),
      z(5000),
    ]);

    let timeLeft = levelSpec.timeLimit ?? CONFIG.timeLimit;
    let dustTimer = 0;
    let startLocked = true;
    let pauseActive = false;
    let bossPowerDropTimer = rand(5.5, 8.5);

    // Training hints (only on the training level).
    const tutorialSteps = Array.isArray(levelSpec.tutorialSteps)
      ? levelSpec.tutorialSteps
      : null;
    let tutorialIndex = 0;
    let tutorialText = null;
    let tutorialBg = null;
    if (tutorialSteps && tutorialSteps.length > 0) {
      const tutorialTopY = 88;
      tutorialBg = add([
        rect(width() - 80, 64, { radius: 12 }),
        pos(width() / 2, tutorialTopY),
        anchor("top"),
        color(0, 0, 0),
        opacity(0.45),
        fixed(),
        z(5200),
      ]);
      tutorialText = add([
        text(tutorialSteps[0].text, {
          size: 18,
          width: width() - 120,
          align: "center",
        }),
        pos(width() / 2, tutorialTopY + 10),
        anchor("top"),
        fixed(),
        z(5201),
      ]);
    }

    const startOverlay = add([
      text(`${levelSpec.title}\nREADY!\n\nLives: ${run.lives}`, {
        size: 30,
        align: "center",
      }),
      pos(width() / 2, height() / 2),
      anchor("center"),
      fixed(),
      z(6000),
    ]);

    wait(1.1, () => {
      startLocked = false;
      destroy(startOverlay);
      playSfx("ui");
      ensureAudioReady();
      bgm.requestTrack(levelSpec.music ?? null);
    });

    const pauseOverlay = add([
      rect(width(), height()),
      pos(0, 0),
      color(0, 0, 0),
      opacity(0),
      fixed(),
      z(6800),
      "pauseUi",
    ]);
    pauseOverlay.hidden = true;

    const pausePanel = add([
      rect(430, 240, { radius: 14 }),
      pos(width() / 2, height() / 2),
      anchor("center"),
      color(10, 18, 34),
      opacity(0),
      fixed(),
      z(6801),
      "pauseUi",
    ]);
    pausePanel.hidden = true;

    const pauseTitle = add([
      text("PAUSED", { size: 34, align: "center" }),
      pos(width() / 2, height() / 2 - 72),
      anchor("center"),
      color(235, 242, 255),
      opacity(0),
      fixed(),
      z(6802),
      "pauseUi",
    ]);
    pauseTitle.hidden = true;

    const pauseOptions = ["RESUME", "RETURN TO MAP"];
    let pauseSelection = 0;
    let pauseInputCooldownUntil = 0;
    const pauseOptionTexts = pauseOptions.map((label, i) => {
      const y = height() / 2 + 2 + i * 44;
      const item = add([
        text(label, { size: 24, align: "center" }),
        pos(width() / 2, y),
        anchor("center"),
        color(215, 225, 245),
        opacity(0),
        fixed(),
        z(6802),
        "pauseUi",
      ]);
      item.hidden = true;
      return item;
    });

    const pauseHint = add([
      text("Confirm: Enter / A   Pause: Esc / P", {
        size: 14,
        align: "center",
      }),
      pos(width() / 2, height() / 2 + 92),
      anchor("center"),
      color(188, 200, 224),
      opacity(0),
      fixed(),
      z(6802),
      "pauseUi",
    ]);
    pauseHint.hidden = true;

    function setGameplayObjectsPaused(next) {
      for (const obj of get("*")) {
        if (!obj || !obj.exists()) continue;
        if (obj.is("pauseUi")) continue;
        if (obj.fixed) continue;
        obj.paused = next;
      }
    }

    function updatePauseMenuVisuals() {
      if (!pauseActive) return;
      for (let i = 0; i < pauseOptionTexts.length; i++) {
        const selected = i === pauseSelection;
        pauseOptionTexts[i].color = selected ? rgb(170, 235, 255) : rgb(215, 225, 245);
        pauseOptionTexts[i].opacity = selected ? 1 : 0.88;
        pauseOptionTexts[i].scale = selected ? vec2(1.05) : vec2(1);
      }
    }

    function closePauseMenu({ resumeMusic = true } = {}) {
      if (!pauseActive) return;
      pauseActive = false;
      setGameplayObjectsPaused(false);

      pauseOverlay.hidden = true;
      pausePanel.hidden = true;
      pauseTitle.hidden = true;
      pauseHint.hidden = true;
      pauseOverlay.opacity = 0;
      pausePanel.opacity = 0;
      pauseTitle.opacity = 0;
      pauseHint.opacity = 0;
      for (const optionText of pauseOptionTexts) {
        optionText.hidden = true;
        optionText.opacity = 0;
      }

      if (resumeMusic && !ending) {
        ensureAudioReady();
        bgm.requestTrack(levelSpec.music ?? null);
      }
    }

    function openPauseMenu() {
      if (pauseActive || ending || startLocked) return;
      pauseActive = true;
      pauseSelection = 0;
      pauseInputCooldownUntil = time() + 0.08;
      setGameplayObjectsPaused(true);
      bgm.stop(0.05);

      pauseOverlay.hidden = false;
      pausePanel.hidden = false;
      pauseTitle.hidden = false;
      pauseHint.hidden = false;
      pauseOverlay.opacity = 0.62;
      pausePanel.opacity = 0.95;
      pauseTitle.opacity = 1;
      pauseHint.opacity = 0.95;
      for (const optionText of pauseOptionTexts) {
        optionText.hidden = false;
        optionText.opacity = 0.95;
      }
      updatePauseMenuVisuals();
    }

    function movePauseSelection(delta) {
      if (!pauseActive) return;
      pauseSelection =
        (pauseSelection + delta + pauseOptions.length) % pauseOptions.length;
      playSfx("ui");
      updatePauseMenuVisuals();
    }

    function confirmPauseSelection() {
      if (!pauseActive) return;
      if (pauseSelection === 0) {
        playSfx("ui");
        closePauseMenu({ resumeMusic: true });
        return;
      }

      playSfx("ui");
      closePauseMenu({ resumeMusic: false });
      go("worldMap", {
        characterId,
        worldId: levelWorldId,
        focusLevelId: levelId,
      });
    }

    // Camera: forward-biased follow that still allows backtracking.
    const halfW = width() / 2;
    const maxCamCenterX = Math.max(halfW, level.levelWidth() - halfW);
    const camOffset = Math.round(width() * 0.2);
    const bossCamCenterX = level.levelWidth() / 2;

    function updateCamera() {
      if (isBossLevel) {
        camPos(bossCamCenterX, height() / 2);
        return bossCamCenterX - halfW;
      }
      const camCenterX = clamp(player.pos.x + camOffset, halfW, maxCamCenterX);
      camPos(camCenterX, height() / 2);
      return camCenterX - halfW;
    }

    updateCamera();

    function awardStomp(enemyPos) {
      const now = time();
      if (now - lastStompAt < 1.0) stompCombo = Math.min(stompCombo + 1, 4);
      else stompCombo = 0;
      lastStompAt = now;

      const base = 200;
      const points = base * 2 ** stompCombo;
      addScore(points, enemyPos);
    }

    function squashEnemy(enemy) {
      playSfx("stomp");
      shake(3);
      awardStomp(enemy.pos.add(tileSize / 2, tileSize / 2));
      enemy.use(scale(1, 0.25));
      enemy.unuse("body");
      enemy.unuse("area");
      wait(0.18, () => destroy(enemy));
    }

    function buildLevelClearPayload({ goalBonus = 0, bonusLabel = "Flag Bonus" } = {}) {
      const nextLevelId = forcedNextLevelId ?? levelSpec.nextLevelId ?? null;
      const focusLevelId = nextLevelId ?? levelId;
      const timeBonus =
        Math.max(0, Math.floor(timeLeft)) * CONFIG.timeBonusPerSecond;
      run.score += timeBonus;

      const completionSeconds =
        (levelSpec.timeLimit ?? CONFIG.timeLimit) - timeLeft;
      maybeUpdateBest({
        score: run.score,
        coins: run.coins,
        completionSeconds,
      });

      markLevelCompleted(levelId);

      return {
        levelId,
        worldId: forcedWorldId ?? worldIdForLevel(focusLevelId),
        score: run.score,
        coins: run.coins,
        timeBonus,
        flagBonus: goalBonus,
        bonusLabel,
        title: `${levelSpec.title} CLEAR!`,
        nextLevelId,
        characterId,
      };
    }

    function completeFlagLevel(pole, flag, grabbedAtY) {
      if (ending) return;
      ending = true;

      bgm.stop(0.08);
      playSfx("clear");
      addScore(CONFIG.levelClearValue, player.pos.add(tileSize / 2, 0));

      if (flag) flag.use(sprite("flag-c"));

      const poleHeight = 192;
      const ratio = clamp((grabbedAtY - pole.pos.y) / poleHeight, 0, 1);
      const flagBonus = Math.round((1 - ratio) * 3500 + 200);
      addScore(flagBonus, pole.pos.add(22, 10));
      const clearPayload = buildLevelClearPayload({
        goalBonus: flagBonus,
        bonusLabel: "Flag Bonus",
      });

      // Freeze player controls and gravity while we run the “flagpole” sequence.
      player.vel = vec2(0, 0);
      player.gravityScale = 0;

      const poleX = pole.pos.x;
      const poleTopY = pole.pos.y;
      const poleBottomY = pole.pos.y + poleHeight;

      player.pos.x = poleX - 10;
      player.pos.y = Math.max(player.pos.y, poleTopY + 4);

      tween(
        player.pos.y,
        poleBottomY - tileSize,
        1.0,
        (y) => (player.pos.y = y),
        easings.linear,
      ).then(() => {
        player.gravityScale = 1;
        player.vel = vec2(0, 0);

        const walkSpeed = 150;
        const walk = player.onUpdate(() => {
          player.move(walkSpeed, 0);
          const camRightEdge = camPos().x + width() / 2;
          if (player.pos.x > camRightEdge + 130) {
            walk.cancel();
            go("levelClear", clearPayload);
          }
        });
      });
    }

    function enterSecretPowerupRoute() {
      if (ending) return;
      ending = true;

      bgm.stop(0.08);
      playSfx("clear");
      addScore(CONFIG.levelClearValue, player.pos.add(tileSize / 2, 0));

      const secretBonus = 1200;
      addScore(secretBonus, player.pos.add(tileSize / 2, -10));
      addFloatingText(
        "SECRET ROUTE!",
        player.pos.add(tileSize / 2, -30),
        rgb(170, 235, 255),
      );

      const clearPayload = buildLevelClearPayload({
        goalBonus: secretBonus,
        bonusLabel: "Secret Route Bonus",
      });

      player.vel = vec2(0, 0);
      player.gravityScale = 0;

      tween(1, 0.12, 0.28, (a) => (player.opacity = a), easings.linear).then(
        () => {
          go("game", {
            characterId,
            levelId: SECRET_POWERUP_LEVEL_ID,
            returnLevelId: clearPayload.nextLevelId,
            returnWorldId: clearPayload.worldId,
          });
        },
      );
    }

    function completeDoorLevel(door) {
      if (ending) return;
      ending = true;

      bgm.stop(0.08);
      playSfx("clear");
      addScore(CONFIG.levelClearValue, player.pos.add(tileSize / 2, 0));

      const doorBonus = 1800;
      addScore(doorBonus, door.pos.add(tileSize / 2, 4));
      const doorTargetLevelId = levelSpec.doorTargetLevelId ?? null;
      const hasDoorTarget = !!doorTargetLevelId && !!LEVELS[doorTargetLevelId];

      player.vel = vec2(0, 0);
      player.gravityScale = 0;

      const completionSeconds =
        (levelSpec.timeLimit ?? CONFIG.timeLimit) - timeLeft;
      const timeBonus =
        Math.max(0, Math.floor(timeLeft)) * CONFIG.timeBonusPerSecond;
      run.score += timeBonus;
      maybeUpdateBest({
        score: run.score,
        coins: run.coins,
        completionSeconds,
      });
      markLevelCompleted(levelId);

      if (hasDoorTarget) {
        addFloatingText("BOSS CHAMBER", door.pos.add(16, -18), rgb(255, 130, 130));
      }

      const clearPayload = hasDoorTarget
        ? null
        : {
            levelId,
            worldId: worldIdForLevel(levelSpec.nextLevelId ?? levelId),
            score: run.score,
            coins: run.coins,
            timeBonus,
            flagBonus: doorBonus,
            bonusLabel: "Door Bonus",
            title: `${levelSpec.title} CLEAR!`,
            nextLevelId: levelSpec.nextLevelId,
            characterId,
          };

      tween(
        player.pos.x,
        door.pos.x,
        0.22,
        (x) => (player.pos.x = x),
        easings.easeOutQuad,
      ).then(() =>
        tween(1, 0.1, 0.26, (a) => (player.opacity = a), easings.linear).then(
          () => {
            if (hasDoorTarget) {
              go("game", { characterId, levelId: doorTargetLevelId });
              return;
            }
            go("levelClear", clearPayload);
          },
        ),
      );
    }

    function takeHit(reason) {
      if (isInvincible()) return;
      if (run.power === "charged") {
        setPower("normal", player.pos.add(tileSize / 2, 0));
        setInvincible(CONFIG.hurtInvincibleSeconds);
        playSfx("hurt");
        shake(6);
        return;
      }
      loseLife(reason);
    }

    // Controls + gameplay updates.
    onAnyInputPress(INPUT.pause, () => {
      if (pauseActive) {
        closePauseMenu({ resumeMusic: true });
        playSfx("ui");
        return;
      }
      openPauseMenu();
      if (pauseActive) playSfx("ui");
    });

    onAnyInputPress(INPUT.up, () => {
      if (!pauseActive) return;
      movePauseSelection(-1);
    });
    onAnyInputPress(INPUT.down, () => {
      if (!pauseActive) return;
      movePauseSelection(1);
    });
    onAnyInputPress(INPUT.left, () => {
      if (!pauseActive) return;
      movePauseSelection(-1);
    });
    onAnyInputPress(INPUT.right, () => {
      if (!pauseActive) return;
      movePauseSelection(1);
    });
    onAnyInputPress(INPUT.confirm, () => {
      if (!pauseActive) return;
      if (time() < pauseInputCooldownUntil) return;
      confirmPauseSelection();
    });

    onAnyInputPress(INPUT.jump, (inputName) => {
      if (ending || pauseActive) return;
      if (climbingVine && INPUT.up.keys.includes(inputName)) return;
      ensureAudioReady();
      jumpQueuedAt = time();
    });

    onAnyInputRelease(INPUT.jump, () => {
      if (ending || pauseActive) return;
      // “Short hop” for more control.
      if (player.vel.y < 0) player.vel.y *= CONFIG.shortHopCut;
    });

    onAnyInputPress(INPUT.restart, () => {
      if (ending || pauseActive) return;
      bgm.stop(0.06);
      go("game", restartGameData);
    });

    player.onGround(() => {
      lastGroundedAt = time();
      spawnDust(player.pos.add(tileSize / 2, tileSize));
    });

    onUpdate(() => {
      // HUD.
      hudScore.text = `SCORE ${run.score}`;
      hudCoins.text = `x${run.coins}`;
      hudLives.text = `x${run.lives}`;
      hudTime.text = `TIME ${Math.max(0, Math.floor(timeLeft)).toString().padStart(3, "0")}`;
      let wingActive = run.power === "winged" && run.wingSecondsLeft > 0;
      if (run.power === "charged") {
        hudPower.text = "POWER CHARGED";
        hudPower.use(color(52, 199, 89));
      } else if (wingActive) {
        hudPower.text = `POWER WING ${Math.max(0, Math.ceil(run.wingSecondsLeft))}s`;
        hudPower.use(color(170, 235, 255));
      } else {
        hudPower.text = "POWER —";
        hudPower.use(color(255, 255, 255));
      }
      if (pauseActive) hudAudio.text = "PAUSED";
      else hudAudio.text = settings.audio ? "ESC/P: PAUSE • M: MUTE" : "ESC/P: PAUSE • M: UNMUTE";

      aura.pos = player.pos.add(tileSize / 2, tileSize / 2);
      if (run.power === "charged") {
        aura.opacity = 0.2 + Math.sin(time() * 6) * 0.035;
        const s = 1 + Math.sin(time() * 6) * 0.05;
        aura.scale = vec2(s);
        aura.color = rgb(52, 199, 89);
        aura.outline = { width: 2, color: rgb(52, 199, 89) };
      } else if (wingActive) {
        aura.opacity = 0.22 + Math.sin(time() * 8) * 0.04;
        const s = 1 + Math.sin(time() * 8) * 0.06;
        aura.scale = vec2(s);
        aura.color = rgb(170, 235, 255);
        aura.outline = { width: 2, color: rgb(170, 235, 255) };
      } else {
        aura.opacity = 0.0;
        aura.scale = vec2(1);
      }

      if (isInvincible())
        player.opacity = Math.floor(time() * 18) % 2 === 0 ? 0.25 : 1;
      else player.opacity = 1;

      if (tutorialSteps && tutorialText) {
        while (
          tutorialIndex + 1 < tutorialSteps.length &&
          player.pos.x >= tutorialSteps[tutorialIndex + 1].x
        ) {
          tutorialIndex += 1;
          tutorialText.text = tutorialSteps[tutorialIndex].text;
        }
      }

      if (pauseActive) {
        updatePauseMenuVisuals();
        return;
      }

      if (ending) return;

      if (player.isGrounded()) lastGroundedAt = time();

      if (startLocked) return;

      if (run.power === "winged") {
        run.wingSecondsLeft = Math.max(0, run.wingSecondsLeft - dt());
        if (run.wingSecondsLeft <= 0) {
          run.power = "normal";
          playSfx("powerdown");
          addFloatingText(
            "WINGS OUT",
            player.pos.add(tileSize / 2, -10),
            rgb(200, 220, 255),
          );
        }
      }

      wingActive = run.power === "winged" && run.wingSecondsLeft > 0;
      const touchingVine = time() < vineTouchUntil;
      const climbUp = anyInputDown(INPUT.up);
      const climbDown = anyInputDown(INPUT.down);
      const vineReattachLocked = time() < vineDetachUntil;
      if (!touchingVine || vineReattachLocked) climbingVine = false;
      if (!vineReattachLocked && touchingVine && (climbUp || climbDown || climbingVine)) {
        climbingVine = true;
      }

      if (isBossLevel) {
        bossPowerDropTimer -= dt();
        if (bossPowerDropTimer <= 0 && get("powerup").length < 2) {
          const centerX = bossFight.boss?.homeX ?? player.pos.x;
          spawnFallingPowerup("battery", centerX + rand(-220, 220));
          bossPowerDropTimer = rand(6.5, 10.5);
        }
      }

      // Timer.
      timeLeft -= dt();
      if (timeLeft <= 0) {
        loseLife("time");
        return;
      }

      // Movement.
      const moveDir =
        (anyInputDown(INPUT.left) ? -1 : 0) + (anyInputDown(INPUT.right) ? 1 : 0);
      const isRunning = anyInputDown(INPUT.run);
      const maxSpeed = isRunning ? CONFIG.runSpeed : CONFIG.walkSpeed;
      const accel = player.isGrounded() ? CONFIG.accelGround : CONFIG.accelAir;
      const decel = player.isGrounded() ? CONFIG.decelGround : CONFIG.decelAir;

      if (moveDir !== 0) {
        facing = moveDir;
        velX = approach(velX, moveDir * maxSpeed, accel * dt());
      } else {
        velX = approach(velX, 0, decel * dt());
      }

      // Let players walk off vines naturally instead of getting stuck.
      if (climbingVine && moveDir !== 0) climbingVine = false;

      if (climbingVine) {
        velX = approach(velX, 0, (decel + 420) * dt());
        player.gravityScale = 0;
        const climbDir = (climbUp ? -1 : 0) + (climbDown ? 1 : 0);
        player.vel.y = approach(
          player.vel.y,
          climbDir * CONFIG.vineClimbSpeed,
          CONFIG.wingLiftAccel * dt(),
        );
      } else if (wingActive) {
        player.gravityScale = CONFIG.wingGravityScale;
        if (anyInputDown(INPUT.jump) && !climbDown) {
          player.vel.y = approach(
            player.vel.y,
            -CONFIG.wingRiseSpeed,
            CONFIG.wingLiftAccel * dt(),
          );
        } else {
          const wingFallTarget = climbDown
            ? CONFIG.wingDiveFallSpeed
            : CONFIG.wingGlideFallSpeed;
          const wingFallAccel = CONFIG.wingLiftAccel * (climbDown ? 1.1 : 0.65);
          player.vel.y = approach(
            player.vel.y,
            wingFallTarget,
            wingFallAccel * dt(),
          );
        }
      } else {
        player.gravityScale = 1;
      }

      player.flipX = facing < 0;
      player.move(velX, 0);

      if (wingActive && player.pos.y < flightCeilingY) {
        player.pos.y = flightCeilingY;
        if (player.vel.y < 0) player.vel.y = 0;
      }

      const camLeftEdge = updateCamera();
      if (player.pos.x < camLeftEdge + 8) {
        player.pos.x = camLeftEdge + 8;
        velX = Math.max(0, velX);
      }

      if (!levelSpec.isSecretBonus && pole) {
        if (!crossedGoalPoleWithoutGrab && player.pos.x > pole.pos.x + tileSize * 0.75) {
          crossedGoalPoleWithoutGrab = true;
        }
        if (crossedGoalPoleWithoutGrab && player.pos.x >= secretRouteExitX) {
          enterSecretPowerupRoute();
          return;
        }
      }

      dustTimer += dt();
      if (player.isGrounded() && Math.abs(velX) > 120 && dustTimer > 0.14) {
        dustTimer = 0;
        spawnDust(player.pos.add(tileSize / 2, tileSize));
      }

      // Jump buffer + coyote time.
      const buffered = time() - jumpQueuedAt <= CONFIG.jumpBuffer;
      const canCoyote = time() - lastGroundedAt <= CONFIG.coyoteTime;
      const jumpedFromVine = climbingVine;
      if (buffered && (jumpedFromVine || player.isGrounded() || canCoyote)) {
        jumpQueuedAt = -Infinity;
        climbingVine = false;
        if (jumpedFromVine) {
          vineDetachUntil = time() + CONFIG.vineJumpDetachSeconds;
          const vineJumpDir = moveDir !== 0 ? moveDir : facing;
          velX = vineJumpDir * Math.max(Math.abs(velX), CONFIG.walkSpeed * 0.55);
        }
        player.gravityScale = wingActive ? CONFIG.wingGravityScale : 1;
        player.jump(jumpedFromVine ? CONFIG.jumpForce * 0.88 : CONFIG.jumpForce);
        playSfx("jump");
      }

      // Death by falling.
      const deathY = level.levelHeight() + CONFIG.fallDeathPadding;
      if (player.pos.y > deathY) loseLife("pit");
    });

    // Collectables.
    player.onCollide("coin", (coin) => {
      if (ending) return;
      destroy(coin);
      addCoin(player.pos.add(tileSize / 2, 0));
    });

    player.onCollide("superCoin", (superCoin) => {
      if (ending) return;
      if (!superCoin || !superCoin.exists()) return;
      destroy(superCoin);
      run.score += CONFIG.superCoinValue;
      playSfx("coin");
      addFloatingText(
        `+${CONFIG.superCoinValue}`,
        player.pos.add(tileSize / 2, -2),
        rgb(255, 214, 10),
      );
      awardOneUp(player.pos.add(tileSize / 2, -20), "SUPER 1UP!");
    });

    // Power-ups.
    player.onCollide("powerup", (p) => {
      if (ending) return;
      if (!p || !p.exists()) return;
      const kind = typeof p.kind === "string" ? p.kind : "battery";
      const spec = powerupSpec(kind);
      destroy(p);
      spec.apply();
      if (kind === "wing") {
        addFloatingText(spec.text, player.pos.add(tileSize / 2, -12), spec.textColor);
      }
    });

    player.onCollideUpdate("vine", () => {
      vineTouchUntil = time() + 0.08;
    });

    // One-way clouds: pass through from below, but land when falling onto top.
    player.onBeforePhysicsResolve((col) => {
      if (ending || !isCloudLevel || !col || !col.target || !col.target.is("cloudSemi"))
        return;
      const targetTop = col.target.pos.y;
      const playerCenterY = player.pos.y + tileSize * 0.5;
      const movingUp = player.vel.y < -1;
      const mostlyBelowTop = playerCenterY >= targetTop + 2;

      // Only ignore collision while rising from below a cloud tile.
      // Any downward (or neutral) motion stays fully solid from above.
      if (movingUp && mostlyBelowTop) col.preventResolution();
    });

    player.onCollide("fragileCloud", (fragile, col) => {
      if (ending || !fragile || !fragile.exists()) return;
      if (!col) return;
      if (!col.isBottom()) return;
      if (typeof fragile.triggerCollapse === "function") fragile.triggerCollapse();
    });

    // Spring bounce.
    player.onCollide("spring", (spring, col) => {
      if (ending) return;
      if (!col) return;
      if (col.isBottom() && player.isFalling()) {
        playSfx("spring");
        shake(4);
        spring.use(scale(1, 0.85));
        wait(0.08, () => spring.use(scale(1, 1)));
        player.jump(CONFIG.jumpForce * 1.35);
      }
    });

    // Question blocks + bricks (headbutt).
    player.onHeadbutt((obj) => {
      if (ending) return;
      if (!obj || !obj.exists()) return;

      if (obj.is("question")) {
        bumpBlock(obj, obj.reward);
        return;
      }

      if (obj.is("breakable")) {
        if (run.power === "charged") breakBrick(obj);
        else {
          playSfx("bump");
          const y0 = obj.pos.y;
          tween(
            y0,
            y0 - 5,
            0.08,
            (y) => (obj.pos.y = y),
            easings.easeOutQuad,
          ).then(() =>
            tween(y0 - 5, y0, 0.08, (y) => (obj.pos.y = y), easings.easeInQuad),
          );
        }
      }
    });

    function hasSolidTileAt(tileX, tileY) {
      if (tileX < 0 || tileY < 0) return false;
      if (tileX >= level.numColumns() || tileY >= level.numRows()) return false;
      return level
        .getAt(vec2(tileX, tileY))
        .some((obj) => obj.is("solid") && obj.solidEnabled !== false);
    }

    // Enemy patrol + cliff-safe walking.
    for (const enemy of get("enemy")) {
      if (enemy.is("flyingEnemy")) {
        continue;
      }

      enemy.onCollide("solid", (_solid, col) => {
        if (ending) return;
        if (col.isLeft() || col.isRight()) {
          enemy.dir *= -1;
          enemy.vel.x = enemy.dir * enemy.speed;
        }
      });

      enemy.onUpdate(() => {
        if (ending) return;
        // Keep horizontal motion explicit so patrol is stable even after collisions.
        enemy.vel.x = enemy.dir * enemy.speed;

        // Turn around at cliffs before stepping into empty space.
        if (enemy.isGrounded()) {
          const aheadX =
            enemy.dir > 0 ? enemy.pos.x + tileSize + 1 : enemy.pos.x - 1;
          const feetY = enemy.pos.y + tileSize + 1;
          const aheadTile = level.pos2Tile(vec2(aheadX, feetY));
          const groundAhead = hasSolidTileAt(aheadTile.x, aheadTile.y);
          if (!groundAhead) {
            enemy.dir *= -1;
            enemy.vel.x = enemy.dir * enemy.speed;
          }
        }

        enemy.flipX = enemy.dir > 0;
        const deathY = level.levelHeight() + CONFIG.fallDeathPadding;
        if (enemy.pos.y > deathY) destroy(enemy);
      });
    }

    // Player vs enemies.
    player.onCollide("enemy", (enemy, col) => {
      if (ending) return;
      if (!enemy || !enemy.exists()) return;

      if (col && col.isBottom() && player.isFalling()) {
        squashEnemy(enemy);
        player.jump(CONFIG.bounceForce);
        return;
      }

      takeHit("enemy");
    });

    player.onCollide("hazard", () => {
      if (ending) return;
      takeHit("hazard");
    });

    const bossFight = {
      boss: null,
      hud: null,
      warning: null,
      hp: 0,
      maxHp: 0,
      phase: "idle",
      attackMode: "dive",
      telegraphTimer: 0,
      recoverTimer: 0,
      targetX: 0,
      arc: null,
      invulnUntil: 0,
      nextMoveAt: 0,
      arenaMinX: tileSize * 2,
      arenaMaxX: level.levelWidth() - tileSize * 2,
      groundY: level.tile2Pos(vec2(0, level.numRows() - 1)).y,
      seed: rand(0, Math.PI * 2),
      defeated: false,
      prevPos: vec2(0, 0),
      telegraphOrigin: vec2(0, 0),
    };

    function bossPathPoint(p0, p1, p2, t) {
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      return p0.scale(a).add(p1.scale(b)).add(p2.scale(c));
    }

    function bossEaseInOut(t) {
      return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    }

    function bossLerpVec(a, b, t) {
      return vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }

    function clearBossWarning() {
      if (bossFight.warning && bossFight.warning.exists()) destroy(bossFight.warning);
      bossFight.warning = null;
    }

    function updateBossHud() {
      if (!bossFight.hud || !bossFight.hud.exists()) return;
      const filled = "X".repeat(Math.max(0, bossFight.hp));
      const empty = "-".repeat(Math.max(0, bossFight.maxHp - bossFight.hp));
      bossFight.hud.text = `ROBO BOSS HP [${filled}${empty}]`;
    }

    function beginBossTelegraph(forceDive = false) {
      const boss = bossFight.boss;
      if (!boss || !boss.exists() || ending || bossFight.defeated) return;

      bossFight.phase = "telegraph";
      bossFight.attackMode = "dive";
      bossFight.telegraphTimer = rand(0.34, 0.52);
      bossFight.telegraphOrigin = boss.pos.clone();
      bossFight.targetX = clamp(
        player.pos.x + rand(-70, 70),
        bossFight.arenaMinX,
        bossFight.arenaMaxX,
      );

      clearBossWarning();
      bossFight.warning = add([
        text("!", { size: 26 }),
        pos(bossFight.targetX, bossFight.groundY - 14),
        anchor("center"),
        color(255, 90, 90),
        z(5600),
      ]);
      bossFight.warning.onUpdate(() => {
        if (!bossFight.warning || !bossFight.warning.exists()) return;
        bossFight.warning.pos.x = bossFight.targetX;
        bossFight.warning.opacity = 0.3 + Math.abs(Math.sin(time() * 18)) * 0.7;
      });
    }

    function beginBossSwoop(fakeout = false) {
      const boss = bossFight.boss;
      if (!boss || !boss.exists() || ending || bossFight.defeated) return;

      clearBossWarning();
      const start = boss.pos.clone();
      const targetX = clamp(
        bossFight.targetX + rand(-20, 20),
        bossFight.arenaMinX,
        bossFight.arenaMaxX,
      );

      if (fakeout) {
        const dipY = rand(boss.homeY + 96, boss.homeY + 138);
        const control = vec2(
          (start.x + targetX) / 2 + rand(-84, 84),
          dipY + rand(-10, 10),
        );
        const end = vec2(
          clamp(
            targetX + rand(-92, 92),
            bossFight.arenaMinX,
            bossFight.arenaMaxX,
          ),
          boss.homeY + rand(-8, 8),
        );
        bossFight.arc = {
          type: "fakeout",
          start,
          control,
          end,
          t: 0,
          dur: rand(0.58, 0.82),
          fakeout: true,
        };
      } else {
        const diveStart = vec2(
          clamp(
            targetX + rand(-96, 96),
            bossFight.arenaMinX,
            bossFight.arenaMaxX,
          ),
          boss.homeY + rand(-10, 10),
        );
        const lowY = rand(bossFight.groundY - 56, bossFight.groundY - 36);
        const lowStart = vec2(
          clamp(
            targetX + rand(-62, -24),
            bossFight.arenaMinX,
            bossFight.arenaMaxX,
          ),
          lowY + rand(-6, 6),
        );
        const lowEnd = vec2(
          clamp(
            targetX + rand(24, 62),
            bossFight.arenaMinX,
            bossFight.arenaMaxX,
          ),
          lowY + rand(-6, 8),
        );
        const end = vec2(
          clamp(
            lowEnd.x + rand(-96, 96),
            bossFight.arenaMinX,
            bossFight.arenaMaxX,
          ),
          boss.homeY + rand(-8, 12),
        );
        const alignDur = rand(0.2, 0.34);
        const downDur = rand(0.32, 0.46);
        const lowDur = rand(0.65, 0.95);
        const upDur = rand(0.5, 0.72);
        bossFight.arc = {
          type: "dive",
          t: 0,
          dur: alignDur + downDur + lowDur + upDur,
          alignDur,
          downDur,
          lowDur,
          upDur,
          start,
          diveStart,
          lowStart,
          lowEnd,
          end,
          fakeout: false,
        };
      }
      bossFight.prevPos = start.clone();
      bossFight.phase = "dive";
    }

    function defeatBoss() {
      const boss = bossFight.boss;
      if (!boss || !boss.exists() || bossFight.defeated) return;

      bossFight.defeated = true;
      ending = true;
      clearBossWarning();
      bgm.stop(0.14);
      playSfx("clear");
      shake(12);

      const bossBonus = 5000;
      addScore(bossBonus, boss.pos.add(tileSize / 2, tileSize / 2));
      addFloatingText(
        "BOSS DOWN!",
        boss.pos.add(tileSize / 2, -18),
        rgb(255, 210, 125),
      );
      const clearPayload = buildLevelClearPayload({
        goalBonus: bossBonus,
        bonusLabel: "Boss Bonus",
      });
      clearPayload.title = "ROBO OVERLORD DEFEATED!";

      player.vel = vec2(0, 0);
      player.gravityScale = 0;
      const burstCenter = boss.pos.add(tileSize / 2, tileSize / 2);
      for (let i = 0; i < 28; i++) {
        add([
          circle(rand(1.5, 4)),
          pos(burstCenter),
          color(255, rand(80, 180), rand(60, 130)),
          opacity(0.95),
          lifespan(0.7, { fade: 0.35 }),
          move(vec2(rand(-1, 1), rand(-1, 1)), rand(80, 220)),
          z(5400),
        ]);
      }

      tween(1, 1.45, 0.42, (s) => (boss.scale = vec2(s)), easings.easeOutQuad)
        .then(() => tween(1, 0, 0.24, (a) => (boss.opacity = a), easings.linear))
        .then(() => {
          destroy(boss);
          wait(0.28, () => go("levelClear", clearPayload));
        });
    }

    // Boss setup.
    if (bossTile) {
      const bossPos = level.tile2Pos(bossTile).add(-16, 0);
      const boss = add([
        sprite("ufo-boss"),
        pos(bossPos),
        area({
          scale: vec2(0.86, 0.74),
          offset: vec2(2.2, 6.8),
        }),
        color(255, 255, 255),
        "boss",
        {
          homeX: bossPos.x,
          homeY: bossPos.y,
        },
      ]);

      if (isBossLevel) {
        bossFight.boss = boss;
        bossFight.maxHp = 3;
        bossFight.hp = 3;
        bossFight.phase = "hover";
        bossFight.nextMoveAt = time() + 1.25;
        bossFight.targetX = boss.homeX;
        bossFight.telegraphOrigin = boss.pos.clone();
        bossFight.arenaMinX = clamp(
          boss.homeX - 320,
          tileSize * 2,
          level.levelWidth() - tileSize * 2,
        );
        bossFight.arenaMaxX = clamp(
          boss.homeX + 320,
          tileSize * 2,
          level.levelWidth() - tileSize * 2,
        );

        bossFight.hud = add([
          text("", { size: 18 }),
          pos(width() / 2, 10),
          anchor("top"),
          color(255, 196, 196),
          fixed(),
          z(5600),
        ]);
        updateBossHud();

        boss.onUpdate(() => {
          if (ending || bossFight.defeated) return;

          if (bossFight.phase === "hover") {
            const drift = Math.sin(time() * 1.35 + bossFight.seed) * 112;
            const target = vec2(
              clamp(
                boss.homeX + drift,
                bossFight.arenaMinX,
                bossFight.arenaMaxX,
              ),
              boss.homeY + Math.sin(time() * 3.4 + bossFight.seed * 0.6) * 7,
            );
            boss.pos = bossLerpVec(boss.pos, target, clamp(dt() * 6.5, 0, 1));
            if (time() >= bossFight.nextMoveAt) beginBossTelegraph(false);
          } else if (bossFight.phase === "telegraph") {
            bossFight.telegraphTimer -= dt();
            const wobbleX = Math.sin(time() * 22 + bossFight.seed) * 2.6;
            const wobbleY = Math.sin(time() * 12 + bossFight.seed * 0.3) * 1.9;
            const target = vec2(
              clamp(
                bossFight.telegraphOrigin.x + wobbleX,
                bossFight.arenaMinX,
                bossFight.arenaMaxX,
              ),
              bossFight.telegraphOrigin.y + wobbleY,
            );
            boss.pos = bossLerpVec(boss.pos, target, clamp(dt() * 14, 0, 1));
            if (bossFight.telegraphTimer <= 0) {
              beginBossSwoop(false);
            }
          } else if (bossFight.phase === "dive" && bossFight.arc) {
            bossFight.arc.t += dt();
            const arc = bossFight.arc;
            let p = boss.pos.clone();
            if (arc.type === "fakeout") {
              const t = clamp(arc.t / arc.dur, 0, 1);
              p = bossPathPoint(
                arc.start,
                arc.control,
                arc.end,
                bossEaseInOut(t),
              );
            } else {
              const alignEnd = arc.alignDur;
              const downEnd = arc.alignDur + arc.downDur;
              const lowEnd = arc.alignDur + arc.downDur + arc.lowDur;
              if (arc.t < alignEnd) {
                const t = clamp(arc.t / arc.alignDur, 0, 1);
                p = bossLerpVec(arc.start, arc.diveStart, bossEaseInOut(t));
              } else if (arc.t < downEnd) {
                const t = clamp((arc.t - arc.alignDur) / arc.downDur, 0, 1);
                p = bossLerpVec(arc.diveStart, arc.lowStart, bossEaseInOut(t));
              } else if (arc.t < lowEnd) {
                const t = clamp((arc.t - arc.alignDur - arc.downDur) / arc.lowDur, 0, 1);
                p = bossLerpVec(arc.lowStart, arc.lowEnd, t);
                p.y += Math.sin(time() * 20 + bossFight.seed) * 2.1;
              } else {
                const t = clamp((arc.t - arc.alignDur - arc.downDur - arc.lowDur) / arc.upDur, 0, 1);
                p = bossLerpVec(arc.lowEnd, arc.end, bossEaseInOut(t));
              }
            }
            boss.pos = p;
            const dx = boss.pos.x - bossFight.prevPos.x;
            if (Math.abs(dx) > 0.001) boss.flipX = dx > 0;
            bossFight.prevPos = boss.pos.clone();

            if (arc.t >= arc.dur) {
              const endedFakeout = arc.fakeout;
              bossFight.arc = null;
              if (endedFakeout && rand() < 0.42) {
                beginBossTelegraph(true);
              } else {
                bossFight.phase = "recover";
                bossFight.recoverTimer = endedFakeout
                  ? rand(0.22, 0.45)
                  : rand(0.4, 0.85);
              }
            }
          } else if (bossFight.phase === "recover") {
            bossFight.recoverTimer -= dt();
            const target = vec2(
              boss.pos.x,
              boss.homeY + Math.sin(time() * 3.2) * 4,
            );
            boss.pos = bossLerpVec(boss.pos, target, clamp(dt() * 8.5, 0, 1));
            if (bossFight.recoverTimer <= 0) {
              bossFight.phase = "hover";
              bossFight.nextMoveAt = time() + rand(0.22, 0.75);
            }
          }

          boss.opacity = 1;

          if (time() < bossFight.invulnUntil) {
            boss.color =
              Math.floor(time() * 26) % 2 === 0
                ? rgb(255, 255, 255)
                : rgb(255, 95, 95);
          } else if (bossFight.phase === "telegraph") {
            boss.color = rgb(255, 128, 128);
          } else {
            boss.color = rgb(255, 255, 255);
          }
        });
      } else {
        boss.onUpdate(() => {
          boss.pos.y = boss.homeY + Math.sin(time() * 2) * 6;
        });
      }
    }

    if (isBossLevel) {
      player.onCollide("boss", (bossObj, col) => {
        if (ending || !bossObj || !bossObj.exists()) return;
        if (bossFight.defeated) return;

        const stomped = !!col && col.isBottom() && player.isFalling();
        if (stomped) {
          player.jump(CONFIG.bounceForce * 1.05);
          setInvincible(CONFIG.bossStompInvincibleSeconds);
          if (time() < bossFight.invulnUntil) return;

          bossFight.hp = Math.max(0, bossFight.hp - 1);
          bossFight.invulnUntil = time() + 0.7;
          bossFight.phase = "recover";
          bossFight.recoverTimer = rand(0.32, 0.58);
          bossFight.nextMoveAt = time() + rand(0.28, 0.64);
          bossFight.arc = null;
          clearBossWarning();

          playSfx("stomp");
          shake(8);
          addFloatingText(
            `HIT! ${bossFight.hp} LEFT`,
            bossObj.pos.add(tileSize / 2, -14),
            rgb(255, 130, 130),
          );
          updateBossHud();

          if (bossFight.hp <= 0) defeatBoss();
          return;
        }

        takeHit("boss");
      });
    }

    // Goal pole + flag.
    let pole = null;
    let flag = null;
    let door = null;
    if (goalPoleTile) {
      const poleTopPos = level.tile2Pos(goalPoleTile);
      pole = add([sprite("pole"), pos(poleTopPos), area(), "goalPole"]);
      flag = add([
        sprite("flag-robot"),
        pos(poleTopPos.add(18, 26)),
        area(),
        "flag",
      ]);
    }
    if (goalDoorTile) {
      const doorPos = level.tile2Pos(goalDoorTile);
      door = add([
        sprite("door-castle"),
        pos(doorPos),
        area({
          scale: vec2(0.68, 0.9),
          offset: vec2(5.1, 2.4),
        }),
        "goalDoor",
      ]);
      door.onUpdate(() => {
        door.opacity = 0.9 + Math.sin(time() * 4) * 0.1;
      });
    }

    if (pole) {
      player.onCollide("goalPole", () => {
        completeFlagLevel(pole, flag, player.pos.y);
      });
    }
    if (door) {
      player.onCollide("goalDoor", () => {
        completeDoorLevel(door);
      });
    }
  });

  onLoad(() => {
    go("intro");
  });
})();
