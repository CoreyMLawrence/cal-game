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
    const levelSandstormDurationSeconds =
      typeof levelSpec.sandstormDurationSeconds === "number"
        ? levelSpec.sandstormDurationSeconds
        : CONFIG.sandstormDurationSeconds;
    const levelHorizontalPlatformRange = isCloudLevel
      ? 68
      : isDesertLevel
        ? 28
        : 56;
    const levelHorizontalPlatformSpeed = isCloudLevel
      ? 1.12
      : isDesertLevel
        ? 0.84
        : 1.05;
    const levelVerticalPlatformRange = isCloudLevel
      ? 66
      : isDesertLevel
        ? 24
        : 52;
    const levelVerticalPlatformSpeed = isCloudLevel
      ? 1.0
      : isDesertLevel
        ? 0.78
        : 1.0;
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
          run.sandstormSecondsLeft = 0;
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
          run.sandstormSecondsLeft = 0;
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
          run.sandstormSecondsLeft = 0;
          run.forgeSecondsLeft = levelForgeDurationSeconds;
          setPower("forged", player.pos.add(tileSize / 2, 0));
          setInvincible(CONFIG.powerInvincibleSeconds);
        },
      }),
      sandstorm: Object.freeze({
        sprite: "sand-core",
        power: "sandstorm",
        text: `SANDSTORM +${Math.max(1, Math.floor(levelSandstormDurationSeconds))}s`,
        textColor: rgb(243, 208, 114),
        apply() {
          run.wingSecondsLeft = 0;
          run.forgeSecondsLeft = 0;
          run.sandstormSecondsLeft = levelSandstormDurationSeconds;
          setPower("sandstorm", player.pos.add(tileSize / 2, 0));
          setInvincible(CONFIG.powerInvincibleSeconds);
        },
      }),
    });

    function powerupSpec(kind) {
      return POWERUP_SPECS[kind] ?? POWERUP_SPECS.battery;
    }

    function questionBlockTile(reward) {
      const spriteName =
        reward === "forge"
          ? "question-forge"
          : reward === "sandstorm"
            ? "question-sand"
            : "question";
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

    function desertObeliskTile() {
      return [
        sprite("desert-obelisk"),
        perfCull(),
        z(-2),
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

    const ENEMY_STOMP_ZONE_OFFSET_Y = 2;
    const ENEMY_STOMP_ZONE_HEIGHT = 16;
    const ENEMY_STOMP_ZONE_GRACE = 12;
    const activeEnemies = [];

    function enemyDamageArea() {
      return area({
        scale: vec2(0.72, 0.72),
        offset: vec2(4.5, 8.3),
      });
    }

    function destroyEnemyStackFollowers(enemy) {
      if (!enemy || !Array.isArray(enemy.stackFollowers)) return;
      for (const follower of enemy.stackFollowers) {
        if (!follower || (typeof follower.exists === "function" && !follower.exists())) {
          continue;
        }
        destroy(follower);
      }
      enemy.stackFollowers = [];
    }

    function enemyTile(spriteName, opts = {}, tilePos = null) {
      const phase =
        opts.flightPhase ??
        (tilePos ? tilePos.x * 0.31 + tilePos.y * 0.47 : rand(0, Math.PI * 2));
      const helmetComponents = opts.astro ? [astroHelmetComponent()] : [];
      const astroTags = opts.astro ? ["astroEnemy"] : [];
      const stackHeight = Math.max(1, Math.floor(opts.stackHeight ?? 1));
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
            add() {
              activeEnemies.push(this);
            },
            destroy() {
              const idx = activeEnemies.indexOf(this);
              if (idx !== -1) activeEnemies.splice(idx, 1);
            },
            update() {
              if (!this.home) this.home = { x: this.pos.x, y: this.pos.y };
              const t = time() * this.flightSpeed + this.flightPhase;
              const nextX = this.home.x + Math.sin(t) * this.flightRangeX;
              const nextY =
                this.home.y + Math.sin(t * this.flightSwoopFactor) * this.flightRangeY;
              this.flipX = nextX > this.pos.x;
              this.pos.x = nextX;
              this.pos.y = nextY;
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
            add() {
              activeEnemies.push(this);
            },
            destroy() {
              const idx = activeEnemies.indexOf(this);
              if (idx !== -1) activeEnemies.splice(idx, 1);
            },
            update() {
              if (!this.home) this.home = { x: this.pos.x, y: this.pos.y };
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
          stackHeight,
          stackFollowers: [],
          topSprites: Array.isArray(opts.topSprites) ? opts.topSprites : [],
          add() {
            activeEnemies.push(this);
            if (this.stackHeight <= 1) return;
            destroyEnemyStackFollowers(this);
            for (let i = 1; i < this.stackHeight; i++) {
              const topSprite = this.topSprites[i - 1] ?? spriteName;
              const follower = add([
                sprite(topSprite),
                pos(this.pos.x, this.pos.y - i * tileSize),
                enemyDamageArea(),
                perfCull({ margin: tileSize * 10 }),
                "enemyHitbox",
                "danger",
                z(5 + i),
                {
                  leader: this,
                  stackOwner: this,
                  yOffset: i * tileSize,
                  update() {
                    const leader = this.leader;
                    if (!leader || !leader.exists() || leader.defeated) {
                      destroy(this);
                      return;
                    }
                    this.pos.x = leader.pos.x;
                    this.pos.y = leader.pos.y - this.yOffset;
                    this.flipX = leader.flipX;
                    this.hidden = !!leader.hidden;
                    this.opacity = leader.opacity;
                  },
                },
              ]);
              this.stackFollowers.push(follower);
            }
          },
          destroy() {
            const idx = activeEnemies.indexOf(this);
            if (idx !== -1) activeEnemies.splice(idx, 1);
            destroyEnemyStackFollowers(this);
          },
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
            range: levelHorizontalPlatformRange,
            speed: levelHorizontalPlatformSpeed,
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
            range: levelVerticalPlatformRange,
            speed: levelVerticalPlatformSpeed,
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
        Z: () => questionBlockTile("sandstorm"),
        S: () => questionBlockTile("supercoin"),
        O: () => superCoinTile(),
        I: () => desertObeliskTile(),
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
        t: () =>
          enemyTile("robot-blue", {
            speed: CONFIG.enemySpeed - 4,
            smart: true,
            stackHeight: 3,
            topSprites: ["robot-red", "robot-pink"],
          }),
      },
    });

    worldDeathY = level.levelHeight() + CONFIG.fallDeathPadding;

    const halfW = width() / 2;
    const _dVec = vec2(0, 0);
    const _tri1 = [vec2(0, 0), vec2(0, 0), vec2(0, 0)];

    function dCircle(x, y, r, col, alpha = 1) {
      _dVec.x = x;
      _dVec.y = y;
      drawCircle({ pos: _dVec, radius: r, color: col, opacity: alpha });
    }

    function dRect(x, y, w, h, col, alpha = 1, rad = 0) {
      _dVec.x = x;
      _dVec.y = y;
      drawRect({ pos: _dVec, width: w, height: h, color: col, opacity: alpha, radius: rad });
    }

    function dTri(p1x, p1y, p2x, p2y, p3x, p3y, col, alpha = 1) {
      _tri1[0].x = p1x;
      _tri1[0].y = p1y;
      _tri1[1].x = p2x;
      _tri1[1].y = p2y;
      _tri1[2].x = p3x;
      _tri1[2].y = p3y;
      drawPolygon({ pts: _tri1, color: col, opacity: alpha });
    }

    function drawGrassyBackdropDirect(camX, left, right, levelW) {
      // Sky base
      dRect(left - 20, -10, width() + 40, height() + 20, rgb(126, 207, 247));

      // Cheerful retro sun with atmospheric halo (p = 0.04 - stays high in sky with very slow drift)
      const sunScreenX = 220 + (camX / (levelW || 1)) * 40;
      const sunWorldX = left + sunScreenX;
      dCircle(sunWorldX, 80, 64, rgb(255, 238, 140), 0.35);
      dCircle(sunWorldX, 80, 42, rgb(255, 225, 90), 0.92);

      // Distant rolling mountain ranges (p = 0.20)
      const pMtn = 0.20;
      const mtnCamX = camX * pMtn;
      const mountainStep = 240;
      const mStart = Math.floor((mtnCamX - halfW - 280) / mountainStep) * mountainStep;
      const mEnd = mtnCamX + halfW + 280;
      const mBaseY = height() - 70;
      for (let lx = mStart; lx <= mEnd; lx += mountainStep) {
        const worldX = camX + (lx - mtnCamX);
        const mH = 150 + (Math.abs(lx * 13) % 45);
        const mW = 280;
        dTri(worldX, mBaseY, worldX + mW * 0.5, mBaseY - mH, worldX + mW, mBaseY, rgb(82, 148, 168), 0.55);
        dTri(worldX + mW * 0.5, mBaseY - mH, worldX + mW * 0.5, mBaseY, worldX + mW, mBaseY, rgb(68, 126, 144), 0.55);
      }

      // Clouds (p = 0.32 + gentle breeze drift)
      const pCloud = 0.32;
      const cloudCamX = camX * pCloud - time() * 8;
      const cloudStep = 260;
      const cStart = Math.floor((cloudCamX - halfW - 200) / cloudStep) * cloudStep;
      const cEnd = cloudCamX + halfW + 200;
      const white = rgb(255, 255, 255);
      for (let lx = cStart; lx <= cEnd; lx += cloudStep) {
        const worldX = camX + (lx - cloudCamX);
        const cloudY = 45 + (Math.abs(lx * 11) % 75);
        const cw = 70 + (Math.abs(lx * 5) % 40);
        dRect(worldX, cloudY + 12, cw * 1.4, 22, white, 0.82, 10);
        dCircle(worldX + 22, cloudY + 12, 20, white, 0.88);
        dCircle(worldX + 48, cloudY + 6, 28, white, 0.92);
        dCircle(worldX + 78, cloudY + 14, 18, white, 0.85);
      }

      // Midground rolling green hills (p = 0.45)
      const pHill = 0.45;
      const hillCamX = camX * pHill;
      const hillStep = 180;
      const hStart = Math.floor((hillCamX - halfW - 200) / hillStep) * hillStep;
      const hEnd = hillCamX + halfW + 200;
      const hillY = height() - 25;
      for (let lx = hStart; lx <= hEnd; lx += hillStep) {
        const worldX = camX + (lx - hillCamX);
        const hillRadius = 140 + (Math.abs(lx * 7) % 50);
        dCircle(worldX + hillRadius * 0.8, hillY + hillRadius * 0.45, hillRadius, rgb(78, 166, 88), 0.85);
        dCircle(worldX + hillRadius * 1.3, hillY + hillRadius * 0.5, hillRadius * 0.75, rgb(92, 184, 98), 0.80);
      }

      // Foreground bush clusters along ground level (p = 0.85)
      const pBush = 0.85;
      const bushCamX = camX * pBush;
      const bushStep = 150;
      const bStart = Math.floor((bushCamX - halfW - 100) / bushStep) * bushStep;
      const bEnd = bushCamX + halfW + 100;
      const groundFloorY = height() - 32;
      const bDark = rgb(56, 142, 60);
      const bLight = rgb(68, 160, 72);
      const bFlower = rgb(255, 220, 100);
      for (let lx = bStart; lx <= bEnd; lx += bushStep) {
        if ((Math.abs(lx) % 300) > 200) continue;
        const worldX = camX + (lx - bushCamX);
        dCircle(worldX + 10, groundFloorY, 14, bDark, 0.9);
        dCircle(worldX + 24, groundFloorY - 4, 18, bLight, 0.92);
        dCircle(worldX + 40, groundFloorY + 1, 13, bDark, 0.9);
        dCircle(worldX + 23, groundFloorY - 8, 2.5, bFlower, 0.95);
      }
    }

    function drawDesertBackdropDirect(camX, left, right, levelW) {
      const sceneryDrop = tileSize;
      dRect(
        left - 20,
        -10,
        width() + 40,
        height() + 20,
        rgb(levelTheme.skyBottom.r, levelTheme.skyBottom.g, levelTheme.skyBottom.b),
      );

      // Desert sun with heat haze (p = 0.04)
      const sunScreenX = 220 + Math.sin(time() * 1.5) * 3;
      const sunWorldX = left + sunScreenX;
      dCircle(sunWorldX, 92, 56, rgb(levelTheme.sun.r, levelTheme.sun.g, levelTheme.sun.b), 0.94);

      // Distant Pyramids (p = 0.18)
      const pPyr = 0.18;
      const pyrCamX = camX * pPyr;
      const pyramidBaseY = 330 + sceneryDrop;
      const pyramidStep = 480;
      const pStart = Math.floor((pyrCamX - halfW - 400) / pyramidStep) * pyramidStep;
      const pEnd = pyrCamX + halfW + 400;
      const pyrCol1L = rgb(210, 160, 88);
      const pyrCol1R = rgb(186, 136, 68);
      const pyrCol2L = rgb(218, 170, 98);
      const pyrCol2R = rgb(194, 144, 76);
      const pyrRidge = rgb(130, 92, 44);

      function drawDirectPyramid(px, py, pw, ph, cL, cR, alpha) {
        const half = pw / 2;
        const x0 = px - half;
        dTri(x0, py, x0 + half, py - ph, x0 + half, py, cL, alpha);
        dTri(x0, py, x0 + half, py - ph, x0 + pw, py, cR, alpha);
        dRect(px - 1, py - ph, 2, ph, pyrRidge, alpha * 0.6);
      }

      for (let lx = pStart; lx <= pEnd; lx += pyramidStep) {
        const worldX = camX + (lx - pyrCamX);
        drawDirectPyramid(worldX + 86, pyramidBaseY + 150, 172, 150, pyrCol1L, pyrCol1R, 0.54);
        drawDirectPyramid(worldX + 292, pyramidBaseY + 154, 144, 130, pyrCol2L, pyrCol2R, 0.5);
      }

      // Distant Dunes (p = 0.32)
      const duneY = 420 + sceneryDrop;
      const dDark = rgb(levelTheme.duneDark.r, levelTheme.duneDark.g, levelTheme.duneDark.b);
      const dLight = rgb(levelTheme.duneLight.r, levelTheme.duneLight.g, levelTheme.duneLight.b);
      const pDuneDist = 0.32;
      const duneCamX1 = camX * pDuneDist;
      const dStep1 = 360;
      const dStart1 = Math.floor((duneCamX1 - halfW - 220) / dStep1) * dStep1;
      const dEnd1 = duneCamX1 + halfW + 220;
      for (let lx = dStart1; lx <= dEnd1; lx += dStep1) {
        const worldX = camX + (lx - duneCamX1);
        dCircle(worldX, duneY, 185, dDark, 0.92);
      }

      // Near Dunes (p = 0.55)
      const pDuneNear = 0.55;
      const duneCamX2 = camX * pDuneNear;
      const dStep2 = 420;
      const dStart2 = Math.floor((duneCamX2 - halfW - 250) / dStep2) * dStep2;
      const dEnd2 = duneCamX2 + halfW + 250;
      for (let lx = dStart2; lx <= dEnd2; lx += dStep2) {
        const worldX = camX + (lx - duneCamX2);
        dCircle(worldX + 160, duneY + 14, 215, dLight, 0.90);
      }
    }

    function drawCloudBackdropDirect(camX, left, right, levelW) {
      dRect(
        left - 20,
        -10,
        width() + 40,
        height() + 20,
        rgb(levelTheme.skyTop.r, levelTheme.skyTop.g, levelTheme.skyTop.b),
      );
      dRect(left - 20, height() - 140, width() + 40, 140, rgb(255, 218, 172), 0.42);

      // Cloud horizon golden sun (p = 0.04)
      const sunScreenX = 320 + (camX / (levelW || 1)) * 30;
      const sunWorldX = left + sunScreenX;
      dCircle(sunWorldX, height() - 130, 68, rgb(255, 235, 175), 0.55);

      // Distant floating island silhouettes (p = 0.20)
      const pIsland = 0.20;
      const islandCamX = camX * pIsland;
      const islandStep = 380;
      const iStart = Math.floor((islandCamX - halfW - 200) / islandStep) * islandStep;
      const iEnd = islandCamX + halfW + 200;
      const islandCol = rgb(164, 150, 186);
      const grassCol = rgb(128, 196, 140);
      for (let lx = iStart; lx <= iEnd; lx += islandStep) {
        const worldX = camX + (lx - islandCamX);
        const iy = 160 + (Math.abs(lx * 7) % 90);
        dTri(worldX, iy, worldX + 45, iy + 36, worldX + 90, iy, islandCol, 0.65);
        dRect(worldX - 3, iy - 6, 96, 12, grassCol, 0.72, 6);
      }

      // Massive fluffy cloud bank deck at bottom of screen (p = 0.38)
      const pDeck = 0.38;
      const deckCamX = camX * pDeck;
      const deckStep = 110;
      const dStart = Math.floor((deckCamX - halfW - 150) / deckStep) * deckStep;
      const dEnd = deckCamX + halfW + 150;
      const cloudWhite = rgb(255, 255, 255);
      const cloudPink = rgb(248, 238, 244);
      const deckY = height() - 20;
      for (let lx = dStart; lx <= dEnd; lx += deckStep) {
        const worldX = camX + (lx - deckCamX);
        const r = 68 + (Math.abs(lx * 13) % 40);
        dCircle(worldX + r * 0.8, deckY, r, cloudWhite, 0.88);
        dCircle(worldX + r * 1.2, deckY + 15, r * 0.8, cloudPink, 0.92);
      }

      // Floating puffy cloud clusters across upper sky (p = 0.48 + drift)
      const pSky = 0.48;
      const skyCamX = camX * pSky - time() * 12;
      const skyStep = 220;
      const sStart = Math.floor((skyCamX - halfW - 200) / skyStep) * skyStep;
      const sEnd = skyCamX + halfW + 200;
      for (let lx = sStart; lx <= sEnd; lx += skyStep) {
        const worldX = camX + (lx - skyCamX);
        const cy = 40 + (Math.abs(lx * 17) % 80);
        const cw = 75 + (Math.abs(lx * 3) % 35);
        dRect(worldX, cy + 10, cw * 1.3, 20, cloudWhite, 0.78, 10);
        dCircle(worldX + 20, cy + 8, 22, cloudWhite, 0.85);
        dCircle(worldX + 48, cy + 2, 30, cloudWhite, 0.90);
        dCircle(worldX + 76, cy + 10, 18, cloudWhite, 0.82);
      }
    }

    const spaceStars = [];
    const spaceBodies = [];
    if (isSpaceLevel) {
      for (let i = 0; i < 160; i++) {
        spaceStars.push({
          baseX: rand(-200, level.levelWidth() * 0.3 + width()),
          y: rand(0, height() - 44),
          r: rand(0.65, 2.05),
          alpha: rand(0.28, 0.96),
          phase: rand(0, Math.PI * 2),
          speed: rand(1.1, 3.6),
          parallax: rand() < 0.6 ? 0.08 : 0.22,
        });
      }
      const bodyPalettes = [
        { body: rgb(110, 146, 204), glow: rgb(148, 182, 236) },
        { body: rgb(172, 126, 94), glow: rgb(220, 166, 124) },
        { body: rgb(92, 152, 160), glow: rgb(134, 196, 206) },
      ];
      let bodyX = width() + 120;
      while (bodyX < level.levelWidth() + 260) {
        const pIdx = Math.floor(rand(0, bodyPalettes.length));
        const pal = bodyPalettes[pIdx];
        const bRadius = rand(8, 18);
        const bY = rand(48, 170);
        const bAlpha = rand(0.24, 0.46);
        const hasMoon = rand(0, 1) > 0.62;
        spaceBodies.push({
          baseX: bodyX,
          y: bY,
          r: bRadius,
          glowPad: rand(2, 5),
          bodyCol: pal.body,
          glowCol: pal.glow,
          alpha: bAlpha,
          hasMoon,
          mr: Math.max(2.2, bRadius * 0.22),
          mx: rand(-bRadius * 2.4, bRadius * 2.4),
          my: rand(-bRadius * 1.4, bRadius * 1.4),
        });
        bodyX += rand(420, 620);
      }
    }

    function drawSpaceBackdropDirect(camX, left, right) {
      dRect(left - 20, -10, width() + 40, height() + 20, rgb(2, 6, 20));

      const curTime = time();
      const whiteStar = rgb(255, 255, 255);
      for (let i = 0; i < spaceStars.length; i++) {
        const s = spaceStars[i];
        const worldX = camX + (s.baseX - camX * s.parallax);
        if (worldX < left - 10 || worldX > right + 10) continue;
        const alpha = s.alpha * (0.58 + Math.sin(curTime * s.speed + s.phase) * 0.42);
        dCircle(worldX, s.y, s.r, whiteStar, alpha);
      }

      const pBody = 0.16;
      for (let i = 0; i < spaceBodies.length; i++) {
        const b = spaceBodies[i];
        const worldX = camX + (b.baseX - camX * pBody);
        if (worldX < left - 50 || worldX > right + 50) continue;
        dCircle(worldX, b.y, b.r + b.glowPad, b.glowCol, b.alpha * 0.32);
        dCircle(worldX, b.y, b.r, b.bodyCol, b.alpha);
        if (b.hasMoon) {
          dCircle(worldX + b.mx, b.y + b.my, b.mr, rgb(188, 202, 222), b.alpha * 0.74);
        }
      }
    }

    const castleEmbers = [];
    if (isCastleLevel && !isBossLevel) {
      for (let i = 0; i < 26; i++) {
        castleEmbers.push({
          baseX: rand(0, level.levelWidth() * 0.6 + width()),
          y: height() - rand(20, 58),
          r: rand(14, 34),
          alpha: rand(0.1, 0.22),
        });
      }
    }

    function drawCastleBackdropDirect(camX, left, right, levelW, includeEmbers) {
      dRect(left - 20, -10, width() + 40, height() + 20, rgb(22, 24, 34));
      dRect(left - 20, height() - 160, width() + 40, 160, rgb(68, 26, 20), 0.38);

      // Blood moon (p = 0.04)
      const moonScreenX = 170 + (camX / (levelW || 1)) * 30;
      const moonWorldX = left + moonScreenX;
      dCircle(moonWorldX, 88, 44, rgb(255, 208, 150), 0.18);

      // Castle towers (p = 0.24)
      const pTower = 0.24;
      const towerCamX = camX * pTower;
      const towerStep = 186;
      const tStart = Math.floor((towerCamX - halfW - 150) / towerStep) * towerStep;
      const tEnd = towerCamX + halfW + 150;
      const wallCol = rgb(54, 59, 72);
      const roofCol = rgb(46, 50, 62);
      for (let lx = tStart; lx <= tEnd; lx += towerStep) {
        const worldX = camX + (lx - towerCamX);
        const towerH = 120 + (Math.abs(lx * 19) % 80);
        dRect(worldX, 378 - towerH, 68, towerH, wallCol, 0.72);
        dTri(worldX, 378 - towerH, worldX + 34, 378 - towerH - 46, worldX + 68, 378 - towerH, roofCol, 0.72);
      }

      if (includeEmbers) {
        const emberCol = rgb(170, 64, 36);
        const curT = time();
        const pEmber = 0.55;
        for (let i = 0; i < castleEmbers.length; i++) {
          const e = castleEmbers[i];
          const worldX = camX + (e.baseX - camX * pEmber);
          if (worldX < left - 40 || worldX > right + 40) continue;
          const floatY = e.y - ((curT * 20 + i * 15) % 80);
          dCircle(worldX, floatY, e.r, emberCol, e.alpha);
        }
      }
    }

    add([
      z(-210),
      {
        draw() {
          const camX = camPos().x;
          const left = camX - halfW;
          const right = camX + halfW;
          const levelW = level.levelWidth();
          if (isCastleLevel) drawCastleBackdropDirect(camX, left, right, levelW, !isBossLevel);
          else if (isDesertLevel) drawDesertBackdropDirect(camX, left, right, levelW);
          else if (isCloudLevel) drawCloudBackdropDirect(camX, left, right, levelW);
          else if (isSpaceLevel) drawSpaceBackdropDirect(camX, left, right);
          else drawGrassyBackdropDirect(camX, left, right, levelW);
        },
      },
    ]);

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

    const PARTICLE_POOL_SIZE = 48;
    const particlePool = [];
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      particlePool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 2,
        color: rgb(255, 255, 255),
        alpha: 1,
        maxLife: 0.35,
        life: 0,
      });
    }

    function spawnPooledParticle(x, y, vx, vy, r, col, life, alpha = 1) {
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) {
          p.active = true;
          p.x = x;
          p.y = y;
          p.vx = vx;
          p.vy = vy;
          p.r = r;
          p.color = col;
          p.alpha = alpha;
          p.maxLife = life;
          p.life = life;
          return p;
        }
      }
      return null;
    }

    const _poolDrawPos = vec2(0, 0);
    add([
      z(1995),
      {
        update() {
          const dtVal = dt();
          for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
            const p = particlePool[i];
            if (!p.active) continue;
            p.life -= dtVal;
            if (p.life <= 0) {
              p.active = false;
              continue;
            }
            p.x += p.vx * dtVal;
            p.y += p.vy * dtVal;
          }
        },
        draw() {
          const camX = camPos().x;
          const left = camX - halfW - 24;
          const right = camX + halfW + 24;
          for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
            const p = particlePool[i];
            if (!p.active) continue;
            if (p.x < left || p.x > right) continue;
            const progress = 1 - p.life / p.maxLife;
            const currentAlpha = p.alpha * (1 - progress * 0.7);
            _poolDrawPos.x = p.x;
            _poolDrawPos.y = p.y;
            drawCircle({
              pos: _poolDrawPos,
              radius: p.r,
              color: p.color,
              opacity: currentAlpha,
            });
          }
        },
      },
    ]);

    const _whiteParticleCol = rgb(255, 255, 255);
    const _jetpackParticleCol = rgb(205, 220, 238);

    function spawnDust(at) {
      spawnPooledParticle(
        at.x,
        at.y,
        rand(-40, 40),
        rand(-50, -20),
        rand(2, 4),
        _whiteParticleCol,
        0.35,
        0.25,
      );
    }

    function spawnJetpackPuff() {
      if (!jumpJetFx) return;
      const baseX = player.pos.x + tileSize * 0.5;
      const baseY = player.pos.y + tileSize * 0.95;
      for (let i = 0; i < 4; i++) {
        spawnPooledParticle(
          baseX + rand(-6, 6),
          baseY + rand(-2, 3),
          rand(-25, 25),
          rand(60, 100),
          rand(1.8, 3.2),
          _jetpackParticleCol,
          0.38,
          rand(0.28, 0.55),
        );
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
      run.sandstormSecondsLeft = 0;
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

    function isSolidCollider(obj, allowCloudSemi = true) {
      if (!obj || typeof obj.is !== "function") return false;
      if (typeof obj.exists === "function" && !obj.exists()) return false;
      if (!obj.is("solid") || obj.solidEnabled === false) return false;
      if (!allowCloudSemi && obj.is("cloudSemi")) return false;
      return true;
    }

    const _solidTileQuery = vec2(0, 0);
    const _reusableTileSolids = [];
    function solidObjectsAtTile(tileX, tileY, allowCloudSemi = true) {
      _reusableTileSolids.length = 0;
      if (tileX < 0 || tileY < 0) return _reusableTileSolids;
      if (tileX >= level.numColumns() || tileY >= level.numRows()) return _reusableTileSolids;
      _solidTileQuery.x = tileX;
      _solidTileQuery.y = tileY;
      const objs = level.getAt(_solidTileQuery);
      for (let i = 0; i < objs.length; i++) {
        const obj = objs[i];
        if (isSolidCollider(obj, allowCloudSemi)) {
          _reusableTileSolids.push(obj);
        }
      }
      return _reusableTileSolids;
    }

    const _reusableSolidBox = { left: 0, top: 0, right: 0, bottom: 0 };
    function solidBounds(obj, tileX, tileY) {
      if (obj && typeof obj.worldArea === "function") {
        const box = obj.worldArea().bbox();
        _reusableSolidBox.left = box.pos.x;
        _reusableSolidBox.top = box.pos.y;
        _reusableSolidBox.right = box.pos.x + box.width;
        _reusableSolidBox.bottom = box.pos.y + box.height;
        return _reusableSolidBox;
      }
      const tx = tileX * tileSize;
      const ty = tileY * tileSize;
      _reusableSolidBox.left = tx;
      _reusableSolidBox.top = ty;
      _reusableSolidBox.right = tx + tileSize;
      _reusableSolidBox.bottom = ty + tileSize;
      return _reusableSolidBox;
    }

    const _reusablePlayerBox = { left: 0, top: 0, right: 0, bottom: 0 };
    const _reusableStartBox = { left: 0, top: 0, right: 0, bottom: 0 };
    function playerBoxAt(pos = player.pos, out = _reusablePlayerBox) {
      const left = pos.x + playerHitbox.offsetX;
      const top = pos.y + playerHitbox.offsetY;
      out.left = left;
      out.top = top;
      out.right = left + playerHitbox.width;
      out.bottom = top + playerHitbox.height;
      return out;
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
        groundObj && groundObj.exists() && groundObj.pos
          ? { x: groundObj.pos.x, y: groundObj.pos.y }
          : null;
      if (!wasGrounded) player.trigger("ground", groundObj ?? null);
    }

    const _reusableCarryDelta = vec2(0, 0);
    function getGroundCarryDelta() {
      _reusableCarryDelta.x = 0;
      _reusableCarryDelta.y = 0;
      if (!playerGrounded || !playerGroundObject || !playerGroundObject.exists()) {
        clearGroundedState();
        return _reusableCarryDelta;
      }
      if (!playerGroundObject.pos) return _reusableCarryDelta;
      if (!playerGroundObjectPos) {
        playerGroundObjectPos = { x: playerGroundObject.pos.x, y: playerGroundObject.pos.y };
        return _reusableCarryDelta;
      }
      _reusableCarryDelta.x = playerGroundObject.pos.x - playerGroundObjectPos.x;
      _reusableCarryDelta.y = playerGroundObject.pos.y - playerGroundObjectPos.y;
      playerGroundObjectPos.x = playerGroundObject.pos.x;
      playerGroundObjectPos.y = playerGroundObject.pos.y;
      return _reusableCarryDelta;
    }

    function revealHiddenBlockXY(tileX, tileY) {
      const key = `${tileX},${tileY}`;
      if (!hiddenBlockTileKeys.has(key)) return false;
      hiddenBlockTileKeys.delete(key);
      const normalized = vec2(tileX, tileY);
      const block = level.spawn([
        sprite("used-block"),
        area(),
        body({ isStatic: true }),
        "solid",
        "hiddenBlock",
      ], normalized);
      playSfx("bump");
      const y0 = block.pos.y;
      tween(
        y0,
        y0 - 5,
        0.08,
        (y) => (block.pos.y = y),
        easings.easeOutQuad,
      ).then(() =>
        tween(y0 - 5, y0, 0.08, (y) => (block.pos.y = y), easings.easeInQuad),
      );
      return true;
    }

    function tryRevealHiddenBlockFromHead(startPosX, startPosY, endPosX, endPosY) {
      if (hiddenBlockTileKeys.size === 0) return false;
      const dx = endPosX - startPosX;
      const dy = endPosY - startPosY;
      if (dy >= -1) return false;

      const sweepDistance = Math.max(Math.abs(dx), Math.abs(dy));
      const steps = Math.max(1, Math.ceil(sweepDistance / PLAYER_MOVE_SUBSTEP));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const sampleXBase = startPosX + dx * t;
        const sampleY = startPosY + dy * t - 1;
        const sTileY = Math.floor(sampleY / tileSize);

        if (revealHiddenBlockXY(Math.floor((sampleXBase + tileSize * 0.18) / tileSize), sTileY)) return true;
        if (revealHiddenBlockXY(Math.floor((sampleXBase + tileSize * 0.5) / tileSize), sTileY)) return true;
        if (revealHiddenBlockXY(Math.floor((sampleXBase + tileSize * 0.82) / tileSize), sTileY)) return true;
      }
      return false;
    }

    function resolveHorizontalStep(stepX) {
      if (Math.abs(stepX) <= PLAYER_SOLID_EPSILON) return;
      player.pos.x += stepX;

      const box = playerBoxAt(player.pos, _reusablePlayerBox);
      const minTileY = Math.floor((box.top + PLAYER_SOLID_EPSILON) / tileSize);
      const maxTileY = Math.floor((box.bottom - 2.5) / tileSize);

      if (stepX > 0) {
        const tileX = Math.floor((box.right - PLAYER_SOLID_EPSILON) / tileSize);
        let resolvedX = player.pos.x;
        let collided = false;
        for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
          const solids = solidObjectsAtTile(tileX, tileY, false);
          for (let si = 0; si < solids.length; si++) {
            const solid = solids[si];
            const solidBox = solidBounds(solid, tileX, tileY);
            if (box.bottom <= solidBox.top + 2) continue;
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
        const solids = solidObjectsAtTile(tileX, tileY, false);
        for (let si = 0; si < solids.length; si++) {
          const solid = solids[si];
          const solidBox = solidBounds(solid, tileX, tileY);
          if (box.bottom <= solidBox.top + 2) continue;
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

    const _verticalStepResult = { landedObj: null, hitHead: false };
    function resolveVerticalStep(stepY) {
      if (Math.abs(stepY) <= PLAYER_SOLID_EPSILON) {
        _verticalStepResult.landedObj = null;
        _verticalStepResult.hitHead = false;
        return _verticalStepResult;
      }
      const startPosX = player.pos.x;
      const startPosY = player.pos.y;
      player.pos.y += stepY;

      if (stepY < 0 && tryRevealHiddenBlockFromHead(startPosX, startPosY, player.pos.x, player.pos.y)) {
        _verticalStepResult.landedObj = null;
        _verticalStepResult.hitHead = true;
        return _verticalStepResult;
      }

      const box = playerBoxAt(player.pos, _reusablePlayerBox);
      const minTileX = Math.floor((box.left + PLAYER_SOLID_EPSILON) / tileSize);
      const maxTileX = Math.floor((box.right - PLAYER_SOLID_EPSILON) / tileSize);

      if (stepY > 0) {
        const tileY = Math.floor((box.bottom - PLAYER_SOLID_EPSILON) / tileSize);
        _reusableStartBox.left = startPosX + playerHitbox.offsetX;
        _reusableStartBox.top = startPosY + playerHitbox.offsetY;
        _reusableStartBox.right = _reusableStartBox.left + playerHitbox.width;
        _reusableStartBox.bottom = _reusableStartBox.top + playerHitbox.height;
        let resolvedY = player.pos.y;
        let landedObj = null;

        for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
          const solids = solidObjectsAtTile(tileX, tileY, true);
          for (let si = 0; si < solids.length; si++) {
            const solid = solids[si];
            const solidBox = solidBounds(solid, tileX, tileY);
            if (box.right <= solidBox.left + PLAYER_SOLID_EPSILON) continue;
            if (box.left >= solidBox.right - PLAYER_SOLID_EPSILON) continue;
            if (box.top >= solidBox.bottom - PLAYER_SOLID_EPSILON) continue;
            if (box.bottom <= solidBox.top + PLAYER_SOLID_EPSILON) continue;

            if (solid.is("cloudSemi") && _reusableStartBox.bottom > solidBox.top + 1.5) continue;

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
        _verticalStepResult.landedObj = landedObj;
        _verticalStepResult.hitHead = false;
        return _verticalStepResult;
      }

      const tileY = Math.floor((box.top + PLAYER_SOLID_EPSILON) / tileSize);
      let resolvedY = player.pos.y;
      let headObj = null;
      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
        const solids = solidObjectsAtTile(tileX, tileY, false);
        for (let si = 0; si < solids.length; si++) {
          const solid = solids[si];
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
        _verticalStepResult.landedObj = null;
        _verticalStepResult.hitHead = true;
        return _verticalStepResult;
      }
      _verticalStepResult.landedObj = null;
      _verticalStepResult.hitHead = false;
      return _verticalStepResult;
    }

    function snapPlayerToGround() {
      const box = playerBoxAt(player.pos, _reusablePlayerBox);
      const bLeft = box.left;
      const bRight = box.right;
      const bBottom = box.bottom;
      const sampleY = bBottom + PLAYER_GROUND_PROBE;
      const tileY = Math.floor(sampleY / tileSize);

      let bestObj = null;
      let bestTargetY = Infinity;

      for (let s = 0; s < 3; s++) {
        const sampleX = s === 0 ? bLeft + 1 : (s === 1 ? (bLeft + bRight) * 0.5 : bRight - 1);
        const tileX = Math.floor(sampleX / tileSize);
        const solids = solidObjectsAtTile(tileX, tileY, true);
        for (let si = 0; si < solids.length; si++) {
          const solid = solids[si];
          const solidBox = solidBounds(solid, tileX, tileY);
          if (bRight <= solidBox.left + PLAYER_SOLID_EPSILON) continue;
          if (bLeft >= solidBox.right - PLAYER_SOLID_EPSILON) continue;
          if (solid.is("cloudSemi") && bBottom > solidBox.top + 1.5) continue;

          const verticalDelta = solidBox.top - bBottom;
          if (verticalDelta < -PLAYER_GROUND_PROBE - PLAYER_SOLID_EPSILON) continue;
          if (verticalDelta > PLAYER_GROUND_PROBE + PLAYER_SOLID_EPSILON) continue;

          const targetY =
            solidBox.top - (playerHitbox.offsetY + playerHitbox.height) - PLAYER_SOLID_EPSILON;
          if (targetY < bestTargetY) {
            bestTargetY = targetY;
            bestObj = solid;
          }
        }
      }

      if (!bestObj) return null;
      player.pos.y = bestTargetY;
      if (player.vel.y > 0) player.vel.y = 0;
      return bestObj;
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

    // HUD - Retro Mario Arcade Plates
    add([
      rect(210, 62, { radius: 8 }),
      pos(12, 10),
      color(15, 20, 32),
      opacity(0.78),
      outline({ width: 2, color: rgb(240, 190, 40) }),
      fixed(),
      z(4999),
    ]);

    add([
      text("SCORE", { size: 12 }),
      pos(22, 17),
      color(240, 190, 40),
      fixed(),
      z(5000),
    ]);

    const hudScore = add([
      text("000000", { size: 15 }),
      pos(76, 15),
      color(255, 255, 255),
      fixed(),
      z(5000),
    ]);

    const hudCoinIcon = add([
      sprite("coin"),
      pos(22, 39),
      fixed(),
      scale(0.65),
      z(5000),
    ]);

    const hudCoins = add([
      text("x00", { size: 15 }),
      pos(46, 40),
      color(255, 230, 80),
      fixed(),
      z(5000),
    ]);

    const hudHeartIcon = add([
      sprite("heart"),
      pos(118, 39),
      fixed(),
      scale(0.9),
      z(5000),
    ]);

    const hudLives = add([
      text(`x${run.lives}`, { size: 15 }),
      pos(146, 40),
      color(255, 255, 255),
      fixed(),
      z(5000),
    ]);

    // Top-Right Timer & Power Badge Plate
    add([
      rect(210, 62, { radius: 8 }),
      pos(width() - 222, 10),
      color(15, 20, 32),
      opacity(0.78),
      outline({ width: 2, color: rgb(240, 190, 40) }),
      fixed(),
      z(4999),
    ]);

    add([
      text("TIME", { size: 12 }),
      pos(width() - 212, 17),
      color(240, 190, 40),
      fixed(),
      z(5000),
    ]);

    const hudTime = add([
      text("300", { size: 15 }),
      pos(width() - 22, 15),
      anchor("topright"),
      color(255, 255, 255),
      fixed(),
      z(5000),
    ]);

    add([
      text("POWER", { size: 12 }),
      pos(width() - 212, 40),
      color(170, 185, 210),
      fixed(),
      z(5000),
    ]);

    const hudPower = add([
      text("READY", { size: 14 }),
      pos(width() - 22, 39),
      anchor("topright"),
      color(255, 255, 255),
      fixed(),
      z(5000),
    ]);

    let timeLeft = levelSpec.timeLimit ?? CONFIG.timeLimit;
    let dustTimer = 0;
    let forgeSparkTimer = 0;
    let sandstormPulseTimer = 0;
    let sandstormSparkTimer = 0;
    let startLocked = true;
    let pauseActive = false;
    let bossPowerDropTimer = rand(5.5, 8.5);
    const HUD_COLOR_NEUTRAL = rgb(255, 255, 255);
    const HUD_COLOR_CHARGED = rgb(52, 199, 89);
    const HUD_COLOR_WINGED = rgb(170, 235, 255);
    const HUD_COLOR_FORGED = rgb(255, 156, 94);
    const HUD_COLOR_SANDSTORM = rgb(243, 208, 114);
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
      else if (mode === "sandstorm") hudPower.color = HUD_COLOR_SANDSTORM;
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
        return;
      }
      if (mode === "sandstorm") {
        aura.color = HUD_COLOR_SANDSTORM;
        aura.outline = { width: 2, color: HUD_COLOR_SANDSTORM };
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
      const enemyStackHeight = Math.max(1, Math.floor(enemy.stackHeight ?? 1));
      const stompTopOffset =
        ENEMY_STOMP_ZONE_OFFSET_Y - (enemyStackHeight - 1) * tileSize;
      enemy.stompZone = add([
        pos(enemy.pos.x, enemy.pos.y + stompTopOffset),
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
            const stackHeight = Math.max(
              1,
              Math.floor(this.owner.stackHeight ?? 1),
            );
            this.pos.y =
              this.owner.pos.y +
              ENEMY_STOMP_ZONE_OFFSET_Y -
              (stackHeight - 1) * tileSize;
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
        top:
          enemy.pos.y +
          ENEMY_STOMP_ZONE_OFFSET_Y -
          (Math.max(1, Math.floor(enemy.stackHeight ?? 1)) - 1) * tileSize,
        right: enemy.pos.x + tileSize,
        bottom:
          enemy.pos.y +
          ENEMY_STOMP_ZONE_OFFSET_Y -
          (Math.max(1, Math.floor(enemy.stackHeight ?? 1)) - 1) * tileSize +
          ENEMY_STOMP_ZONE_HEIGHT,
      };
    }

    function isPlayerStompingEnemy(enemy, col = null) {
      if (!enemy || !enemy.exists()) return false;
      if (enemy.defeated) return false;

      // Player must be moving downward or in a falling/descending state
      const isDescending =
        (typeof player.isFalling === "function" && player.isFalling()) ||
        (player.vel && player.vel.y >= -20);
      if (!isDescending) return false;

      // If Kaboom collision normal indicates collision from bottom, it's definitely a stomp
      if (col && col.isBottom()) return true;

      const box = playerBoxAt(player.pos, _reusablePlayerBox);
      const stackHeight = Math.max(1, Math.floor(enemy.stackHeight ?? 1));
      const enemyTop = enemy.pos.y - (stackHeight - 1) * tileSize;
      const enemyBottom = enemy.pos.y + tileSize;

      // Horizontal overlap check with generous leeway
      const hOverlap = box.right >= enemy.pos.x + 1 && box.left <= enemy.pos.x + tileSize - 1;
      if (!hOverlap) return false;

      // Check vertical contact: player's feet must actually reach the enemy top!
      // Must not trigger if player is jumping or flying high above the enemy.
      const enemyStompCutoff = enemyTop + (enemyBottom - enemyTop) * 0.65;
      const touchingEnemyStompZone =
        box.bottom >= enemyTop - 8 && box.bottom <= enemyStompCutoff + 8;

      if (!touchingEnemyStompZone) return false;

      // Ensure hit is coming from above (player's top is above enemy top)
      if (box.top > enemyTop + 6) return false;

      return true;
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
      destroyEnemyStackFollowers(enemy);
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
      // Clamped delta-time prevents physics tunneling and lag spirals during frame drops
      const frameDt = Math.min(Math.max(dt(), 0.001), 0.0334);
      const now = time();

      // HUD.
      setHudText(hudScore, run.score.toString().padStart(6, "0"));
      setHudText(hudCoins, `x${run.coins.toString().padStart(2, "0")}`);
      setHudText(hudLives, `x${run.lives}`);
      const secLeft = Math.max(0, Math.floor(timeLeft));
      setHudText(hudTime, secLeft.toString().padStart(3, "0"));
      if (secLeft < 25) {
        hudTime.color = Math.floor(time() * 4) % 2 === 0 ? rgb(255, 75, 75) : rgb(255, 255, 255);
      } else {
        hudTime.color = rgb(255, 255, 255);
      }

      let wingActive = run.power === "winged" && run.wingSecondsLeft > 0;
      let forgeActive = run.power === "forged" && run.forgeSecondsLeft > 0;
      let sandstormActive =
        run.power === "sandstorm" && run.sandstormSecondsLeft > 0;
      if (run.power === "charged") {
        setHudText(hudPower, "[ CHARGED ]");
        setHudPowerMode("charged");
      } else if (wingActive) {
        setHudText(
          hudPower,
          `[ WINGS ${Math.max(0, Math.ceil(run.wingSecondsLeft))}s ]`,
        );
        setHudPowerMode("winged");
      } else if (forgeActive) {
        setHudText(
          hudPower,
          `[ FORGE ${Math.max(0, Math.ceil(run.forgeSecondsLeft))}s ]`,
        );
        setHudPowerMode("forged");
      } else if (sandstormActive) {
        setHudText(
          hudPower,
          `[ SAND ${Math.max(0, Math.ceil(run.sandstormSecondsLeft))}s ]`,
        );
        setHudPowerMode("sandstorm");
      } else {
        setHudText(hudPower, "— READY —");
        setHudPowerMode("normal");
      }

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
      } else if (sandstormActive) {
        setAuraMode("sandstorm");
        const pulse = Math.sin(now * 12.5);
        aura.opacity = 0.26 + pulse * 0.05;
        const auraScale = 1 + pulse * 0.06;
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
          spawnPooledParticle(
            player.pos.x + tileSize * 0.5 + rand(-9, 9),
            player.pos.y + tileSize * 0.45,
            rand(-15, 15),
            rand(-70, -40),
            rand(1.1, 2.3),
            rgb(255, rand(140, 196), rand(84, 118)),
            0.28,
            rand(0.55, 0.9),
          );
        }
      } else {
        forgeSparkTimer = 0;
      }

      if (sandstormActive) {
        sandstormSparkTimer -= frameDt;
        if (sandstormSparkTimer <= 0) {
          sandstormSparkTimer = 0.05 + rand(0, 0.06);
          spawnPooledParticle(
            player.pos.x + tileSize * 0.5 + rand(-14, 14),
            player.pos.y + tileSize * 0.52 + rand(-10, 8),
            rand(-40, 40),
            rand(-40, 40),
            rand(1.3, 2.5),
            rgb(rand(222, 255), rand(176, 222), rand(96, 136)),
            0.32,
            rand(0.48, 0.82),
          );
        }
      } else {
        sandstormSparkTimer = 0;
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
          run.sandstormSecondsLeft = 0;
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
          run.sandstormSecondsLeft = 0;
          playSfx("forge-expire");
          addFloatingText(
            "CORE OUT",
            player.pos.add(tileSize / 2, -10),
            rgb(255, 156, 94),
          );
        }
      } else if (run.power === "sandstorm") {
        run.sandstormSecondsLeft = Math.max(0, run.sandstormSecondsLeft - frameDt);
        if (run.sandstormSecondsLeft <= 0) {
          run.power = "normal";
          run.sandstormSecondsLeft = 0;
          playSfx("sandstorm-expire");
          addFloatingText(
            "STORM OUT",
            player.pos.add(tileSize / 2, -10),
            rgb(243, 208, 114),
          );
        }
      }

      wingActive = run.power === "winged" && run.wingSecondsLeft > 0;
      forgeActive = run.power === "forged" && run.forgeSecondsLeft > 0;
      sandstormActive = run.power === "sandstorm" && run.sandstormSecondsLeft > 0;
      if (sandstormActive) {
        sandstormPulseTimer -= frameDt;
        if (sandstormPulseTimer <= 0) {
          sandstormPulseTimer = 0.11;
          const pulseCenter = player.pos.add(tileSize * 0.5, tileSize * 0.5);
          const pulseRadius = tileSize * 1.68;
          for (let ei = 0; ei < activeEnemies.length; ei++) {
            const enemy = activeEnemies[ei];
            if (!enemy || !enemy.exists() || enemy.defeated) continue;
            const enemyX = enemy.pos.x + tileSize * 0.5;
            const dx = pulseCenter.x - enemyX;
            if (Math.abs(dx) > pulseRadius) continue;
            const enemyY = enemy.pos.y + tileSize * (0.5 - (Math.max(1, Math.floor(enemy.stackHeight ?? 1)) - 1) * 0.5);
            const dy = pulseCenter.y - enemyY;
            if (Math.hypot(dx, dy) > pulseRadius) continue;
            squashEnemy(enemy);
          }
        }
      } else {
        sandstormPulseTimer = 0;
      }
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
      const isDescending =
        (typeof player.isFalling === "function" && player.isFalling()) ||
        (player.vel && player.vel.y >= -20);
      if (isDescending) {
        const px = player.pos.x;
        for (let ei = 0; ei < activeEnemies.length; ei++) {
          const enemy = activeEnemies[ei];
          if (!enemy || !enemy.exists() || enemy.defeated) continue;
          if (Math.abs(enemy.pos.x - px) > 48) continue;
          if (!isPlayerStompingEnemy(enemy)) continue;
          squashEnemy(enemy);
          player.jump(CONFIG.bounceForce);
          if (player.vel) player.vel.y = -CONFIG.bounceForce;
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
      if (kind === "wing" || kind === "forge" || kind === "sandstorm") {
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
          destroyEnemyStackFollowers(enemy);
          destroy(enemy);
        }
      });
    }

    // Player vs enemies.
    player.onCollide("enemyStompZone", (zone, col) => {
      if (ending) return;
      const enemy = zone?.owner;
      if (!enemy || !enemy.exists() || enemy.defeated) return;

      squashEnemy(enemy);
      player.jump(CONFIG.bounceForce);
      if (player.vel) player.vel.y = -CONFIG.bounceForce;
    });

    function resolveEnemyOwner(obj) {
      if (!obj || (typeof obj.exists === "function" && !obj.exists())) return null;
      const owner = obj.stackOwner ?? obj;
      if (!owner || (typeof owner.exists === "function" && !owner.exists())) return null;
      return owner;
    }

    function handleEnemyBodyCollision(enemyObj, col) {
      if (ending) return;
      const enemy = resolveEnemyOwner(enemyObj);
      if (!enemy || enemy.defeated) return;

      const sandstormActive =
        run.power === "sandstorm" && run.sandstormSecondsLeft > 0;
      if (sandstormActive) {
        squashEnemy(enemy);
        return;
      }

      if (isPlayerStompingEnemy(enemy, col)) {
        squashEnemy(enemy);
        player.jump(CONFIG.bounceForce);
        if (player.vel) player.vel.y = -CONFIG.bounceForce;
        return;
      }

      takeHit("enemy");
    }

    player.onCollide("enemy", (enemy, col) => {
      handleEnemyBodyCollision(enemy, col);
    });

    player.onCollide("enemyHitbox", (enemyHitbox, col) => {
      handleEnemyBodyCollision(enemyHitbox, col);
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
