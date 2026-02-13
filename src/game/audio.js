export function createAudioSystem({ audioCtx, settings, saveSettings, rand }) {
  const MASTER_ON_GAIN = 1.0;
  const BGM_BUS_GAIN = 0.48;
  const SFX_BUS_GAIN = 0.75;

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
      case "forge":
        playJingle([
          { t: 0.0, f: 330, d: 0.06, type: "sawtooth", g: 0.034 },
          { t: 0.06, f: 494, d: 0.07, type: "sawtooth", g: 0.036 },
          { t: 0.13, f: 659, d: 0.08, type: "triangle", g: 0.038 },
          { t: 0.22, f: 988, d: 0.13, type: "triangle", g: 0.043 },
        ]);
        playTone({
          type: "square",
          freq: 1420,
          freqEnd: 920,
          duration: 0.12,
          gain: 0.022,
        });
        break;
      case "forge-expire":
        playJingle([
          { t: 0.0, f: 554, d: 0.08, type: "sawtooth", g: 0.03 },
          { t: 0.1, f: 440, d: 0.08, type: "sawtooth", g: 0.028 },
          { t: 0.2, f: 330, d: 0.12, type: "triangle", g: 0.03 },
        ]);
        playTone({
          type: "triangle",
          freq: 300,
          freqEnd: 170,
          duration: 0.13,
          gain: 0.021,
        });
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

  function toCloudColor(midi, stepIndex = 0) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    const beatStep = stepIndex % 8;
    // Brighten selected passing tones with a Lydian #4 lift.
    if (pc === 5 && (beatStep === 2 || beatStep === 6)) return midi + 1;
    return midi;
  }

  function toCloudMelody(midi, stepIndex) {
    if (midi == null) return N;
    let note = toCloudColor(midi, stepIndex);
    const phraseStep = stepIndex % 32;
    // Add buoyant octave pops around phrase pivots for a playful lift.
    if ((phraseStep === 6 || phraseStep === 14 || phraseStep === 22 || phraseStep === 30) && note <= 84) {
      note += 12;
    }
    return note;
  }

  function toCloudHarmony(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    const note = toCloudColor(midi, stepIndex);
    // Chime on upbeats and answer with a fifth for a cute bounce.
    if (beatStep === 1 || beatStep === 5) return note + 12;
    if (beatStep === 3 || beatStep === 7) return note + 19;
    return N;
  }

  function toCloudBass(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    const note = toCloudColor(midi, stepIndex);
    // Keep bass tiny and bouncy so the sparkle leads the feel.
    if (beatStep === 0) return note + 12;
    if (beatStep === 4) return note + 7;
    return N;
  }

  function toCloudArp(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    let note = toCloudColor(midi, stepIndex) + 24;
    if (note > 108) note -= 12;
    // Constant twinkles in the high register with occasional extra sparkle.
    if (beatStep % 2 === 1) return note;
    if ((beatStep === 2 || beatStep === 6) && note <= 101) return note + 7;
    return N;
  }

  function toDesertColor(midi) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    // Hijaz/Phrygian-dominant leaning against C: D->Db, A->Ab, B->Bb.
    if (pc === 2 || pc === 9 || pc === 11) return midi - 1;
    return midi;
  }

  function toDesertHarmony(midi, stepIndex) {
    if (midi == null) return N;
    const note = toDesertColor(midi);
    const beatStep = stepIndex % 8;
    // Sparse high drone tones to emulate sustained regional accompaniment.
    if (beatStep === 0) return note + 12;
    if (beatStep === 4) return note + 7;
    return N;
  }

  function toDesertBass(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    // Strong "dum" on beats 1 and 3 with room between hits.
    if (beatStep === 0 || beatStep === 4) return toDesertColor(midi);
    return N;
  }

  function toDesertArp(midi, stepIndex) {
    if (midi == null) return N;
    const beatStep = stepIndex % 8;
    const note = toDesertColor(midi);
    // Short ornamental answers between drum accents.
    if (beatStep === 1 || beatStep === 5) return note;
    if (beatStep === 2 || beatStep === 6) return note + 7;
    return N;
  }

  function toSpaceColor(midi) {
    if (midi == null) return N;
    const pc = ((midi % 12) + 12) % 12;
    // Lydian color: raise scale degree 4 (F -> F#) for a floating feel.
    if (pc === 5) return midi + 1;
    return midi;
  }

  function toSpaceMelody(midi, stepIndex) {
    if (midi == null) return N;
    let note = toSpaceColor(midi);
    const phraseStep = stepIndex % 32;
    // Subtle octave blooms at phrase pivots.
    if ((phraseStep === 0 || phraseStep === 16 || phraseStep === 24) && note <= 84) {
      note += 12;
    }
    return note;
  }

  function toSpaceHarmony(midi, stepIndex) {
    if (midi == null) return N;
    // Thin, high-register bed instead of constant block movement.
    if (stepIndex % 2 === 1) return N;
    return toSpaceColor(midi) + 12;
  }

  function toSpaceBass(midi, stepIndex) {
    if (midi == null) return N;
    // Quarter-note bass pulse keeps gravity low and uncluttered.
    if (stepIndex % 4 !== 0) return N;
    return toSpaceColor(midi);
  }

  function toSpaceArp(midi, stepIndex) {
    if (midi == null) return N;
    if (stepIndex % 2 === 1) return N;
    let note = toSpaceColor(midi) + 12;
    // Add occasional fifth bloom for shimmer.
    if (stepIndex % 16 === 0) note += 7;
    return note;
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
    "overworld-cloud": Object.freeze({
      bpm: 166,
      stepsPerBeat: BGM_TRACKS.overworld.stepsPerBeat,
      melody: BGM_TRACKS.overworld.melody.map((m, i) => toCloudMelody(m, i)),
      harmony: BGM_TRACKS.overworld.harmony.map((m, i) => toCloudHarmony(m, i)),
      bass: BGM_TRACKS.overworld.bass.map((m, i) => toCloudBass(m, i)),
      arp: BGM_TRACKS.overworld.arp.map((m, i) => toCloudArp(m, i)),
      melodyType: "chime",
      harmonyType: "chime-soft",
      bassType: "triangle",
      arpType: "chime-soft",
      melodyGain: 0.028,
      harmonyGain: 0.0095,
      bassGain: 0.009,
      arpGain: 0.0088,
      durFactor: 0.9,
      arpDurFactor: 0.42,
      accentStrength: 0.42,
      groove: "cloud",
      trackGain: 1.16,
    }),
    "overworld-desert": Object.freeze({
      bpm: 160,
      stepsPerBeat: BGM_TRACKS.overworld.stepsPerBeat,
      melody: BGM_TRACKS.overworld.melody.map((m) => toDesertColor(m)),
      harmony: BGM_TRACKS.overworld.harmony.map((m, i) => toDesertHarmony(m, i)),
      bass: BGM_TRACKS.overworld.bass.map((m, i) => toDesertBass(m, i)),
      arp: BGM_TRACKS.overworld.arp.map((m, i) => toDesertArp(m, i)),
      melodyType: "sawtooth",
      harmonyType: "triangle",
      bassType: "square",
      arpType: "triangle",
      melodyGain: 0.031,
      harmonyGain: 0.009,
      bassGain: 0.021,
      arpGain: 0.0058,
      durFactor: 0.9,
      arpDurFactor: 0.48,
      accentStrength: 0.58,
      groove: "desert",
      trackGain: 1.15,
    }),
    "overworld-space": Object.freeze({
      bpm: 154,
      stepsPerBeat: BGM_TRACKS.overworld.stepsPerBeat,
      melody: BGM_TRACKS.overworld.melody.map((m, i) => toSpaceMelody(m, i)),
      harmony: BGM_TRACKS.overworld.harmony.map((m, i) => toSpaceHarmony(m, i)),
      bass: BGM_TRACKS.overworld.bass.map((m, i) => toSpaceBass(m, i)),
      arp: BGM_TRACKS.overworld.arp.map((m, i) => toSpaceArp(m, i)),
      melodyType: "triangle",
      harmonyType: "sine",
      bassType: "triangle",
      arpType: "sine",
      melodyGain: 0.036,
      harmonyGain: 0.011,
      bassGain: 0.024,
      arpGain: 0.008,
      durFactor: 1.02,
      arpDurFactor: 0.74,
      accentStrength: 0.22,
      groove: "space",
      trackGain: 1.2,
    }),
  });

  function createBgmPlayer() {
    const ctx = audioBus.ctx;
    const out = audioBus.bgm;
    const baseGain = out.gain.value;
    const TRACK_SWITCH_CROSSFADE_SECONDS = 0.25;

    let desiredTrack = null;
    let activeLayerIndex = -1;

    const lookaheadMs = 25;
    const scheduleAhead = 0.35;
    const scheduleSafety = 0.012;

    function createLayer() {
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(out);
      return {
        gainNode,
        intervalId: null,
        stopTimeoutId: null,
        trackName: null,
        nextStepTime: 0,
        step: 0,
        token: 0,
      };
    }

    const layers = [createLayer(), createLayer()];

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

    function scheduleOsc({
      type,
      midi,
      time,
      dur,
      gain,
      destination,
      freqEnd = null,
    }) {
      if (!settings.audio) return;
      if (midi == null) return;

      const { start, end } = sanitizeStart(time, dur);
      const span = end - start;
      if (type === "chime" || type === "chime-soft") {
        const f0 = midiToFreq(midi);
        const chimeBrightness = type === "chime" ? 1 : 0.72;
        const layers = [
          { wave: "triangle", ratio: 1, amp: 1.0, decay: 1.0 },
          { wave: "sine", ratio: 2, amp: 0.56, decay: 0.62 },
          { wave: "sine", ratio: 3, amp: 0.28, decay: 0.46 },
        ];
        for (const layer of layers) {
          const osc = ctx.createOscillator();
          const amp = ctx.createGain();
          const layerEnd = start + Math.max(0.02, span * layer.decay);
          const peakGain = Math.max(SILENT_GAIN, gain * layer.amp * chimeBrightness);
          osc.type = layer.wave;
          osc.frequency.setValueAtTime(Math.max(1, f0 * layer.ratio), start);
          amp.gain.setValueAtTime(SILENT_GAIN, start);
          amp.gain.exponentialRampToValueAtTime(peakGain, start + 0.004);
          amp.gain.exponentialRampToValueAtTime(SILENT_GAIN, layerEnd);
          osc.connect(amp);
          amp.connect(destination ?? out);
          osc.start(start);
          osc.stop(layerEnd + 0.03);
        }
        return;
      }

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
      amp.connect(destination ?? out);
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
      destination,
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
      amp.connect(destination ?? out);

      src.start(start);
      src.stop(end + 0.03);
    }

    function scheduleKick(time, gain = 0.026, destination = out) {
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
      amp.connect(destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }

    function scheduleSnare(time, gain = 0.018, destination = out) {
      scheduleNoise({
        time,
        dur: 0.095,
        gain,
        type: "bandpass",
        freq: 1800,
        q: 0.7,
        destination,
      });
    }

    function scheduleHat(time, gain = 0.006, destination = out) {
      scheduleNoise({
        time,
        dur: 0.03,
        gain,
        type: "highpass",
        freq: 7600,
        q: 0.9,
        destination,
      });
    }

    function resetLayerState(layer) {
      layer.trackName = null;
      layer.step = 0;
      layer.nextStepTime = 0;
    }

    function stopLayerImmediately(layer) {
      if (layer.intervalId) {
        clearInterval(layer.intervalId);
        layer.intervalId = null;
      }
      if (layer.stopTimeoutId) {
        clearTimeout(layer.stopTimeoutId);
        layer.stopTimeoutId = null;
      }
      layer.token += 1;
      const now = ctx.currentTime;
      holdParamAtTime(layer.gainNode.gain, now);
      layer.gainNode.gain.setValueAtTime(0, now);
      resetLayerState(layer);
    }

    function stopLayer(layer, fadeSeconds = 0.12) {
      if (!layer.trackName && !layer.intervalId && !layer.stopTimeoutId) return;
      if (layer.stopTimeoutId) {
        clearTimeout(layer.stopTimeoutId);
        layer.stopTimeoutId = null;
      }
      if (layer.intervalId) {
        clearInterval(layer.intervalId);
        layer.intervalId = null;
      }

      layer.token += 1;
      const tokenAtStop = layer.token;
      const now = ctx.currentTime;
      const fade = Math.max(0.02, fadeSeconds);
      holdParamAtTime(layer.gainNode.gain, now);
      layer.gainNode.gain.linearRampToValueAtTime(0, now + fade);

      const shutdownDelayMs = Math.ceil((fade + scheduleAhead + 0.05) * 1000);
      layer.stopTimeoutId = setTimeout(() => {
        if (layer.token !== tokenAtStop) return;
        layer.stopTimeoutId = null;
        const at = ctx.currentTime;
        holdParamAtTime(layer.gainNode.gain, at);
        layer.gainNode.gain.setValueAtTime(0, at);
        resetLayerState(layer);
      }, shutdownDelayMs);
    }

    function fadeOutLayer(layer, fadeSeconds = TRACK_SWITCH_CROSSFADE_SECONDS) {
      if (!layer.trackName && !layer.intervalId) return;
      if (layer.stopTimeoutId) {
        clearTimeout(layer.stopTimeoutId);
        layer.stopTimeoutId = null;
      }

      const tokenAtFade = layer.token;
      const now = ctx.currentTime;
      const fade = Math.max(0.02, fadeSeconds);
      holdParamAtTime(layer.gainNode.gain, now);
      layer.gainNode.gain.linearRampToValueAtTime(0, now + fade);

      const shutdownDelayMs = Math.ceil((fade + scheduleAhead + 0.05) * 1000);
      layer.stopTimeoutId = setTimeout(() => {
        if (layer.token !== tokenAtFade) return;
        if (layer.intervalId) {
          clearInterval(layer.intervalId);
          layer.intervalId = null;
        }
        layer.stopTimeoutId = null;
        layer.token += 1;
        const at = ctx.currentTime;
        holdParamAtTime(layer.gainNode.gain, at);
        layer.gainNode.gain.setValueAtTime(0, at);
        resetLayerState(layer);
      }, shutdownDelayMs);
    }

    function phaseStepAtTime(layer, time) {
      const track = getTrack(layer.trackName);
      if (!track) return 0;
      const stepDur = stepDurationSeconds(track);
      const steps = track.melody.length;
      if (!Number.isFinite(stepDur) || stepDur <= 0 || steps <= 0) return 0;
      const deltaSteps = Math.floor((time - layer.nextStepTime) / stepDur);
      const rawStep = layer.step + deltaSteps;
      return ((rawStep % steps) + steps) % steps;
    }

    function mapStepAcrossTracks(stepIndex, sourceSteps, targetSteps) {
      if (!Number.isFinite(stepIndex) || sourceSteps <= 0 || targetSteps <= 0) return 0;
      const normalizedStep = ((Math.floor(stepIndex) % sourceSteps) + sourceSteps) % sourceSteps;
      if (sourceSteps === targetSteps) return normalizedStep;
      const phase = normalizedStep / sourceSteps;
      return Math.floor(phase * targetSteps) % targetSteps;
    }

    function schedulerTick(layer) {
      if (!settings.audio) return;
      if (!layer.trackName) return;

      const track = getTrack(layer.trackName);
      if (!track) return;
      const stepDur = stepDurationSeconds(track);
      const steps = track.melody.length;
      const scheduleFrom = ctx.currentTime + scheduleSafety;
      const destination = layer.gainNode;

      if (layer.nextStepTime < scheduleFrom - stepDur) {
        const skippedSteps = Math.floor((scheduleFrom - layer.nextStepTime) / stepDur);
        if (skippedSteps > 0) {
          layer.step += skippedSteps;
          layer.nextStepTime += skippedSteps * stepDur;
        }
      }
      if (layer.nextStepTime < scheduleFrom) layer.nextStepTime = scheduleFrom;

      while (layer.nextStepTime < ctx.currentTime + scheduleAhead) {
        const i = layer.step % steps;
        const t = layer.nextStepTime;
        const dur = stepDur * (track.durFactor ?? 0.92);
        const beatStep = i % 8;
        const rawAccent = beatStep === 0 ? 1.18 : beatStep === 4 ? 1.08 : 1.0;
        const accentStrength = track.accentStrength ?? 1.0;
        const accent = 1 + (rawAccent - 1) * accentStrength;
        const trackGain = track.trackGain ?? 1.0;

        scheduleOsc({
          type: track.melodyType ?? "square",
          midi: track.melody[i],
          time: t,
          dur,
          gain: (track.melodyGain ?? 0.03) * accent * trackGain,
          destination,
        });
        scheduleOsc({
          type: track.harmonyType ?? "square",
          midi: track.harmony[i],
          time: t,
          dur,
          gain: (track.harmonyGain ?? 0.011) * trackGain,
          destination,
        });
        scheduleOsc({
          type: track.bassType ?? "triangle",
          midi: track.bass[i],
          time: t,
          dur,
          gain: (track.bassGain ?? 0.02) * trackGain,
          destination,
        });
        if (track.arp) {
          scheduleOsc({
            type: track.arpType ?? "triangle",
            midi: track.arp[i],
            time: t,
            dur: stepDur * (track.arpDurFactor ?? 0.55),
            gain: (track.arpGain ?? 0.007) * trackGain,
            destination,
          });
        }

        if (track.groove === "tense") {
          // Sparse, suspenseful pulse for castle variation.
          if (beatStep === 0 || beatStep === 5)
            scheduleKick(t, 0.021 * trackGain, destination);
          if (beatStep === 4) scheduleSnare(t, 0.012 * trackGain, destination);
          if (beatStep % 2 === 1) {
            scheduleHat(t, (beatStep === 7 ? 0.005 : 0.0036) * trackGain, destination);
          }
        } else if (track.groove === "cloud") {
          // Bright, playful bounce with light taps and sparkly air.
          if (beatStep === 0) scheduleKick(t, 0.0086 * trackGain, destination);
          if (beatStep === 4) scheduleSnare(t, 0.0062 * trackGain, destination);
          if (beatStep % 2 === 1) scheduleHat(t, 0.0032 * trackGain, destination);
          if (beatStep === 3 || beatStep === 7) {
            scheduleNoise({
              time: t,
              dur: stepDur * 1.2,
              gain: 0.0022 * trackGain,
              type: "highpass",
              freq: 9300,
              q: 0.78,
              destination,
            });
          }
        } else if (track.groove === "desert") {
          // Maqsum-inspired pattern: strong lows with syncopated high taps.
          if (beatStep === 0) scheduleKick(t, 0.027 * trackGain, destination);
          if (beatStep === 4) scheduleKick(t, 0.022 * trackGain, destination);
          if (beatStep === 1 || beatStep === 3 || beatStep === 6) {
            scheduleSnare(
              t,
              (beatStep === 3 ? 0.015 : 0.012) * trackGain,
              destination,
            );
          }
          if (beatStep % 2 === 1) {
            scheduleHat(
              t,
              (beatStep === 3 ? 0.0048 : 0.0038) * trackGain,
              destination,
            );
          }
          if (beatStep === 0 || beatStep === 4) {
            scheduleNoise({
              time: t,
              dur: stepDur * 1.8,
              gain: 0.0017 * trackGain,
              type: "bandpass",
              freq: 980,
              q: 0.7,
              destination,
            });
          }
        } else if (track.groove === "space") {
          // Light pulse with gentle air swells for moon/space levels.
          if (beatStep === 0) scheduleKick(t, 0.0165 * trackGain, destination);
          if (beatStep === 4) scheduleSnare(t, 0.0095 * trackGain, destination);
          if (beatStep === 3 || beatStep === 7)
            scheduleHat(t, 0.0033 * trackGain, destination);
          if (beatStep === 0) {
            scheduleNoise({
              time: t,
              dur: stepDur * 2.4,
              gain: 0.0024 * trackGain,
              type: "bandpass",
              freq: 2200,
              q: 0.55,
              destination,
            });
          }
        } else {
          // Classic platformer groove: kick on 1/3, snare on 2/4, hats on 8ths.
          if (beatStep === 0 || beatStep === 4)
            scheduleKick(t, 0.026 * trackGain, destination);
          if (beatStep === 2 || beatStep === 6)
            scheduleSnare(t, 0.018 * trackGain, destination);
          scheduleHat(
            t,
            (beatStep % 2 === 1 ? 0.007 : 0.0055) * trackGain,
            destination,
          );
        }

        layer.step += 1;
        layer.nextStepTime += stepDur;
      }
    }

    function startLayer(layer, trackName, startStep = 0, fadeInSeconds = 0.12) {
      const track = getTrack(trackName);
      if (!track) return false;

      stopLayerImmediately(layer);

      const steps = track.melody.length;
      const safeStep =
        steps > 0 ? ((Math.floor(startStep) % steps) + steps) % steps : 0;
      const now = ctx.currentTime;

      layer.trackName = trackName;
      layer.step = safeStep;
      layer.nextStepTime = now + 0.02;
      layer.token += 1;
      const token = layer.token;

      layer.gainNode.gain.setValueAtTime(0, now);
      layer.gainNode.gain.linearRampToValueAtTime(
        baseGain,
        now + Math.max(0.02, fadeInSeconds),
      );

      layer.intervalId = setInterval(() => {
        if (layer.token !== token) return;
        schedulerTick(layer);
      }, lookaheadMs);
      schedulerTick(layer);
      return true;
    }

    function resolveActiveLayer() {
      if (activeLayerIndex < 0) return null;
      const layer = layers[activeLayerIndex];
      if (!layer || !layer.trackName) return null;
      return layer;
    }

    function start(trackName) {
      if (!settings.audio) return;
      if (!trackName) return;
      const track = getTrack(trackName);
      if (!track) return;

      const activeLayer = resolveActiveLayer();
      if (activeLayer?.trackName === trackName && activeLayer.intervalId) return;

      if (!activeLayer) {
        const targetLayer = layers[0];
        if (startLayer(targetLayer, trackName, 0, 0.12)) {
          activeLayerIndex = 0;
        }
        return;
      }

      const nextIndex = activeLayerIndex === 0 ? 1 : 0;
      const nextLayer = layers[nextIndex];
      const targetTime = ctx.currentTime + 0.02;
      const fromTrack = getTrack(activeLayer.trackName);
      const sourceStep = phaseStepAtTime(activeLayer, targetTime);
      const mappedStep = mapStepAcrossTracks(
        sourceStep,
        fromTrack?.melody.length ?? 0,
        track.melody.length,
      );

      if (
        startLayer(
          nextLayer,
          trackName,
          mappedStep,
          TRACK_SWITCH_CROSSFADE_SECONDS,
        )
      ) {
        fadeOutLayer(activeLayer, TRACK_SWITCH_CROSSFADE_SECONDS);
        activeLayerIndex = nextIndex;
      }
    }

    function stop(fadeSeconds = 0.12) {
      for (const layer of layers) {
        stopLayer(layer, fadeSeconds);
      }
      activeLayerIndex = -1;
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

    rampGainTo(audioBus.master.gain, settings.audio ? MASTER_ON_GAIN : 0.0, 0.04);
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
