export function registerWorldMapScene(ctx) {
  const {
    registerCommonHotkeys,
    addFadeIn,
    worldIdForLevel,
    WORLD_MAPS,
    WORLD_THEMES,
    ensureAudioReady,
    bgm,
    hasCompletedLevel,
    progress,
    setLastSelectedLevelId,
    playSfx,
    centerBoxText,
    run,
    onAnyInputPress,
    INPUT,
    anyInputDown,
    LEVELS,
    CONFIG,
    GAMEPAD_STICK_DEADZONE,
  } = ctx;

  scene("worldMap", (data) => {
    const characterId = data?.characterId ?? "cal";
    registerCommonHotkeys({ characterId });
    setGravity(CONFIG.gravity);
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
    const worldMapTrack =
      theme.id === "space"
        ? "overworld-space"
        : theme.id === "desert"
          ? "overworld-desert"
          : theme.id === "cloud"
            ? "overworld-cloud"
            : theme.id === "castle"
              ? "overworld-castle"
            : "overworld";
    bgm.requestTrack(worldMapTrack);

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

    const mapStars = Array.from({ length: 120 }, () => ({
      x: rand(0, width()),
      y: rand(0, height() * 0.74),
      r: rand(0.8, 2.1),
      alpha: rand(0.3, 0.94),
      phase: rand(0, Math.PI * 2),
      speed: rand(1.3, 3.3),
    }));

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

    function drawSpaceMapBackground() {
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [theme.skyTop, theme.skyBottom],
        fixed: true,
      });

      drawEllipse({
        pos: vec2(220, 120),
        radiusX: 150,
        radiusY: 62,
        color: theme.nebulaA,
        opacity: 0.24,
        fixed: true,
      });
      drawEllipse({
        pos: vec2(720, 150),
        radiusX: 180,
        radiusY: 70,
        color: theme.nebulaB,
        opacity: 0.19,
        fixed: true,
      });

      for (const star of mapStars) {
        const twinkle =
          0.65 + Math.sin(time() * star.speed + star.phase) * 0.35;
        drawCircle({
          pos: vec2(star.x, star.y),
          radius: star.r,
          color: rgb(255, 255, 255),
          opacity: star.alpha * twinkle,
          fixed: true,
        });
      }

      drawCircle({
        pos: vec2(126, 96),
        radius: 34,
        color: rgb(186, 206, 236),
        opacity: 0.86,
        fixed: true,
      });

      drawCircle({
        pos: vec2(140, 470),
        radius: 200,
        color: theme.moonSurfaceDark,
        fixed: true,
      });
      drawCircle({
        pos: vec2(430, 456),
        radius: 226,
        color: theme.moonSurfaceLight,
        fixed: true,
      });
      drawCircle({
        pos: vec2(760, 472),
        radius: 198,
        color: theme.moonSurfaceDark,
        fixed: true,
      });
      drawCircle({
        pos: vec2(980, 448),
        radius: 214,
        color: theme.moonSurfaceLight,
        fixed: true,
      });

      drawCircle({
        pos: vec2(290, 438),
        radius: 22,
        color: rgb(108, 116, 132),
        opacity: 0.55,
        fixed: true,
      });
      drawCircle({
        pos: vec2(602, 432),
        radius: 28,
        color: rgb(106, 114, 130),
        opacity: 0.5,
        fixed: true,
      });
      drawCircle({
        pos: vec2(828, 446),
        radius: 18,
        color: rgb(108, 116, 132),
        opacity: 0.54,
        fixed: true,
      });
    }

    function drawCastleMapBackground() {
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [theme.skyTop, theme.skyBottom],
        fixed: true,
      });

      drawRect({
        pos: vec2(0, height() - 154),
        width: width(),
        height: 154,
        gradient: [rgb(90, 34, 24), rgb(46, 20, 18)],
        fixed: true,
      });

      for (let x = -80; x < width() + 160; x += 170) {
        const towerH = 150 + Math.sin(time() * 0.5 + x * 0.01) * 10;
        drawRect({
          pos: vec2(x, 390 - towerH),
          width: 64,
          height: towerH,
          color: theme.stoneDark,
          opacity: 0.84,
          fixed: true,
        });
        drawTriangle({
          p1: vec2(x, 390 - towerH),
          p2: vec2(x + 32, 350 - towerH),
          p3: vec2(x + 64, 390 - towerH),
          color: theme.stoneLight,
          opacity: 0.84,
          fixed: true,
        });
      }

      for (let i = 0; i < 26; i++) {
        drawCircle({
          pos: vec2(i * 40 + ((time() * 24) % 40), 430 + Math.sin(time() * 2 + i) * 12),
          radius: 3 + (i % 3),
          color: theme.lavaGlow,
          opacity: 0.28,
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
      else if (theme.mapStyle === "space") drawSpaceMapBackground();
      else if (theme.mapStyle === "castle") drawCastleMapBackground();
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
}
