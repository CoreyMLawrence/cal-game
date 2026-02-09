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
    const hiddenBlockTileKeys = new Set();

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

    function revealHiddenBlock(tilePos) {
      if (!tilePos) return false;
      const key = hiddenTileKey(tilePos);
      if (!hiddenBlockTileKeys.has(key)) return false;
      hiddenBlockTileKeys.delete(key);

      const normalized = vec2(Math.floor(tilePos.x), Math.floor(tilePos.y));
      const blockPos = level.tile2Pos(normalized);
      add([
        sprite("used-block"),
        pos(blockPos),
        area(),
        body({ isStatic: true }),
        "solid",
        "hiddenBlock",
      ]);

      // Hidden block behaves like a head bump: reveal, stop upward motion, and keep player below.
      playSfx("bump");
      const blockBottomY = blockPos.y + tileSize;
      if (player.pos.y < blockBottomY) player.pos.y = blockBottomY;
      if (player.vel.y < 0) player.vel.y = 0;

      return true;
    }

    function tryRevealHiddenBlockFromHead() {
      if (hiddenBlockTileKeys.size === 0) return;
      if (player.vel.y >= -1) return;

      const sampleY = player.pos.y - 1;
      const sampleXs = [
        player.pos.x + tileSize * 0.18,
        player.pos.x + tileSize * 0.5,
        player.pos.x + tileSize * 0.82,
      ];

      for (const sampleX of sampleXs) {
        const tilePos = level.pos2Tile(vec2(sampleX, sampleY));
        if (revealHiddenBlock(tilePos)) return;
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
      tryRevealHiddenBlockFromHead();

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
}
