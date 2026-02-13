export function registerGameScene(ctx) {
  const {
    registerCommonHotkeys,
    CONFIG,
    LEVELS,
    worldIdForLevel,
    WORLD_MAPS,
    WORLD_THEMES,
    INPUT,
    settings,
    run,
    best,
    maybeUpdateBest,
    markLevelCompleted,
    setPower,
    addCoin,
    addScore,
    awardOneUp,
    addFloatingText,
    centerBoxText,
    addFadeIn,
    playSfx,
    ensureAudioReady,
    bgm,
    onAnyInputPress,
    onAnyInputRelease,
    anyInputDown,
    approach,
    SECRET_POWERUP_LEVEL_ID,
  } = ctx;

  scene("game", (data) => {
    registerCommonHotkeys({ characterId: data?.characterId ?? "cal" });
    addFadeIn();

    const characterId = data?.characterId ?? "cal";
    const levelId = data?.levelId ?? "training";
    const levelSpec = LEVELS[levelId] ?? LEVELS.level1;
    const forceMoonGravity = levelId === "level-4-1";
    const sceneGravity =
      typeof levelSpec.gravity === "number"
        ? levelSpec.gravity
        : forceMoonGravity
          ? CONFIG.gravityMoon
          : CONFIG.gravity;
    setGravity(sceneGravity);
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
    const isSpaceLevel = levelStyle === "space" || forceMoonGravity;
    const isBossLevel = levelSpec.isBossLevel === true;

    let playerSpawnTile = vec2(0, 0);
    let goalPoleTile = null;
    let goalDoorTile = null;
    let bossTile = null;
    const hiddenBlockTileKeys = new Set();

    const map = levelSpec.buildMap();
    const mapGroundY = map.length - 1;
    const tileSize = CONFIG.tileSize;
    const airControlMultiplier =
      typeof levelSpec.airControlMultiplier === "number"
        ? levelSpec.airControlMultiplier
        : isSpaceLevel
          ? CONFIG.moonAirAccelScale
          : 1;
    const airBrakeMultiplier =
      typeof levelSpec.airBrakeMultiplier === "number"
        ? levelSpec.airBrakeMultiplier
        : isSpaceLevel
          ? CONFIG.moonAirDecelScale
          : 1;
    const jumpJetFx = levelSpec.jumpJetFx === true || isSpaceLevel;
    const levelWingDurationSeconds =
      typeof levelSpec.wingDurationSeconds === "number"
        ? levelSpec.wingDurationSeconds
        : CONFIG.wingDurationSeconds;
    const levelForgeDurationSeconds =
      typeof levelSpec.forgeDurationSeconds === "number"
        ? levelSpec.forgeDurationSeconds
        : CONFIG.forgeDurationSeconds;
    const groundSpriteName = isCastleLevel
      ? "ground-castle"
      : isDesertLevel
        ? "ground-desert"
        : isSpaceLevel
          ? "ground-moon"
          : isCloudLevel
            ? "ground-cloud"
            : "ground";
    const blockSpriteName = isCastleLevel
      ? "block-castle"
      : isSpaceLevel
        ? "block-moon"
      : isCloudLevel
        ? "ground-cloud"
        : "block";
    const PERF_CULL_MARGIN = tileSize * 8;
    const PERF_HALF_VIEW_W = width() / 2;
    const PERF_HALF_VIEW_H = height() / 2;
    const perfCullables = [];
    let worldDeathY = 0;

    function perfCull({ margin = PERF_CULL_MARGIN, hide = true } = {}) {
      return {
        id: "perfCull",
        require: ["pos"],
        cullMargin: margin,
        hideWhenCulled: hide,
        culledByPerf: false,
        add() {
          perfCullables.push(this);
        },
        destroy() {
          const idx = perfCullables.indexOf(this);
          if (idx !== -1) perfCullables.splice(idx, 1);
        },
      };
    }

    function updatePerfCullables() {
      if (pauseActive) return;
      const camera = camPos();
      const left = camera.x - PERF_HALF_VIEW_W;
      const right = camera.x + PERF_HALF_VIEW_W;
      const top = camera.y - PERF_HALF_VIEW_H;
      const bottom = camera.y + PERF_HALF_VIEW_H;

      for (let i = perfCullables.length - 1; i >= 0; i--) {
        const obj = perfCullables[i];
        if (!obj || !obj.exists()) {
          perfCullables.splice(i, 1);
          continue;
        }

        const margin = obj.cullMargin ?? PERF_CULL_MARGIN;
        const inViewBand =
          obj.pos.x >= left - margin &&
          obj.pos.x <= right + margin &&
          obj.pos.y >= top - margin &&
          obj.pos.y <= bottom + margin;
        const keepCollisionsActive = typeof obj.is === "function" && obj.is("solid");

        if (inViewBand) {
          if (!obj.culledByPerf) continue;
          obj.culledByPerf = false;
          obj.paused = false;
          if (obj.hideWhenCulled) obj.hidden = false;
          continue;
        }

        if (obj.culledByPerf) continue;
        obj.culledByPerf = true;
        if (!keepCollisionsActive) obj.paused = true;
        else obj.paused = false;
        if (obj.hideWhenCulled) obj.hidden = true;
      }
    }

    function tileTintFor(spriteName, tilePos = null) {
      if (isSpaceLevel) {
        if (spriteName === "spring") return rgb(178, 182, 190);
        if (
          spriteName === "ground" ||
          spriteName === "block" ||
          spriteName === "ground-moon" ||
          spriteName === "block-moon" ||
          spriteName === "ground-cloud"
        ) {
          if (!tilePos) return rgb(148, 152, 160);
          const tileX = Math.floor(tilePos.x);
          const tileY = Math.floor(tilePos.y);
          const seed = Math.abs(tileX * 89 + tileY * 53);
          const grayBases = [134, 140, 146, 152, 158, 164];
          const base = grayBases[seed % grayBases.length];
          const coolShift = (Math.floor(seed / 7) % 3) - 1;
          return rgb(base + coolShift, base + 3 + coolShift, base + 9 + coolShift);
        }
        return null;
      }
      if (!isDesertLevel) return null;
      if (spriteName === "block") return rgb(216, 172, 110);
      if (spriteName === "spring") return rgb(226, 194, 132);
      return null;
    }

    function moonRockDetailFor(spriteName) {
      if (!isSpaceLevel) return null;
      if (
        spriteName !== "ground" &&
        spriteName !== "block" &&
        spriteName !== "ground-moon" &&
        spriteName !== "block-moon" &&
        spriteName !== "ground-cloud"
      ) {
        return null;
      }
      return {
        id: "moonRockDetail",
        require: ["pos"],
        draw() {
          const tileX = Math.floor(this.pos.x / tileSize);
          const tileY = Math.floor(this.pos.y / tileSize);
          const seed = Math.abs(tileX * 97 + tileY * 57);

          const c1x = 7 + (seed % 10);
          const c1y = 8 + (Math.floor(seed / 3) % 8);
          const c1r = 2.8 + (seed % 3) * 0.45;
          drawCircle({
            pos: this.pos.add(c1x, c1y),
            radius: c1r,
            color: rgb(110, 114, 124),
            opacity: 0.35,
          });
          drawCircle({
            pos: this.pos.add(c1x - 1, c1y - 1),
            radius: Math.max(1.5, c1r - 1.3),
            color: rgb(170, 174, 182),
            opacity: 0.22,
          });

          const c2x = 16 + (Math.floor(seed / 7) % 9);
          const c2y = 12 + (Math.floor(seed / 5) % 8);
          const c2r = 2 + (Math.floor(seed / 11) % 3) * 0.4;
          drawCircle({
            pos: this.pos.add(c2x, c2y),
            radius: c2r,
            color: rgb(106, 110, 120),
            opacity: 0.28,
          });
        },
      };
    }

    function solidTile(spriteName, extra = [], tilePos = null) {
      const tint = tileTintFor(spriteName, tilePos);
      const moonRockDetail = moonRockDetailFor(spriteName);
      return [
        sprite(spriteName),
        ...(tint ? [color(tint.r, tint.g, tint.b)] : []),
        ...(moonRockDetail ? [moonRockDetail] : []),
        area(),
        body({ isStatic: true }),
        perfCull(),
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
        perfCull(),
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
        perfCull(),
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
          run.forgeSecondsLeft = 0;
          setPower("charged", player.pos.add(tileSize / 2, 0));
          setInvincible(CONFIG.powerInvincibleSeconds);
        },
      }),
      wing: Object.freeze({
        sprite: "wing",
        power: "winged",
        text: `FLIGHT +${Math.max(1, Math.floor(levelWingDurationSeconds))}s`,
        textColor: rgb(170, 235, 255),
        apply() {
          run.forgeSecondsLeft = 0;
          run.wingSecondsLeft = levelWingDurationSeconds;
          setPower("winged", player.pos.add(tileSize / 2, 0));
          setInvincible(CONFIG.powerInvincibleSeconds);
        },
      }),
      forge: Object.freeze({
        sprite: "forge-core",
        power: "forged",
        text: `FORGE CORE +${Math.max(1, Math.floor(levelForgeDurationSeconds))}s`,
        textColor: rgb(255, 176, 120),
        apply() {
          run.wingSecondsLeft = 0;
          run.forgeSecondsLeft = levelForgeDurationSeconds;
          setPower("forged", player.pos.add(tileSize / 2, 0));
          setInvincible(CONFIG.powerInvincibleSeconds);
        },
      }),
    });

    function powerupSpec(kind) {
      return POWERUP_SPECS[kind] ?? POWERUP_SPECS.battery;
    }

    function questionBlockTile(reward) {
      const spriteName = reward === "forge" ? "question-forge" : "question";
      return [
        sprite(spriteName),
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
        perfCull(),
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
        perfCull(),
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
        perfCull(),
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
        perfCull(),
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

    function astroHelmetComponent() {
      return {
        id: "astroHelmet",
        require: ["pos"],
        draw() {
          const center = this.pos.add(tileSize * 0.5, tileSize * 0.35);
          const helmetRadius = tileSize * 0.26;
          drawCircle({
            pos: center,
            radius: helmetRadius,
            color: rgb(195, 229, 255),
            opacity: 0.25,
          });
          drawCircle({
            pos: center,
            radius: helmetRadius,
            fill: false,
            outline: {
              width: 2,
              color: rgb(238, 246, 255),
            },
            opacity: 0.82,
          });
          drawCircle({
            pos: center.add(-tileSize * 0.08, -tileSize * 0.08),
            radius: tileSize * 0.06,
            color: rgb(255, 255, 255),
            opacity: 0.38,
          });
        },
      };
    }

    const ENEMY_STOMP_ZONE_OFFSET_Y = 8.3;
    const ENEMY_STOMP_ZONE_HEIGHT = 5;
    const ENEMY_STOMP_ZONE_GRACE = 5;

    function enemyDamageArea() {
      return area({
        scale: vec2(0.72, 0.72),
        offset: vec2(4.5, 8.3),
      });
    }

    function enemyTile(spriteName, opts = {}, tilePos = null) {
      const phase =
        opts.flightPhase ??
        (tilePos ? tilePos.x * 0.31 + tilePos.y * 0.47 : rand(0, Math.PI * 2));
      const helmetComponents = opts.astro ? [astroHelmetComponent()] : [];
      const astroTags = opts.astro ? ["astroEnemy"] : [];
      if (opts.flying) {
        return [
          sprite(spriteName),
          enemyDamageArea(),
          perfCull({ margin: tileSize * 10 }),
          "enemy",
          "danger",
          "flyingEnemy",
          ...astroTags,
          ...helmetComponents,
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
              if (this.pos.y > worldDeathY) destroy(this);
            },
          },
        ];
      }
      if (opts.floater) {
        return [
          sprite(spriteName),
          enemyDamageArea(),
          perfCull({ margin: tileSize * 10 }),
          "enemy",
          "danger",
          "floaterEnemy",
          ...astroTags,
          ...helmetComponents,
          {
            home: null,
            floatRangeY: opts.floatRangeY ?? 20,
            floatSpeed: opts.floatSpeed ?? 1.9,
            floatPhase: phase,
            update() {
              if (!this.home) this.home = this.pos.clone();
              const t = time() * this.floatSpeed + this.floatPhase;
              this.pos.x = this.home.x;
              this.pos.y = this.home.y + Math.sin(t) * this.floatRangeY;
              this.flipX = false;
              if (this.pos.y > worldDeathY) destroy(this);
            },
          },
        ];
      }
      return [
        sprite(spriteName),
        // Keep damage contact slightly inset from robot art to avoid "ghost" hits.
        enemyDamageArea(),
        body(),
        perfCull({ margin: tileSize * 10 }),
        "enemy",
        "danger",
        ...astroTags,
        ...helmetComponents,
        {
          dir: -1,
          speed: opts.speed,
          smart: opts.smart ?? true,
        },
      ];
    }

    function hiddenTileKey(tilePos) {
      return `${Math.floor(tilePos.x)},${Math.floor(tilePos.y)}`;
    }

    const level = addLevel(map, {
      tileWidth: tileSize,
      tileHeight: tileSize,
      tiles: {
        "=": (tilePos) =>
          solidTile(
            groundSpriteName,
            isCloudLevel && tilePos.y < mapGroundY ? ["cloudSemi"] : [],
            tilePos,
          ),
        "#": (tilePos) =>
          solidTile(
            blockSpriteName,
            isCloudLevel && tilePos.y < mapGroundY ? ["cloudSemi"] : [],
            tilePos,
          ),
        B: (tilePos) => solidTile(blockSpriteName, ["brick", "breakable"], tilePos),
        "~": (tilePos) => [
          ...solidTile(
            blockSpriteName,
            isCloudLevel ? ["platform", "cloudSemi"] : ["platform"],
            tilePos,
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
            tilePos,
          ),
          movingPlatform({
            axis: "y",
            range: isCloudLevel ? 66 : 52,
            speed: 1.0,
            phase: tilePos.x * 0.33 + tilePos.y * 0.21,
          }),
        ],
        c: () => fragileCloudTile(),
        "^": (tilePos) => solidTile("spring", ["spring"], tilePos),
        L: () => lavaTile(),
        F: () => fireTile(),
        o: () => coinTile(),
        v: () => vineTile(),
        "?": () => questionBlockTile("coin"),
        "*": () => questionBlockTile("battery"),
        W: () => questionBlockTile("wing"),
        M: () => questionBlockTile("forge"),
        S: () => questionBlockTile("supercoin"),
        O: () => superCoinTile(),
        h: (tilePos) => {
          hiddenBlockTileKeys.add(hiddenTileKey(tilePos));
          return null;
        },
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
              : isSpaceLevel
                ? { speed: CONFIG.enemySpeed, smart: true, astro: true }
                : { speed: CONFIG.enemySpeed, smart: true },
            tilePos,
          ),
        a: (tilePos) =>
          enemyTile(
            "robot-red",
            {
              speed: CONFIG.enemySpeed,
              smart: true,
              astro: true,
            },
            tilePos,
          ),
        b: () =>
          enemyTile("robot-blue", {
            speed: CONFIG.enemyFastSpeed,
            smart: true,
          }),
        f: (tilePos) =>
          enemyTile(
            "robot-blue",
            {
              floater: true,
              floatRangeY: 19,
              floatSpeed: 2.1,
              astro: true,
            },
            tilePos,
          ),
        p: () =>
          enemyTile("robot-pink", {
            speed: CONFIG.enemySpeed - 14,
            smart: true,
          }),
      },
    });

    worldDeathY = level.levelHeight() + CONFIG.fallDeathPadding;

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
        color(levelTheme.skyTop.r, levelTheme.skyTop.g, levelTheme.skyTop.b),
        opacity(1),
      ]);
    }

    function addSpaceLevelBackdrop() {
      const backdrop = add([pos(0, 0), z(-236)]);
      const levelW = level.levelWidth();

      backdrop.add([
        rect(levelW + 400, height() + 20),
        pos(-200, -10),
        color(2, 6, 20),
        opacity(1),
      ]);

      for (let i = 0; i < 170; i++) {
        const starX = rand(-100, levelW + 100);
        const starY = rand(0, height() - 44);
        const starRadius = rand(0.65, 2.05);
        const starAlpha = rand(0.28, 0.96);
        const starPhase = rand(0, Math.PI * 2);
        const starSpeed = rand(1.1, 3.6);

        backdrop.add([
          circle(starRadius),
          pos(starX, starY),
          color(255, 255, 255),
          opacity(starAlpha),
          perfCull({ margin: tileSize * 10, hide: false }),
          {
            update() {
              this.opacity =
                starAlpha * (0.58 + Math.sin(time() * starSpeed + starPhase) * 0.42);
            },
          },
        ]);
      }

      const distantBodies = add([pos(0, 0), z(-234)]);
      const bodyPalettes = [
        { body: rgb(110, 146, 204), glow: rgb(148, 182, 236) },
        { body: rgb(172, 126, 94), glow: rgb(220, 166, 124) },
        { body: rgb(92, 152, 160), glow: rgb(134, 196, 206) },
      ];
      let bodyX = width() + 120;
      while (bodyX < levelW + 260) {
        const paletteIndex = Math.min(
          bodyPalettes.length - 1,
          Math.floor(rand(0, bodyPalettes.length)),
        );
        const palette = bodyPalettes[paletteIndex];
        const bodyRadius = rand(8, 18);
        const bodyY = rand(48, 170);
        const bodyAlpha = rand(0.24, 0.46);

        distantBodies.add([
          circle(bodyRadius + rand(2, 5)),
          pos(bodyX, bodyY),
          color(palette.glow.r, palette.glow.g, palette.glow.b),
          opacity(bodyAlpha * 0.32),
          perfCull({ margin: tileSize * 14 }),
        ]);
        distantBodies.add([
          circle(bodyRadius),
          pos(bodyX, bodyY),
          color(palette.body.r, palette.body.g, palette.body.b),
          opacity(bodyAlpha),
          perfCull({ margin: tileSize * 14 }),
        ]);

        if (rand(0, 1) > 0.62) {
          const miniMoonRadius = Math.max(2.2, bodyRadius * 0.22);
          distantBodies.add([
            circle(miniMoonRadius),
            pos(
              bodyX + rand(-bodyRadius * 2.4, bodyRadius * 2.4),
              bodyY + rand(-bodyRadius * 1.4, bodyRadius * 1.4),
            ),
            color(188, 202, 222),
            opacity(bodyAlpha * 0.74),
            perfCull({ margin: tileSize * 14 }),
          ]);
        }

        bodyX += rand(420, 620);
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

    function addMoonSetPieces() {
      if (!isSpaceLevel) return;
      const sceneProps = add([pos(0, 0), z(-80)]);

      if (!goalPoleTile) return;
      const surfaceY = level.tile2Pos(vec2(goalPoleTile.x, mapGroundY)).y + tileSize;
      const domeCenter = vec2(
        level.tile2Pos(goalPoleTile).x + tileSize * 2.2,
        surfaceY - tileSize * 1.06,
      );

      sceneProps.add([
        rect(tileSize * 3.2, tileSize * 0.66, { radius: 5 }),
        pos(domeCenter.add(-tileSize * 1.6, tileSize * 0.42)),
        color(118, 126, 138),
        opacity(0.93),
        perfCull({ margin: tileSize * 12 }),
      ]);
      sceneProps.add([
        circle(tileSize * 1.08),
        pos(domeCenter),
        color(170, 180, 195),
        opacity(0.92),
        perfCull({ margin: tileSize * 12 }),
      ]);
      sceneProps.add([
        circle(tileSize * 0.86),
        pos(domeCenter.add(0, -tileSize * 0.06)),
        color(210, 222, 236),
        opacity(0.28),
        perfCull({ margin: tileSize * 12 }),
      ]);
      sceneProps.add([
        rect(tileSize * 0.7, tileSize * 0.42, { radius: 3 }),
        pos(domeCenter.add(-tileSize * 0.35, tileSize * 0.3)),
        color(88, 96, 108),
        opacity(0.88),
        perfCull({ margin: tileSize * 12 }),
      ]);

      const rocketAnchor = domeCenter.add(-tileSize * 4.9, -tileSize * 2.5);
      sceneProps.add([
        sprite("ufo-boss"),
        pos(rocketAnchor),
        scale(1.25),
        color(214, 224, 240),
        opacity(0.92),
        perfCull({ margin: tileSize * 12 }),
        {
          home: null,
          update() {
            if (!this.home) this.home = this.pos.clone();
            this.pos.y = this.home.y + Math.sin(time() * 1.6) * 2.5;
          },
        },
      ]);
      sceneProps.add([
        circle(tileSize * 0.48),
        pos(rocketAnchor.add(tileSize * 0.82, tileSize * 2.1)),
        color(108, 116, 128),
        opacity(0.62),
        perfCull({ margin: tileSize * 12 }),
      ]);
    }

    if (isCastleLevel) addCastleLevelBackdrop({ includeEmbers: !isBossLevel });
    else if (isDesertLevel) addDesertLevelBackdrop();
    else if (isCloudLevel) addCloudLevelBackdrop();
    else if (isSpaceLevel) addSpaceLevelBackdrop();
    else addGrassyLevelBackdrop();
    addMoonSetPieces();

    const playerStartPos = level.tile2Pos(playerSpawnTile).add(0, -tileSize);

    const PLAYER_MAX_FALL_SPEED = tileSize * 30;
    const PLAYER_MOVE_SUBSTEP = tileSize * 0.2;
    const PLAYER_SOLID_EPSILON = 0.01;
    const PLAYER_GROUND_PROBE = 2;

    const player = add([
      sprite("cal"),
      pos(playerStartPos),
      // Cal art occupies only part of the 32x32 tile, so keep collider tight.
      area({
        scale: vec2(0.52, 0.7),
        offset: vec2(7.7, 5.4),
      }),
      opacity(1),
      "player",
    ]);

    player.vel = vec2(0, 0);
    player.gravityScale = 1;

    const playerHitbox = (() => {
      const box = player.worldArea().bbox();
      return {
        offsetX: box.pos.x - player.pos.x,
        offsetY: box.pos.y - player.pos.y,
        width: box.width,
        height: box.height,
      };
    })();

    let playerGrounded = false;
    let playerGroundObject = null;
    let playerGroundObjectPos = null;

    player.isGrounded = () => playerGrounded;
    player.isFalling = () => player.vel.y > 0;
    player.isJumping = () => player.vel.y < 0;
    player.jump = (force = CONFIG.jumpForce) => {
      playerGrounded = false;
      playerGroundObject = null;
      playerGroundObjectPos = null;
      player.vel.y = -force;
    };
    player.onGround = (action) => player.on("ground", action);
    player.onHeadbutt = (action) => player.on("headbutt", action);

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

    function spawnJetpackPuff() {
      if (!jumpJetFx) return;
      const basePos = player.pos.add(tileSize * 0.5, tileSize * 0.95);
      for (let i = 0; i < 6; i++) {
        add([
          circle(rand(1.8, 3.6)),
          pos(basePos.add(rand(-7, 7), rand(-2, 4))),
          color(205, 220, 238),
          opacity(rand(0.28, 0.62)),
          lifespan(0.42, { fade: 0.22 }),
          move(vec2(rand(-0.45, 0.45), 1), rand(55, 105)),
          z(1560),
        ]);
      }
    }

    function loseLife(reason = "hurt") {
      if (ending) return;
      ending = true;

      bgm.stop(0.08);
      run.lives -= 1;
      run.power = "normal";
      run.wingSecondsLeft = 0;
      run.forgeSecondsLeft = 0;
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
        perfCull({ margin: tileSize * 8 }),
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
        if (p.pos.y > worldDeathY) destroy(p);
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
        perfCull({ margin: tileSize * 8 }),
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
        if (p.pos.y > worldDeathY) destroy(p);
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

    function revealHiddenBlock(tilePos) {
      if (!tilePos) return false;
      const key = hiddenTileKey(tilePos);
      if (!hiddenBlockTileKeys.has(key)) return false;
      hiddenBlockTileKeys.delete(key);

      const normalized = vec2(Math.floor(tilePos.x), Math.floor(tilePos.y));
      const block = level.spawn([
        sprite("used-block"),
        area(),
        body({ isStatic: true }),
        perfCull(),
        "solid",
        "hiddenBlock",
      ], normalized);

      // Hidden block behaves like a head bump: reveal, stop upward motion, and keep player below.
      playSfx("bump");
      const blockBottomY = block.pos.y + tileSize;
      if (player.pos.y < blockBottomY) player.pos.y = blockBottomY;
      if (player.vel.y < 0) player.vel.y = 0;

      return true;
    }

    function handlePlayerHeadbutt(obj) {
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
    }

    function isSolidCollider(obj, { allowCloudSemi = true } = {}) {
      if (!obj || typeof obj.is !== "function") return false;
      if (typeof obj.exists === "function" && !obj.exists()) return false;
      if (!obj.is("solid") || obj.solidEnabled === false) return false;
      if (!allowCloudSemi && obj.is("cloudSemi")) return false;
      return true;
    }

    const solidTileQuery = vec2(0, 0);
    function solidObjectsAtTile(tileX, tileY, { allowCloudSemi = true } = {}) {
      if (tileX < 0 || tileY < 0) return [];
      if (tileX >= level.numColumns() || tileY >= level.numRows()) return [];
      solidTileQuery.x = tileX;
      solidTileQuery.y = tileY;
      return level
        .getAt(solidTileQuery)
        .filter((obj) => isSolidCollider(obj, { allowCloudSemi }));
    }

    function solidBounds(obj, tileX, tileY) {
      if (obj && typeof obj.worldArea === "function") {
        const box = obj.worldArea().bbox();
        return {
          left: box.pos.x,
          top: box.pos.y,
          right: box.pos.x + box.width,
          bottom: box.pos.y + box.height,
        };
      }
      const tilePos = level.tile2Pos(vec2(tileX, tileY));
      return {
        left: tilePos.x,
        top: tilePos.y,
        right: tilePos.x + tileSize,
        bottom: tilePos.y + tileSize,
      };
    }

    function playerBoxAt(pos = player.pos) {
      const left = pos.x + playerHitbox.offsetX;
      const top = pos.y + playerHitbox.offsetY;
      return {
        left,
        top,
        right: left + playerHitbox.width,
        bottom: top + playerHitbox.height,
      };
    }

    function clearGroundedState() {
      playerGrounded = false;
      playerGroundObject = null;
      playerGroundObjectPos = null;
    }

    function setGroundedState(groundObj) {
      const wasGrounded = playerGrounded;
      playerGrounded = true;
      playerGroundObject = groundObj ?? null;
      playerGroundObjectPos =
        groundObj && groundObj.exists() && groundObj.pos ? groundObj.pos.clone() : null;
      if (!wasGrounded) player.trigger("ground", groundObj ?? null);
    }

    function getGroundCarryDelta() {
      if (!playerGrounded || !playerGroundObject || !playerGroundObject.exists()) {
        clearGroundedState();
        return vec2(0, 0);
      }
      if (!playerGroundObject.pos) return vec2(0, 0);
      if (!playerGroundObjectPos) {
        playerGroundObjectPos = playerGroundObject.pos.clone();
        return vec2(0, 0);
      }
      return playerGroundObject.pos.sub(playerGroundObjectPos);
    }

    function tryRevealHiddenBlockFromHead(startPos = player.pos, endPos = player.pos) {
      if (hiddenBlockTileKeys.size === 0) return false;
      const dx = endPos.x - startPos.x;
      const dy = endPos.y - startPos.y;
      if (dy >= -1) return false;

      const sweepDistance = Math.max(Math.abs(dx), Math.abs(dy));
      const steps = Math.max(1, Math.ceil(sweepDistance / PLAYER_MOVE_SUBSTEP));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const sampleXBase = startPos.x + dx * t;
        const sampleY = startPos.y + dy * t - 1;
        const sampleXs = [
          sampleXBase + tileSize * 0.18,
          sampleXBase + tileSize * 0.5,
          sampleXBase + tileSize * 0.82,
        ];

        for (const sampleX of sampleXs) {
          const tilePos = level.pos2Tile(vec2(sampleX, sampleY));
          if (revealHiddenBlock(tilePos)) return true;
        }
      }
      return false;
    }

    function resolveHorizontalStep(stepX) {
      if (Math.abs(stepX) <= PLAYER_SOLID_EPSILON) return;
      player.pos.x += stepX;

      const box = playerBoxAt();
      const minTileY = Math.floor((box.top + PLAYER_SOLID_EPSILON) / tileSize);
      const maxTileY = Math.floor((box.bottom - PLAYER_SOLID_EPSILON) / tileSize);

      if (stepX > 0) {
        const tileX = Math.floor((box.right - PLAYER_SOLID_EPSILON) / tileSize);
        let resolvedX = player.pos.x;
        let collided = false;
        for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
          const solids = solidObjectsAtTile(tileX, tileY, { allowCloudSemi: true });
          for (const solid of solids) {
            const solidBox = solidBounds(solid, tileX, tileY);
            if (box.bottom <= solidBox.top + PLAYER_SOLID_EPSILON) continue;
            if (box.top >= solidBox.bottom - PLAYER_SOLID_EPSILON) continue;
            if (box.left >= solidBox.right - PLAYER_SOLID_EPSILON) continue;
            if (box.right <= solidBox.left + PLAYER_SOLID_EPSILON) continue;

            const targetX =
              solidBox.left - (playerHitbox.offsetX + playerHitbox.width) - PLAYER_SOLID_EPSILON;
            if (targetX < resolvedX) resolvedX = targetX;
            collided = true;
          }
        }
        if (collided) {
          player.pos.x = resolvedX;
          if (velX > 0) velX = 0;
        }
        return;
      }

      const tileX = Math.floor((box.left + PLAYER_SOLID_EPSILON) / tileSize);
      let resolvedX = player.pos.x;
      let collided = false;
      for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
        const solids = solidObjectsAtTile(tileX, tileY, { allowCloudSemi: true });
        for (const solid of solids) {
          const solidBox = solidBounds(solid, tileX, tileY);
          if (box.bottom <= solidBox.top + PLAYER_SOLID_EPSILON) continue;
          if (box.top >= solidBox.bottom - PLAYER_SOLID_EPSILON) continue;
          if (box.right <= solidBox.left + PLAYER_SOLID_EPSILON) continue;
          if (box.left >= solidBox.right - PLAYER_SOLID_EPSILON) continue;

          const targetX = solidBox.right - playerHitbox.offsetX + PLAYER_SOLID_EPSILON;
          if (targetX > resolvedX) resolvedX = targetX;
          collided = true;
        }
      }
      if (collided) {
        player.pos.x = resolvedX;
        if (velX < 0) velX = 0;
      }
    }

    function resolveVerticalStep(stepY) {
      if (Math.abs(stepY) <= PLAYER_SOLID_EPSILON) {
        return { landedObj: null, hitHead: false };
      }
      const startPos = player.pos.clone();
      player.pos.y += stepY;

      if (stepY < 0 && tryRevealHiddenBlockFromHead(startPos, player.pos.clone())) {
        return { landedObj: null, hitHead: true };
      }

      const box = playerBoxAt();
      const minTileX = Math.floor((box.left + PLAYER_SOLID_EPSILON) / tileSize);
      const maxTileX = Math.floor((box.right - PLAYER_SOLID_EPSILON) / tileSize);

      if (stepY > 0) {
        const tileY = Math.floor((box.bottom - PLAYER_SOLID_EPSILON) / tileSize);
        const startBox = playerBoxAt(startPos);
        let resolvedY = player.pos.y;
        let landedObj = null;

        for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
          const solids = solidObjectsAtTile(tileX, tileY, { allowCloudSemi: true });
          for (const solid of solids) {
            const solidBox = solidBounds(solid, tileX, tileY);
            if (box.right <= solidBox.left + PLAYER_SOLID_EPSILON) continue;
            if (box.left >= solidBox.right - PLAYER_SOLID_EPSILON) continue;
            if (box.top >= solidBox.bottom - PLAYER_SOLID_EPSILON) continue;
            if (box.bottom <= solidBox.top + PLAYER_SOLID_EPSILON) continue;

            if (solid.is("cloudSemi") && startBox.bottom > solidBox.top + 1.5) continue;

            const targetY =
              solidBox.top - (playerHitbox.offsetY + playerHitbox.height) - PLAYER_SOLID_EPSILON;
            if (targetY < resolvedY) {
              resolvedY = targetY;
              landedObj = solid;
            }
          }
        }

        if (landedObj) {
          player.pos.y = resolvedY;
          if (player.vel.y > 0) player.vel.y = 0;
        }
        return { landedObj, hitHead: false };
      }

      const tileY = Math.floor((box.top + PLAYER_SOLID_EPSILON) / tileSize);
      let resolvedY = player.pos.y;
      let headObj = null;
      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
        const solids = solidObjectsAtTile(tileX, tileY, { allowCloudSemi: false });
        for (const solid of solids) {
          const solidBox = solidBounds(solid, tileX, tileY);
          if (box.right <= solidBox.left + PLAYER_SOLID_EPSILON) continue;
          if (box.left >= solidBox.right - PLAYER_SOLID_EPSILON) continue;
          if (box.bottom <= solidBox.top + PLAYER_SOLID_EPSILON) continue;
          if (box.top >= solidBox.bottom - PLAYER_SOLID_EPSILON) continue;

          const targetY = solidBox.bottom - playerHitbox.offsetY + PLAYER_SOLID_EPSILON;
          if (targetY > resolvedY) {
            resolvedY = targetY;
            headObj = solid;
          }
        }
      }

      if (headObj) {
        player.pos.y = resolvedY;
        if (player.vel.y < 0) player.vel.y = 0;
        player.trigger("headbutt", headObj);
        return { landedObj: null, hitHead: true };
      }
      return { landedObj: null, hitHead: false };
    }

    function snapPlayerToGround() {
      const box = playerBoxAt();
      const sampleXs = [
        box.left + 1,
        (box.left + box.right) * 0.5,
        box.right - 1,
      ];
      const sampleY = box.bottom + PLAYER_GROUND_PROBE;
      let best = null;

      for (const sampleX of sampleXs) {
        const tileX = Math.floor(sampleX / tileSize);
        const tileY = Math.floor(sampleY / tileSize);
        const solids = solidObjectsAtTile(tileX, tileY, { allowCloudSemi: true });
        for (const solid of solids) {
          const solidBox = solidBounds(solid, tileX, tileY);
          if (box.right <= solidBox.left + PLAYER_SOLID_EPSILON) continue;
          if (box.left >= solidBox.right - PLAYER_SOLID_EPSILON) continue;
          if (solid.is("cloudSemi") && box.bottom > solidBox.top + 1.5) continue;

          const verticalDelta = solidBox.top - box.bottom;
          if (verticalDelta < -PLAYER_GROUND_PROBE - PLAYER_SOLID_EPSILON) continue;
          if (verticalDelta > PLAYER_GROUND_PROBE + PLAYER_SOLID_EPSILON) continue;

          const targetY =
            solidBox.top - (playerHitbox.offsetY + playerHitbox.height) - PLAYER_SOLID_EPSILON;
          if (!best || targetY < best.targetY) best = { obj: solid, targetY };
        }
      }

      if (!best) return null;
      player.pos.y = best.targetY;
      if (player.vel.y > 0) player.vel.y = 0;
      return best.obj;
    }

    function triggerSpringBounce(spring) {
      if (!spring || !spring.exists()) return;
      playSfx("spring");
      shake(4);
      spring.use(scale(1, 0.85));
      wait(0.08, () => {
        if (spring.exists()) spring.use(scale(1, 1));
      });
      player.jump(CONFIG.jumpForce * 1.35);
    }

    function movePlayerKinematic(totalDx, totalDy) {
      const distance = Math.max(Math.abs(totalDx), Math.abs(totalDy));
      const steps = Math.max(1, Math.ceil(distance / PLAYER_MOVE_SUBSTEP));
      const stepX = totalDx / steps;
      let stepY = totalDy / steps;
      let landedObj = null;

      for (let i = 0; i < steps; i++) {
        resolveHorizontalStep(stepX);
        const verticalResult = resolveVerticalStep(stepY);
        if (verticalResult.landedObj) {
          landedObj = verticalResult.landedObj;
          stepY = 0;
          continue;
        }
        if (verticalResult.hitHead) stepY = 0;
      }

      if (!landedObj && player.vel.y >= -PLAYER_SOLID_EPSILON) {
        landedObj = snapPlayerToGround();
      }

      if (landedObj) {
        if (landedObj.is("spring")) {
          triggerSpringBounce(landedObj);
          return;
        }
        if (landedObj.is("fragileCloud") && typeof landedObj.triggerCollapse === "function") {
          landedObj.triggerCollapse();
        }
        setGroundedState(landedObj);
      } else {
        clearGroundedState();
      }
    }

    function placePlayerOnSpawnGround() {
      const spawnTileX = Math.floor(playerSpawnTile.x);
      const groundRowY = mapGroundY;
      const spawnTilePos = level.tile2Pos(vec2(spawnTileX, groundRowY));
      const rowSolids = solidObjectsAtTile(spawnTileX, groundRowY, { allowCloudSemi: true });

      player.pos.x = spawnTilePos.x;

      if (rowSolids.length > 0) {
        player.pos.y =
          spawnTilePos.y - (playerHitbox.offsetY + playerHitbox.height) - PLAYER_SOLID_EPSILON;
        player.vel.y = 0;
        playerGrounded = true;
        playerGroundObject = rowSolids[0];
        playerGroundObjectPos =
          rowSolids[0] && rowSolids[0].exists() && rowSolids[0].pos
            ? rowSolids[0].pos.clone()
            : null;
        lastGroundedAt = time();
        return;
      }

      // Rare fallback for maps where spawn column has no base ground.
      {
        const box = playerBoxAt();
        const sampleXs = [box.left + 1, (box.left + box.right) * 0.5, box.right - 1];
        const startTileY = Math.floor((box.bottom + PLAYER_SOLID_EPSILON) / tileSize);
        let best = null;

        for (const sampleX of sampleXs) {
          const tileX = Math.floor(sampleX / tileSize);
          for (let tileY = startTileY; tileY < level.numRows(); tileY++) {
            const solids = solidObjectsAtTile(tileX, tileY, { allowCloudSemi: true });
            for (const solid of solids) {
              const solidBox = solidBounds(solid, tileX, tileY);
              if (box.right <= solidBox.left + PLAYER_SOLID_EPSILON) continue;
              if (box.left >= solidBox.right - PLAYER_SOLID_EPSILON) continue;
              if (solidBox.top + PLAYER_SOLID_EPSILON < box.bottom) continue;
              if (!best || solidBox.top < best.top) best = { top: solidBox.top, obj: solid };
            }
            if (best) break;
          }
        }
        if (!best) return;
        player.pos.y =
          best.top - (playerHitbox.offsetY + playerHitbox.height) - PLAYER_SOLID_EPSILON;
        player.vel.y = 0;
        playerGrounded = true;
        playerGroundObject = best.obj;
        playerGroundObjectPos =
          best.obj && best.obj.exists() && best.obj.pos ? best.obj.pos.clone() : null;
        lastGroundedAt = time();
      }
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
    let forgeSparkTimer = 0;
    let startLocked = true;
    let pauseActive = false;
    let bossPowerDropTimer = rand(5.5, 8.5);
    const HUD_COLOR_NEUTRAL = rgb(255, 255, 255);
    const HUD_COLOR_CHARGED = rgb(52, 199, 89);
    const HUD_COLOR_WINGED = rgb(170, 235, 255);
    const HUD_COLOR_FORGED = rgb(255, 156, 94);
    let hudPowerMode = "normal";
    let auraMode = "none";

    function setHudText(obj, value) {
      if (obj.text !== value) obj.text = value;
    }

    function setHudPowerMode(mode) {
      if (hudPowerMode === mode) return;
      hudPowerMode = mode;
      if (mode === "charged") hudPower.color = HUD_COLOR_CHARGED;
      else if (mode === "winged") hudPower.color = HUD_COLOR_WINGED;
      else if (mode === "forged") hudPower.color = HUD_COLOR_FORGED;
      else hudPower.color = HUD_COLOR_NEUTRAL;
    }

    function setAuraMode(mode) {
      if (auraMode === mode) return;
      auraMode = mode;
      if (mode === "charged") {
        aura.color = HUD_COLOR_CHARGED;
        aura.outline = { width: 2, color: HUD_COLOR_CHARGED };
        return;
      }
      if (mode === "winged") {
        aura.color = HUD_COLOR_WINGED;
        aura.outline = { width: 2, color: HUD_COLOR_WINGED };
        return;
      }
      if (mode === "forged") {
        aura.color = HUD_COLOR_FORGED;
        aura.outline = { width: 2, color: HUD_COLOR_FORGED };
      }
    }

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

    placePlayerOnSpawnGround();

    // Start level music immediately on scene entry (before READY lock ends).
    ensureAudioReady();
    bgm.requestTrack(levelSpec.music ?? null);

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
        scale(1),
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
        const optionText = pauseOptionTexts[i];
        if (!optionText || !optionText.exists()) continue;
        const selected = i === pauseSelection;
        optionText.color = selected ? rgb(170, 235, 255) : rgb(215, 225, 245);
        optionText.opacity = selected ? 1 : 0.88;
        const targetScale = selected ? 1.05 : 1;
        if (optionText.scale) {
          optionText.scale.x = targetScale;
          optionText.scale.y = targetScale;
        } else {
          optionText.use(scale(targetScale));
        }
      }
    }

    function closePauseMenu({ resumeMusic = true } = {}) {
      if (!pauseActive) return;
      pauseActive = false;
      setGameplayObjectsPaused(false);
      updatePerfCullables();

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
    updatePerfCullables();

    function awardStomp(enemyPos) {
      const now = time();
      if (now - lastStompAt < 1.0) stompCombo = Math.min(stompCombo + 1, 4);
      else stompCombo = 0;
      lastStompAt = now;

      const base = 200;
      const points = base * 2 ** stompCombo;
      addScore(points, enemyPos);
    }

    function destroyEnemyStompZone(enemy) {
      if (!enemy) return;
      const zone = enemy.stompZone;
      if (!zone) return;
      if (typeof zone.exists !== "function" || zone.exists()) destroy(zone);
      enemy.stompZone = null;
    }

    function addEnemyStompZone(enemy) {
      if (!enemy || !enemy.exists()) return;
      destroyEnemyStompZone(enemy);
      enemy.stompZone = add([
        pos(enemy.pos.x, enemy.pos.y + ENEMY_STOMP_ZONE_OFFSET_Y),
        rect(tileSize, ENEMY_STOMP_ZONE_HEIGHT),
        anchor("topleft"),
        area(),
        opacity(0),
        "enemyStompZone",
        {
          owner: enemy,
          update() {
            if (!this.owner || !this.owner.exists() || this.owner.defeated) {
              destroy(this);
              return;
            }
            this.pos.x = this.owner.pos.x;
            this.pos.y = this.owner.pos.y + ENEMY_STOMP_ZONE_OFFSET_Y;
          },
        },
      ]);
    }

    function enemyStompBounds(enemy) {
      const zone = enemy?.stompZone;
      if (
        zone &&
        (typeof zone.exists !== "function" || zone.exists()) &&
        typeof zone.worldArea === "function"
      ) {
        const box = zone.worldArea().bbox();
        return {
          left: box.pos.x,
          top: box.pos.y,
          right: box.pos.x + box.width,
          bottom: box.pos.y + box.height,
        };
      }
      return {
        left: enemy.pos.x,
        top: enemy.pos.y + ENEMY_STOMP_ZONE_OFFSET_Y,
        right: enemy.pos.x + tileSize,
        bottom: enemy.pos.y + ENEMY_STOMP_ZONE_OFFSET_Y + ENEMY_STOMP_ZONE_HEIGHT,
      };
    }

    function isPlayerStompingEnemy(enemy, col = null) {
      if (!enemy || !enemy.exists()) return false;
      if (!player.isFalling()) return false;
      if (col && col.isBottom()) return true;

      const box = playerBoxAt();
      const stomp = enemyStompBounds(enemy);
      if (box.right <= stomp.left || box.left >= stomp.right) return false;
      return (
        box.bottom >= stomp.top - ENEMY_STOMP_ZONE_GRACE &&
        box.bottom <= stomp.bottom + ENEMY_STOMP_ZONE_GRACE
      );
    }

    function squashEnemy(enemy) {
      if (!enemy || !enemy.exists()) return;
      if (enemy.defeated) return;
      enemy.defeated = true;

      playSfx("stomp");
      shake(3);
      awardStomp(enemy.pos.add(tileSize / 2, tileSize / 2));
      destroyEnemyStompZone(enemy);

      // Keep area() intact during collision processing to avoid kaboom
      // iterating a partially-mutated collider in the same frame.
      enemy.unuse("enemy");
      enemy.unuse("danger");
      enemy.unuse("flyingEnemy");
      enemy.paused = true;
      enemy.use(scale(1, 0.25));
      wait(0.18, () => {
        if (enemy.exists()) destroy(enemy);
      });
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
      const frameDt = dt();
      const now = time();

      // HUD.
      setHudText(hudScore, `SCORE ${run.score}`);
      setHudText(hudCoins, `x${run.coins}`);
      setHudText(hudLives, `x${run.lives}`);
      setHudText(
        hudTime,
        `TIME ${Math.max(0, Math.floor(timeLeft)).toString().padStart(3, "0")}`,
      );
      let wingActive = run.power === "winged" && run.wingSecondsLeft > 0;
      let forgeActive = run.power === "forged" && run.forgeSecondsLeft > 0;
      if (run.power === "charged") {
        setHudText(hudPower, "POWER CHARGED");
        setHudPowerMode("charged");
      } else if (wingActive) {
        setHudText(
          hudPower,
          `POWER WING ${Math.max(0, Math.ceil(run.wingSecondsLeft))}s`,
        );
        setHudPowerMode("winged");
      } else if (forgeActive) {
        setHudText(
          hudPower,
          `POWER FORGE ${Math.max(0, Math.ceil(run.forgeSecondsLeft))}s`,
        );
        setHudPowerMode("forged");
      } else {
        setHudText(hudPower, "POWER —");
        setHudPowerMode("normal");
      }
      if (pauseActive) setHudText(hudAudio, "PAUSED");
      else
        setHudText(
          hudAudio,
          settings.audio ? "ESC/P: PAUSE • M: MUTE" : "ESC/P: PAUSE • M: UNMUTE",
        );

      aura.pos.x = player.pos.x + tileSize * 0.5;
      aura.pos.y = player.pos.y + tileSize * 0.5;
      if (run.power === "charged") {
        setAuraMode("charged");
        const pulse = Math.sin(now * 6);
        aura.opacity = 0.2 + pulse * 0.035;
        const auraScale = 1 + pulse * 0.05;
        aura.scale.x = auraScale;
        aura.scale.y = auraScale;
      } else if (wingActive) {
        setAuraMode("winged");
        const pulse = Math.sin(now * 8);
        aura.opacity = 0.22 + pulse * 0.04;
        const auraScale = 1 + pulse * 0.06;
        aura.scale.x = auraScale;
        aura.scale.y = auraScale;
      } else if (forgeActive) {
        setAuraMode("forged");
        const pulse = Math.sin(now * 9.5);
        aura.opacity = 0.24 + pulse * 0.045;
        const auraScale = 1 + pulse * 0.052;
        aura.scale.x = auraScale;
        aura.scale.y = auraScale;
      } else {
        aura.opacity = 0;
        aura.scale.x = 1;
        aura.scale.y = 1;
      }

      if (forgeActive) {
        forgeSparkTimer -= frameDt;
        if (forgeSparkTimer <= 0) {
          forgeSparkTimer = 0.07 + rand(0, 0.05);
          const sparkStart = player.pos.add(tileSize * 0.5 + rand(-9, 9), tileSize * 0.45);
          add([
            circle(rand(1.1, 2.3)),
            pos(sparkStart),
            color(255, rand(140, 196), rand(84, 118)),
            opacity(rand(0.55, 0.9)),
            lifespan(0.28, { fade: 0.2 }),
            move(vec2(rand(-0.35, 0.35), -1), rand(42, 86)),
            z(1995),
          ]);
        }
      } else {
        forgeSparkTimer = 0;
      }

      if (isInvincible())
        player.opacity = Math.floor(now * 18) % 2 === 0 ? 0.25 : 1;
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

      if (player.isGrounded()) lastGroundedAt = now;

      if (startLocked) return;

      if (run.power === "winged") {
        run.wingSecondsLeft = Math.max(0, run.wingSecondsLeft - frameDt);
        if (run.wingSecondsLeft <= 0) {
          run.power = "normal";
          run.forgeSecondsLeft = 0;
          playSfx("powerdown");
          addFloatingText(
            "WINGS OUT",
            player.pos.add(tileSize / 2, -10),
            rgb(200, 220, 255),
          );
        }
      } else if (run.power === "forged") {
        run.forgeSecondsLeft = Math.max(0, run.forgeSecondsLeft - frameDt);
        if (run.forgeSecondsLeft <= 0) {
          run.power = "normal";
          run.forgeSecondsLeft = 0;
          playSfx("forge-expire");
          addFloatingText(
            "CORE OUT",
            player.pos.add(tileSize / 2, -10),
            rgb(255, 156, 94),
          );
        }
      }

      wingActive = run.power === "winged" && run.wingSecondsLeft > 0;
      forgeActive = run.power === "forged" && run.forgeSecondsLeft > 0;
      const leftDown = anyInputDown(INPUT.left);
      const rightDown = anyInputDown(INPUT.right);
      const runDown = anyInputDown(INPUT.run);
      const jumpDown = anyInputDown(INPUT.jump);
      const touchingVine = now < vineTouchUntil;
      const climbUp = anyInputDown(INPUT.up);
      const climbDown = anyInputDown(INPUT.down);
      const vineReattachLocked = now < vineDetachUntil;
      if (!touchingVine || vineReattachLocked) climbingVine = false;
      if (!vineReattachLocked && touchingVine && (climbUp || climbDown || climbingVine)) {
        climbingVine = true;
      }

      if (isBossLevel) {
        bossPowerDropTimer -= frameDt;
        if (bossPowerDropTimer <= 0 && get("powerup").length < 2) {
          const centerX = bossFight.boss?.homeX ?? player.pos.x;
          spawnFallingPowerup("battery", centerX + rand(-220, 220));
          bossPowerDropTimer = rand(6.5, 10.5);
        }
      }

      // Timer.
      timeLeft -= frameDt;
      if (timeLeft <= 0) {
        loseLife("time");
        return;
      }

      // Movement.
      const moveDir = (leftDown ? -1 : 0) + (rightDown ? 1 : 0);
      const isRunning = runDown;
      const maxSpeed = isRunning ? CONFIG.runSpeed : CONFIG.walkSpeed;
      const grounded = player.isGrounded();
      const accel = grounded
        ? CONFIG.accelGround
        : CONFIG.accelAir * airControlMultiplier;
      const decel = grounded
        ? CONFIG.decelGround
        : CONFIG.decelAir * airBrakeMultiplier;

      if (moveDir !== 0) {
        facing = moveDir;
        velX = approach(velX, moveDir * maxSpeed, accel * frameDt);
      } else {
        velX = approach(velX, 0, decel * frameDt);
      }

      // Let players walk off vines naturally instead of getting stuck.
      if (climbingVine && moveDir !== 0) climbingVine = false;

      if (climbingVine) {
        velX = approach(velX, 0, (decel + 420) * frameDt);
        player.gravityScale = 0;
        const climbDir = (climbUp ? -1 : 0) + (climbDown ? 1 : 0);
        player.vel.y = approach(
          player.vel.y,
          climbDir * CONFIG.vineClimbSpeed,
          CONFIG.wingLiftAccel * frameDt,
        );
      } else if (wingActive) {
        player.gravityScale = CONFIG.wingGravityScale;
        if (jumpDown && !climbDown) {
          player.vel.y = approach(
            player.vel.y,
            -CONFIG.wingRiseSpeed,
            CONFIG.wingLiftAccel * frameDt,
          );
        } else {
          const wingFallTarget = climbDown
            ? CONFIG.wingDiveFallSpeed
            : CONFIG.wingGlideFallSpeed;
          const wingFallAccel = CONFIG.wingLiftAccel * (climbDown ? 1.1 : 0.65);
          player.vel.y = approach(
            player.vel.y,
            wingFallTarget,
            wingFallAccel * frameDt,
          );
        }
      } else {
        player.gravityScale = 1;
      }

      const carryDelta = getGroundCarryDelta();
      player.vel.y += sceneGravity * player.gravityScale * frameDt;
      if (player.vel.y > PLAYER_MAX_FALL_SPEED) {
        player.vel.y = PLAYER_MAX_FALL_SPEED;
      }

      player.flipX = facing < 0;
      movePlayerKinematic(
        velX * frameDt + carryDelta.x,
        player.vel.y * frameDt + carryDelta.y,
      );

      // Manual stomp pass keeps full-width top hits reliable even when overlap events miss.
      if (player.isFalling()) {
        for (const enemy of get("enemy")) {
          if (!enemy || !enemy.exists() || enemy.defeated) continue;
          const zone = enemy.stompZone;
          if (!zone || (typeof zone.exists === "function" && !zone.exists())) continue;
          if (!isPlayerStompingEnemy(enemy)) continue;
          squashEnemy(enemy);
          player.jump(CONFIG.bounceForce);
          break;
        }
      }

      if (wingActive && player.pos.y < flightCeilingY) {
        player.pos.y = flightCeilingY;
        if (player.vel.y < 0) player.vel.y = 0;
      }

      const camLeftEdge = updateCamera();
      updatePerfCullables();
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

      dustTimer += frameDt;
      if (player.isGrounded() && Math.abs(velX) > 120 && dustTimer > 0.14) {
        dustTimer = 0;
        spawnDust(player.pos.add(tileSize / 2, tileSize));
      }

      // Jump buffer + coyote time.
      const buffered = now - jumpQueuedAt <= CONFIG.jumpBuffer;
      const canCoyote = now - lastGroundedAt <= CONFIG.coyoteTime;
      const jumpedFromVine = climbingVine;
      if (buffered && (jumpedFromVine || player.isGrounded() || canCoyote)) {
        jumpQueuedAt = -Infinity;
        climbingVine = false;
        if (jumpedFromVine) {
          vineDetachUntil = now + CONFIG.vineJumpDetachSeconds;
          const vineJumpDir = moveDir !== 0 ? moveDir : facing;
          velX = vineJumpDir * Math.max(Math.abs(velX), CONFIG.walkSpeed * 0.55);
        }
        player.gravityScale = wingActive ? CONFIG.wingGravityScale : 1;
        player.jump(jumpedFromVine ? CONFIG.jumpForce * 0.88 : CONFIG.jumpForce);
        playSfx("jump");
        spawnJetpackPuff();
      }

      // Death by falling.
      if (player.pos.y > worldDeathY) loseLife("pit");
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
      if (kind === "wing" || kind === "forge") {
        addFloatingText(spec.text, player.pos.add(tileSize / 2, -12), spec.textColor);
      }
    });

    player.onCollideUpdate("vine", () => {
      vineTouchUntil = time() + 0.08;
    });

    player.onCollide("fragileCloud", (fragile, col) => {
      if (ending || !fragile || !fragile.exists()) return;
      if (!col) return;
      if (!col.isBottom()) return;
      if (typeof fragile.triggerCollapse === "function") fragile.triggerCollapse();
    });

    // Question blocks + bricks (headbutt).
    player.onHeadbutt((obj) => {
      handlePlayerHeadbutt(obj);
    });

    const solidQueryTile = vec2(0, 0);
    function hasSolidTileAt(tileX, tileY) {
      if (tileX < 0 || tileY < 0) return false;
      if (tileX >= level.numColumns() || tileY >= level.numRows()) return false;
      solidQueryTile.x = tileX;
      solidQueryTile.y = tileY;
      return level
        .getAt(solidQueryTile)
        .some(
          (obj) =>
            !!obj &&
            (typeof obj.exists !== "function" || obj.exists()) &&
            typeof obj.is === "function" &&
            obj.is("solid") &&
            obj.solidEnabled !== false,
        );
    }

    // Enemy patrol + cliff-safe walking.
    for (const enemy of get("enemy")) {
      if (enemy.is("flyingEnemy") || enemy.is("floaterEnemy")) {
        continue;
      }
      addEnemyStompZone(enemy);
      enemy.edgeCheckCooldown = 0;

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
        enemy.edgeCheckCooldown -= dt();
        if (enemy.isGrounded() && enemy.edgeCheckCooldown <= 0) {
          enemy.edgeCheckCooldown = 0.06;
          const aheadX =
            enemy.dir > 0 ? enemy.pos.x + tileSize + 1 : enemy.pos.x - 1;
          const feetY = enemy.pos.y + tileSize + 1;
          const aheadTileX = Math.floor(aheadX / tileSize);
          const aheadTileY = Math.floor(feetY / tileSize);
          const groundAhead = hasSolidTileAt(aheadTileX, aheadTileY);
          if (!groundAhead) {
            enemy.dir *= -1;
            enemy.vel.x = enemy.dir * enemy.speed;
          }
        }

        enemy.flipX = enemy.dir > 0;
        if (enemy.pos.y > worldDeathY) {
          destroyEnemyStompZone(enemy);
          destroy(enemy);
        }
      });
    }

    // Player vs enemies.
    player.onCollide("enemyStompZone", (zone, col) => {
      if (ending) return;
      const enemy = zone?.owner;
      if (!enemy || !enemy.exists() || enemy.defeated) return;

      if (isPlayerStompingEnemy(enemy, col)) {
        squashEnemy(enemy);
        player.jump(CONFIG.bounceForce);
      }
    });

    player.onCollide("enemy", (enemy, col) => {
      if (ending) return;
      if (!enemy || !enemy.exists() || enemy.defeated) return;

      if (isPlayerStompingEnemy(enemy, col)) {
        squashEnemy(enemy);
        player.jump(CONFIG.bounceForce);
        return;
      }

      takeHit("enemy");
    });

    player.onCollide("hazard", () => {
      if (ending) return;
      if (run.power === "forged" && run.forgeSecondsLeft > 0) return;
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
          scale: vec2(0.78, 0.62),
          offset: vec2(7.0, 10.8),
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
      pole = add([sprite("pole"), pos(poleTopPos), area(), perfCull(), "goalPole"]);
      flag = add([
        sprite("flag-robot"),
        pos(poleTopPos.add(18, 26)),
        area(),
        perfCull(),
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
        perfCull(),
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
}
