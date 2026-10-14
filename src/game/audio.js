export function createAudioSystem({ audioCtx, settings, saveSettings, rand }) {
  // Gold standard audio engine matching Mouse-Squad / Ring-Chase:
  // - Master gain 0.9 for punchy, balanced retro arcade volume
  // - 32-harmonic Fourier pulse waves (12.5%, 25%, 50%) for warm, rich NES sound
  // - Smooth linear release envelopes to eliminate all pops and clicks
  // - Multi-channel lookahead scheduler (Melody w25, Harmony w50, Bass triangle, Arp w125, Percussion)
  // - Full preservation of original melodies and world variations (Desert, Cloud, Castle, Space)
  const MASTER_ON_GAIN = 0.9;
  const BGM_BUS_GAIN = 1.0;
  const SFX_BUS_GAIN = 1.0;

  const audioBus = (() => {
    const ctx = audioCtx;
    const master = ctx.createGain();
    const bgm = ctx.createGain();
    const sfx = ctx.createGain();

    master.gain.value = settings.audio ? MASTER_ON_GAIN : 0.0;
    bgm.gain.value = BGM_BUS_GAIN;
    sfx.gain.value = SFX_BUS_GAIN;

    bgm.connect(master);
    sfx.connect(master);
    master.connect(ctx.destination);

    return { ctx, master, bgm, sfx };
  })();

  function ensureAudioReady() {
    if (!settings.audio) return;
    try {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().then(() => {
          if (bgm && bgm.desiredTrack) bgm.refresh();
        }).catch(() => {});
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    const unlock = () => {
      ensureAudioReady();
      if (bgm && bgm.desiredTrack) bgm.refresh();
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
  }

  // 32-harmonic Fourier bandlimited pulse waves (Mouse-Squad gold standard)
  function pulseWave(c, duty) {
    const N = 32;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }
    return c.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  const waves = {
    w125: pulseWave(audioCtx, 0.125),
    w25: pulseWave(audioCtx, 0.25),
    w50: pulseWave(audioCtx, 0.5),
  };

  function resolveWave(type) {
    if (!type) return waves.w25;
    if (type === "w25" || type === "pulse25") return waves.w25;
    if (type === "w50" || type === "pulse50" || type === "square") return waves.w50;
    if (type === "w125" || type === "pulse125") return waves.w125;
    if (type === "triangle" || type === "sine" || type === "sawtooth") return type;
    return waves.w25;
  }

  // Click-free tone generator with smooth linear decay ramp
  function tone(when, dur, f, vol, wave = "w25", slideTo = null, destination = audioBus.sfx) {
    if (!settings.audio) return;
    const ctx = audioCtx;
    const start = Math.max(when, ctx.currentTime + 0.002);
    const duration = Math.max(0.02, dur);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const w = resolveWave(wave);

    if (typeof w === "string") {
      o.type = w;
    } else {
      o.setPeriodicWave(w);
    }

    o.frequency.setValueAtTime(Math.max(1, f), start);
    if (slideTo != null) {
      o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
    }

    const release = Math.min(0.025, duration * 0.35);
    g.gain.setValueAtTime(Math.max(0.0001, vol), start);
    g.gain.setValueAtTime(Math.max(0.0001, vol), Math.max(start, start + duration - release));
    g.gain.linearRampToValueAtTime(0.0001, start + duration);

    o.connect(g);
    g.connect(destination);
    o.start(start);
    o.stop(start + duration + 0.02);
  }

  // Pre-allocated noise buffer for punchy, click-free percussion
  const noiseBuffer = (() => {
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = rand(-1, 1);
    return buf;
  })();

  function playKick(when, vol = 0.20, destination = audioBus.bgm) {
    if (!settings.audio) return;
    tone(when, 0.08, 130, vol, "sine", 38, destination);
  }

  function playSnare(when, vol = 0.12, destination = audioBus.bgm) {
    if (!settings.audio) return;
    const ctx = audioCtx;
    const start = Math.max(when, ctx.currentTime + 0.002);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1900, start);
    filter.Q.setValueAtTime(0.75, start);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.setValueAtTime(vol, start + 0.04);
    g.gain.linearRampToValueAtTime(0.0001, start + 0.085);

    src.connect(filter);
    filter.connect(g);
    g.connect(destination);
    src.start(start);
    src.stop(start + 0.10);
  }

  function playHat(when, vol = 0.05, destination = audioBus.bgm) {
    if (!settings.audio) return;
    const ctx = audioCtx;
    const start = Math.max(when, ctx.currentTime + 0.002);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7600, start);
    filter.Q.setValueAtTime(0.9, start);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.linearRampToValueAtTime(0.0001, start + 0.028);

    src.connect(filter);
    filter.connect(g);
    g.connect(destination);
    src.start(start);
    src.stop(start + 0.035);
  }

  function midiToFreq(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  // --- Sound Effects (Mouse-Squad gold standard volume & punch) ---
  function playSfx(name) {
    if (!settings.audio) return;
    ensureAudioReady();
    const t = audioCtx.currentTime + 0.004;

    switch (name) {
      case "ui":
      case "select":
        tone(t, 0.05, 880, 0.09, "w25");
        break;
      case "confirm":
        tone(t, 0.06, 660, 0.11, "w25");
        tone(t + 0.06, 0.10, 990, 0.11, "w25");
        break;
      case "jump":
        tone(t, 0.12, 330, 0.13, "w25", 660);
        break;
      case "jump2":
        tone(t, 0.12, 500, 0.13, "w25", 1000);
        break;
      case "coin":
        tone(t, 0.06, 1319, 0.12, "w25");
        tone(t + 0.06, 0.10, 1760, 0.12, "w25");
        break;
      case "stomp":
        tone(t, 0.12, 500, 0.16, "w50", 140);
        break;
      case "bump":
        tone(t, 0.09, 220, 0.14, "w50", 160);
        break;
      case "hurt":
        tone(t, 0.32, 560, 0.16, "w125", 90);
        break;
      case "power":
        [392, 523, 784].forEach((f, k) => tone(t + k * 0.08, 0.10, f, 0.13, "w25"));
        break;
      case "forge":
        [330, 494, 659, 988].forEach((f, k) => tone(t + k * 0.07, 0.11, f, 0.13, "w25"));
        tone(t + 0.14, 0.12, 1420, 0.10, "w125", 920);
        break;
      case "forge-expire":
        [554, 440, 330].forEach((f, k) => tone(t + k * 0.08, 0.10, f, 0.12, "w25"));
        tone(t + 0.18, 0.12, 300, 0.12, "triangle", 160);
        break;
      case "sandstorm":
        [294, 392, 523, 659].forEach((f, k) => tone(t + k * 0.07, 0.10, f, 0.13, "w25"));
        tone(t + 0.16, 0.20, 190, 0.12, "w50", 520);
        break;
      case "sandstorm-expire":
        [523, 440, 330].forEach((f, k) => tone(t + k * 0.07, 0.09, f, 0.11, "w25"));
        tone(t + 0.16, 0.12, 360, 0.12, "triangle", 180);
        break;
      case "powerdown":
        [784, 523, 392].forEach((f, k) => tone(t + k * 0.08, 0.10, f, 0.12, "triangle"));
        break;
      case "1up":
        [523, 659, 784, 1046].forEach((f, k) => tone(t + k * 0.07, 0.12, f, 0.14, "w25"));
        break;
      case "clear":
        [523, 659, 784, 988, 1046].forEach((f, k) => tone(t + k * 0.09, 0.14, f, 0.15, "w25"));
        break;
      case "spring":
        tone(t, 0.22, 220, 0.18, "w25", 880);
        break;
      default:
        break;
    }
  }

  // --- Musical Data (Preserving the beloved original melody and world transformations) ---
  const N = null;

  const BGM_TRACKS = Object.freeze({
    overworld: {
      bpm: 168,
      stepsPerBeat: 2,
      // 16 bars of upbeat classic platformer melody (original notes)
      melody: [
        76, N, 79, 81, 79, 76, 74, 72,
        74, N, 79, 83, 81, 79, 76, 74,
        72, N, 76, 81, 79, 76, 74, 72,
        77, 79, 81, N, 79, 77, 76, 74,

        72, 74, 76, N, 74, 72, 71, 72,
        74, N, 79, 81, 83, 81, 79, 76,
        76, 79, 84, N, 83, 81, 79, 76,
        74, N, 76, 79, 81, 79, 76, 72,

        77, N, 81, 84, 86, 84, 83, 81,
        76, N, 79, 83, 84, 83, 81, 79,
        76, 79, 83, N, 81, 79, 76, 74,
        72, N, 76, 81, 84, 81, 79, 76,

        77, 79, 81, 84, 81, 79, 77, 76,
        74, N, 79, 83, 79, 76, 74, 72,
        76, 79, 84, 83, 81, 79, 76, 74,
        72, N, 74, 76, 79, 76, 74, 72,
      ],
      harmony: [
        64, N, 67, N, 64, N, 67, N,
        67, N, 71, N, 67, N, 71, N,
        69, N, 72, N, 69, N, 72, N,
        65, N, 69, N, 65, N, 69, N,

        62, N, 65, N, 62, N, 65, N,
        67, N, 71, N, 67, N, 71, N,
        64, N, 67, N, 64, N, 72, N,
        64, N, 67, N, 64, N, 67, N,

        65, N, 69, N, 65, N, 69, N,
        67, N, 71, N, 67, N, 71, N,
        67, N, 71, N, 67, N, 71, N,
        69, N, 72, N, 69, N, 72, N,

        65, N, 69, N, 65, N, 69, N,
        67, N, 71, N, 67, N, 71, N,
        64, N, 67, N, 64, N, 67, N,
        67, N, 71, N, 67, N, 71, N,
      ],
      bass: [
        48, N, 48, N, 48, N, 50, N,
        43, N, 43, N, 43, N, 45, N,
        45, N, 45, N, 45, N, 43, N,
        41, N, 41, N, 41, N, 43, N,

        50, N, 50, N, 50, N, 48, N,
        43, N, 43, N, 43, N, 45, N,
        48, N, 48, N, 48, N, 47, N,
        48, N, 48, N, 48, N, 50, N,

        41, N, 41, N, 41, N, 43, N,
        43, N, 43, N, 43, N, 45, N,
        40, N, 40, N, 40, N, 43, N,
        45, N, 45, N, 45, N, 43, N,

        41, N, 41, N, 41, N, 43, N,
        43, N, 43, N, 43, N, 45, N,
        48, N, 48, N, 48, N, 50, N,
        43, N, 43, N, 43, N, 48, N,
      ],
      arp: [
        72, 76, 79, 76, 72, 76, 79, 76, 71, 74, 79, 74, 71, 74, 79, 74, 69, 72,
        76, 72, 69, 72, 76, 72, 69, 72, 77, 72, 69, 72, 77, 72,

        67, 71, 74, 71, 67, 71, 74, 71, 71, 74, 79, 74, 71, 74, 79, 74, 72, 76,
        79, 76, 72, 76, 84, 79, 72, 76, 79, 76, 72, 76, 79, 76,

        69, 72, 77, 72, 69, 72, 77, 72, 71, 74, 79, 74, 71, 74, 79, 74, 67, 71,
        76, 71, 67, 71, 76, 71, 69, 72, 76, 72, 69, 72, 76, 72,

        69, 72, 77, 72, 69, 72, 77, 72, 71, 74, 79, 74, 71, 74, 79, 74, 72, 76,
        79, 76, 72, 76, 79, 76, 71, 74, 79, 74, 71, 74, 79, 74,
      ],
      groove: "platformer",
    },
  });

  // World transformations
  function toMinorColor(midi) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    if (pc === 4 || pc === 9 || pc === 11) return midi - 1;
    return midi;
  }

  function toCloudColor(midi, stepIndex = 0) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    const beatStep = stepIndex % 8;
    if (pc === 5 && (beatStep === 2 || beatStep === 6)) return midi + 1;
    return midi;
  }

  function toCloudMelody(midi, stepIndex) {
    if (midi == null) return N;
    let note = toCloudColor(midi, stepIndex);
    const phraseStep = stepIndex % 32;
    if ((phraseStep === 6 || phraseStep === 14 || phraseStep === 22 || phraseStep === 30) && note <= 84) {
      note += 12;
    }
    return note;
  }

  function toCloudHarmony(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    const note = toCloudColor(midi, stepIndex);
    if (beatStep === 1 || beatStep === 5) return note + 12;
    if (beatStep === 3 || beatStep === 7) return note + 19;
    return N;
  }

  function toCloudBass(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    const note = toCloudColor(midi, stepIndex);
    if (beatStep === 0) return note + 12;
    if (beatStep === 4) return note + 7;
    return N;
  }

  function toCloudArp(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    let note = toCloudColor(midi, stepIndex) + 24;
    if (note > 108) note -= 12;
    if (beatStep % 2 === 1) return note;
    if ((beatStep === 2 || beatStep === 6) && note <= 101) return note + 7;
    return N;
  }

  function toDesertColor(midi) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    if (pc === 2 || pc === 9 || pc === 11) return midi - 1;
    return midi;
  }

  function toDesertHarmony(midi, stepIndex) {
    if (midi == null) return N;
    const note = toDesertColor(midi);
    const beatStep = stepIndex % 8;
    if (beatStep === 0) return note + 12;
    if (beatStep === 4) return note + 7;
    return N;
  }

  function toDesertBass(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    if (beatStep === 0 || beatStep === 4) return toDesertColor(midi);
    return N;
  }

  function toDesertArp(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    const note = toDesertColor(midi);
    if (beatStep === 1 || beatStep === 5) return note;
    if (beatStep === 2 || beatStep === 6) return note + 7;
    return N;
  }

  function toSpaceColor(midi) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    if (pc === 5) return midi + 1;
    return midi;
  }

  function toSpaceMelody(midi, stepIndex) {
    if (midi == null) return N;
    let note = toSpaceColor(midi);
    const phraseStep = stepIndex % 32;
    if ((phraseStep === 0 || phraseStep === 16 || phraseStep === 24) && note <= 84) {
      note += 12;
    }
    return note;
  }

  function toSpaceHarmony(midi, stepIndex) {
    if (midi == null) return N;
    if (stepIndex % 2 === 1) return N;
    return toSpaceColor(midi) + 12;
  }

  function toSpaceBass(midi, stepIndex) {
    if (midi == null) return N;
    if (stepIndex % 4 !== 0) return N;
    return toSpaceColor(midi);
  }

  function toSpaceArp(midi, stepIndex) {
    if (midi == null) return N;
    if (stepIndex % 2 === 1) return N;
    let note = toSpaceColor(midi) + 12;
    if (stepIndex % 16 === 0) note += 7;
    return note;
  }

  const SPECIAL_BGM_TRACKS = Object.freeze({
    "overworld-castle": Object.freeze({
      bpm: 136,
      stepsPerBeat: 2,
      melody: BGM_TRACKS.overworld.melody.map((m) => toMinorColor(m)),
      harmony: BGM_TRACKS.overworld.harmony.map((m) => (m == null ? N : toMinorColor(m) - 12)),
      bass: BGM_TRACKS.overworld.bass.map((m) => (m == null ? N : toMinorColor(m) - 2)),
      arp: BGM_TRACKS.overworld.arp.map((m, i) => (m == null || i % 2 === 1 ? N : toMinorColor(m) - 12)),
      groove: "castle",
      melodyWave: "w25",
      harmonyWave: "w50",
      bassWave: "triangle",
    }),
    "overworld-cloud": Object.freeze({
      bpm: 166,
      stepsPerBeat: 2,
      melody: BGM_TRACKS.overworld.melody.map((m, i) => toCloudMelody(m, i)),
      harmony: BGM_TRACKS.overworld.harmony.map((m, i) => toCloudHarmony(m, i)),
      bass: BGM_TRACKS.overworld.bass.map((m, i) => toCloudBass(m, i)),
      arp: BGM_TRACKS.overworld.arp.map((m, i) => toCloudArp(m, i)),
      groove: "cloud",
      melodyWave: "w25",
      harmonyWave: "w125",
      bassWave: "triangle",
    }),
    "overworld-desert": Object.freeze({
      bpm: 160,
      stepsPerBeat: 2,
      melody: BGM_TRACKS.overworld.melody.map((m) => toDesertColor(m)),
      harmony: BGM_TRACKS.overworld.harmony.map((m, i) => toDesertHarmony(m, i)),
      bass: BGM_TRACKS.overworld.bass.map((m, i) => toDesertBass(m, i)),
      arp: BGM_TRACKS.overworld.arp.map((m, i) => toDesertArp(m, i)),
      groove: "desert",
      melodyWave: "w25",
      harmonyWave: "w50",
      bassWave: "triangle",
    }),
    "overworld-space": Object.freeze({
      bpm: 154,
      stepsPerBeat: 2,
      melody: BGM_TRACKS.overworld.melody.map((m, i) => toSpaceMelody(m, i)),
      harmony: BGM_TRACKS.overworld.harmony.map((m, i) => toSpaceHarmony(m, i)),
      bass: BGM_TRACKS.overworld.bass.map((m, i) => toSpaceBass(m, i)),
      arp: BGM_TRACKS.overworld.arp.map((m, i) => toSpaceArp(m, i)),
      groove: "space",
      melodyWave: "w25",
      harmonyWave: "w125",
      bassWave: "triangle",
    }),
  });

  function getTrack(name) {
    if (!name) return null;
    return BGM_TRACKS[name] ?? SPECIAL_BGM_TRACKS[name] ?? null;
  }

  // --- High-Performance Lookahead Scheduler ---
  function createBgmPlayer() {
    let desiredTrack = null;
    let currentTrackName = null;
    let track = null;
    let step = 0;
    let nextStepTime = 0;
    let intervalId = null;

    const lookaheadMs = 30;
    const scheduleAheadSec = 0.22;

    function stepDuration() {
      if (!track) return 0.2;
      return 60 / track.bpm / track.stepsPerBeat;
    }

    function scheduleNotes() {
      if (!settings.audio || !track || !desiredTrack) return;
      const ctx = audioCtx;
      const stepDur = stepDuration();
      const totalSteps = track.melody.length;
      const safetyTime = ctx.currentTime + 0.012;

      // Prevent lag burst if tab was in background
      if (nextStepTime < safetyTime - stepDur * 2) {
        nextStepTime = safetyTime;
      }

      while (nextStepTime < ctx.currentTime + scheduleAheadSec) {
        const i = step % totalSteps;
        const t = nextStepTime;
        const dur = stepDur * 0.90;
        const beatStep = i % 8;

        const melNote = track.melody[i];
        const hrmNote = track.harmony[i];
        const basNote = track.bass[i];
        const arpNote = track.arp ? track.arp[i] : null;

        const melWave = track.melodyWave ?? "w25";
        const hrmWave = track.harmonyWave ?? "w50";
        const basWave = track.bassWave ?? "triangle";

        // Volumes calibrated to Mouse-Squad standard
        if (melNote != null) {
          tone(t, dur, midiToFreq(melNote), 0.14, melWave, null, audioBus.bgm);
        }
        if (hrmNote != null) {
          tone(t, dur * 0.92, midiToFreq(hrmNote), 0.07, hrmWave, null, audioBus.bgm);
        }
        if (basNote != null) {
          tone(t, dur * 0.95, midiToFreq(basNote), 0.22, basWave, null, audioBus.bgm);
        }
        if (arpNote != null) {
          tone(t, stepDur * 0.5, midiToFreq(arpNote), 0.045, "w125", null, audioBus.bgm);
        }

        // Percussion grooves
        const groove = track.groove ?? "platformer";
        if (groove === "platformer") {
          if (beatStep === 0 || beatStep === 4) playKick(t, 0.20, audioBus.bgm);
          if (beatStep === 2 || beatStep === 6) playSnare(t, 0.12, audioBus.bgm);
          playHat(t, beatStep % 2 === 1 ? 0.05 : 0.035, audioBus.bgm);
        } else if (groove === "desert") {
          // Maqsum rhythm
          if (beatStep === 0 || beatStep === 4) playKick(t, 0.22, audioBus.bgm);
          if (beatStep === 2 || beatStep === 6) playSnare(t, 0.13, audioBus.bgm);
          if (beatStep === 1 || beatStep === 3 || beatStep === 5 || beatStep === 7) playHat(t, 0.05, audioBus.bgm);
        } else if (groove === "castle") {
          // Driving suspense
          if (beatStep === 0 || beatStep === 5) playKick(t, 0.22, audioBus.bgm);
          if (beatStep === 4) playSnare(t, 0.13, audioBus.bgm);
          playHat(t, 0.045, audioBus.bgm);
        } else if (groove === "cloud") {
          // Light bounce
          if (beatStep === 0) playKick(t, 0.14, audioBus.bgm);
          if (beatStep === 4) playSnare(t, 0.09, audioBus.bgm);
          if (beatStep % 2 === 1) playHat(t, 0.04, audioBus.bgm);
        } else if (groove === "space") {
          // Ambient pulse
          if (beatStep === 0) playKick(t, 0.16, audioBus.bgm);
          if (beatStep === 4) playSnare(t, 0.09, audioBus.bgm);
          if (beatStep === 2 || beatStep === 6) playHat(t, 0.035, audioBus.bgm);
        }

        step++;
        nextStepTime += stepDur;
      }
    }

    function start(name) {
      if (!settings.audio) return;
      ensureAudioReady();
      const newTrack = getTrack(name);
      if (!newTrack) return;

      if (currentTrackName === name && intervalId) return;

      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      currentTrackName = name;
      track = newTrack;
      step = 0;
      nextStepTime = audioCtx.currentTime + 0.04;

      // Unmute and ramp BGM bus to full volume
      const now = audioCtx.currentTime;
      audioBus.bgm.gain.cancelScheduledValues(now);
      audioBus.bgm.gain.setValueAtTime(audioBus.bgm.gain.value, now);
      audioBus.bgm.gain.linearRampToValueAtTime(BGM_BUS_GAIN, now + 0.05);

      intervalId = setInterval(scheduleNotes, lookaheadMs);
      scheduleNotes();
    }

    function stop(fadeSeconds = 0.12) {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      currentTrackName = null;
      track = null;
      step = 0;

      if (audioCtx) {
        const now = audioCtx.currentTime;
        const fade = Math.max(0.02, fadeSeconds);
        audioBus.bgm.gain.cancelScheduledValues(now);
        audioBus.bgm.gain.setValueAtTime(audioBus.bgm.gain.value, now);
        audioBus.bgm.gain.linearRampToValueAtTime(0.0001, now + fade);
      }
    }

    function requestTrack(trackName) {
      desiredTrack = trackName;
      refresh();
    }

    function refresh() {
      if (!settings.audio || !desiredTrack) {
        stop(0.12);
        return;
      }
      if (currentTrackName !== desiredTrack) {
        start(desiredTrack);
      }
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

    const now = audioCtx.currentTime;
    audioBus.master.gain.cancelScheduledValues(now);
    audioBus.master.gain.setValueAtTime(audioBus.master.gain.value, now);
    audioBus.master.gain.linearRampToValueAtTime(settings.audio ? MASTER_ON_GAIN : 0.0, now + 0.04);

    bgm.refresh();
    playSfx("ui");
  }

  return {
    ensureAudioReady,
    playSfx,
    bgm,
    toggleAudio,
  };
}
