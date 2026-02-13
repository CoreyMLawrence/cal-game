import {
  buildBoss1Level,
  buildBoss2Level,
  buildBoss5Level,
  buildCastle1Level,
  buildCastle5_1Level,
  buildCastle5_2Level,
  buildCastle5_3Level,
  buildCastle5_4Level,
  buildCastle5_5Level,
  buildCloud1Level,
  buildDesert1Level,
  buildDesert2Level,
  buildDesert3Level,
  buildDesert4Level,
  buildDesert5Level,
  buildLevel1,
  buildLevel2,
  buildMoon1Level,
  buildSecretPowerupLevel,
  buildTrainingLevel,
} from "../levels/index.js";
import { createWorldData } from "../worlds/index.js";
import { createAudioSystem } from "./audio.js";

export function createGameCore() {
  "use strict";
  const CONFIG = Object.freeze({
    gameWidth: 960,
    gameHeight: 544,
    tileSize: 32,

    gravity: 2400,
    gravityMoon: 800,

    // Movement feel (adds “Mario-like” polish).
    walkSpeed: 240,
    runSpeed: 330,
    accelGround: 2200,
    accelAir: 1400,
    decelGround: 2800,
    decelAir: 1600,
    moonAirAccelScale: 1.35,
    moonAirDecelScale: 1.2,
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
    forgeDurationSeconds: 8,
    sandstormDurationSeconds: 10,
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
    pixelDensity: 1,
    maxFPS: 60,
    debug: false,
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

  const { ensureAudioReady, playSfx, bgm, toggleAudio } = createAudioSystem({
    audioCtx,
    settings,
    saveSettings,
    rand,
  });

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
    groundMoon: "assets/ground-moon.svg",
    groundCloud: "assets/ground-cloud.svg",
    block: "assets/block.svg",
    blockCastle: "assets/block-castle.svg",
    blockMoon: "assets/block-moon.svg",
    question: "assets/question.svg",
    questionForge: "assets/question-forge.svg",
    questionSand: "assets/question-sand.svg",
    usedBlock: "assets/used-block.svg",
    coin: "assets/coin.svg",
    superCoin: "assets/super-coin.svg",
    battery: "assets/battery.svg",
    wing: "assets/wing.svg",
    forgeCore: "assets/forge-core.svg",
    sandCore: "assets/sand-core.svg",
    desertObelisk: "assets/desert-obelisk.svg",
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
  loadSprite("ground-moon", ASSETS.groundMoon);
  loadSprite("ground-cloud", ASSETS.groundCloud);
  loadSprite("block", ASSETS.block);
  loadSprite("block-castle", ASSETS.blockCastle);
  loadSprite("block-moon", ASSETS.blockMoon);
  loadSprite("question", ASSETS.question);
  loadSprite("question-forge", ASSETS.questionForge);
  loadSprite("question-sand", ASSETS.questionSand);
  loadSprite("used-block", ASSETS.usedBlock);
  loadSprite("coin", ASSETS.coin);
  loadSprite("super-coin", ASSETS.superCoin);
  loadSprite("battery", ASSETS.battery);
  loadSprite("wing", ASSETS.wing);
  loadSprite("forge-core", ASSETS.forgeCore);
  loadSprite("sand-core", ASSETS.sandCore);
  loadSprite("desert-obelisk", ASSETS.desertObelisk);
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
      nextLevelId: "desert2",
      music: "overworld-desert",
      tutorialSteps: null,
    },
    desert2: {
      id: "desert2",
      title: "CARAVAN STRIDE",
      buildMap: buildDesert2Level,
      timeLimit: CONFIG.timeLimit + 30,
      nextLevelId: "desert3",
      music: "overworld-desert",
      sandstormDurationSeconds: 10,
      tutorialSteps: [
        {
          x: 22 * CONFIG.tileSize,
          text: "Sand Core blocks (Z) unleash a sandstorm that shreds nearby robots.",
        },
        {
          x: 62 * CONFIG.tileSize,
          text: "Tall robot stacks (t) move as one unit. Stomp the top to clear all 3.",
        },
      ],
    },
    desert3: {
      id: "desert3",
      title: "SUNKEN RUINS",
      buildMap: buildDesert3Level,
      timeLimit: CONFIG.timeLimit + 35,
      nextLevelId: "desert4",
      music: "overworld-desert",
      sandstormDurationSeconds: 10,
      tutorialSteps: null,
    },
    desert4: {
      id: "desert4",
      title: "DUSTSTORM TRIALS",
      buildMap: buildDesert4Level,
      timeLimit: CONFIG.timeLimit + 42,
      nextLevelId: "desert5",
      music: "overworld-desert",
      sandstormDurationSeconds: 10,
      tutorialSteps: null,
    },
    desert5: {
      id: "desert5",
      title: "SOLAR CITADEL GATE",
      buildMap: buildDesert5Level,
      timeLimit: CONFIG.timeLimit + 48,
      nextLevelId: "boss2",
      music: "overworld-desert",
      sandstormDurationSeconds: 10,
      doorTargetLevelId: "boss2",
      tutorialSteps: null,
    },
    boss2: {
      id: "boss2",
      title: "DUNE OVERSEER",
      buildMap: buildBoss2Level,
      timeLimit: CONFIG.timeLimit + 56,
      nextLevelId: "cloud1",
      music: "overworld-desert",
      isBossLevel: true,
      sandstormDurationSeconds: 10,
      tutorialSteps: null,
    },
    cloud1: {
      id: "cloud1",
      title: "SKY VINE ASCENT",
      buildMap: buildCloud1Level,
      timeLimit: CONFIG.timeLimit + 40,
      nextLevelId: "level-4-1",
      music: "overworld-cloud",
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
    "level-4-1": {
      id: "level-4-1",
      title: "MOON LANDING",
      buildMap: buildMoon1Level,
      timeLimit: CONFIG.timeLimit + 45,
      nextLevelId: "castle5_1",
      music: "overworld-space",
      levelStyle: "space",
      gravity: CONFIG.gravityMoon,
      airControlMultiplier: CONFIG.moonAirAccelScale,
      airBrakeMultiplier: CONFIG.moonAirDecelScale,
      jumpJetFx: true,
      tutorialSteps: null,
    },
    castle5_1: {
      id: "castle5_1",
      title: "ASH GATE BREACH",
      buildMap: buildCastle5_1Level,
      timeLimit: CONFIG.timeLimit + 50,
      nextLevelId: "castle5_2",
      music: "overworld-castle",
      levelStyle: "castle",
      wingDurationSeconds: 5,
      forgeDurationSeconds: 8,
      tutorialSteps: null,
    },
    castle5_2: {
      id: "castle5_2",
      title: "MAGMA FOUNDRY",
      buildMap: buildCastle5_2Level,
      timeLimit: CONFIG.timeLimit + 55,
      nextLevelId: "castle5_3",
      music: "overworld-castle",
      levelStyle: "castle",
      wingDurationSeconds: 5,
      forgeDurationSeconds: 8,
      tutorialSteps: null,
    },
    castle5_3: {
      id: "castle5_3",
      title: "CHAINLIFT CATACOMBS",
      buildMap: buildCastle5_3Level,
      timeLimit: CONFIG.timeLimit + 60,
      nextLevelId: "castle5_4",
      music: "overworld-castle",
      levelStyle: "castle",
      wingDurationSeconds: 5,
      forgeDurationSeconds: 8,
      tutorialSteps: null,
    },
    castle5_4: {
      id: "castle5_4",
      title: "OBSIDIAN REACTOR",
      buildMap: buildCastle5_4Level,
      timeLimit: CONFIG.timeLimit + 65,
      nextLevelId: "castle5_5",
      music: "overworld-castle",
      levelStyle: "castle",
      wingDurationSeconds: 5,
      forgeDurationSeconds: 8,
      tutorialSteps: null,
    },
    castle5_5: {
      id: "castle5_5",
      title: "THRONE APPROACH",
      buildMap: buildCastle5_5Level,
      timeLimit: CONFIG.timeLimit + 70,
      nextLevelId: "boss5",
      music: "overworld-castle",
      levelStyle: "castle",
      wingDurationSeconds: 5,
      forgeDurationSeconds: 8,
      doorTargetLevelId: "boss5",
      tutorialSteps: null,
    },
    boss5: {
      id: "boss5",
      title: "EMPEROR CORE",
      buildMap: buildBoss5Level,
      timeLimit: CONFIG.timeLimit + 75,
      nextLevelId: null,
      music: "overworld-castle",
      levelStyle: "castle",
      isBossLevel: true,
      tutorialSteps: null,
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
    power: "normal", // "normal" | "charged" | "winged" | "forged" | "sandstorm"
    wingSecondsLeft: 0,
    forgeSecondsLeft: 0,
    sandstormSecondsLeft: 0,
  };

  function resetRun() {
    run.lives = CONFIG.startingLives;
    run.coins = 0;
    run.score = 0;
    run.power = "normal";
    run.wingSecondsLeft = 0;
    run.forgeSecondsLeft = 0;
    run.sandstormSecondsLeft = 0;
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
    const previousPower = run.power;
    run.power = power;
    if (power === "charged") {
      run.forgeSecondsLeft = 0;
      run.sandstormSecondsLeft = 0;
      playSfx("power");
      if (worldPos) addFloatingText("CHARGED!", worldPos, rgb(52, 199, 89));
      return;
    }
    if (power === "winged") {
      run.forgeSecondsLeft = 0;
      run.sandstormSecondsLeft = 0;
      playSfx("power");
      if (worldPos) addFloatingText("WINGED!", worldPos, rgb(170, 235, 255));
      return;
    }
    if (power === "forged") {
      run.wingSecondsLeft = 0;
      run.sandstormSecondsLeft = 0;
      playSfx("forge");
      if (worldPos) addFloatingText("FORGE CORE!", worldPos, rgb(255, 156, 94));
      return;
    }
    if (power === "sandstorm") {
      run.wingSecondsLeft = 0;
      run.forgeSecondsLeft = 0;
      playSfx("sandstorm");
      if (worldPos) addFloatingText("SANDSTORM!", worldPos, rgb(243, 208, 114));
      return;
    }
    if (power === "normal") {
      run.wingSecondsLeft = 0;
      run.forgeSecondsLeft = 0;
      run.sandstormSecondsLeft = 0;
      if (previousPower === "forged") playSfx("forge-expire");
      else if (previousPower === "sandstorm") playSfx("sandstorm-expire");
      else playSfx("powerdown");
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
