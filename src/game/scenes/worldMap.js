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
      // Deep blue ocean background
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [rgb(32, 98, 205), rgb(22, 72, 165)],
        fixed: true,
      });

      // Animated ocean wave crests
      for (let y = 35; y < height(); y += 42) {
        const drift = ((time() * 18 + y * 7) % (width() + 100)) - 50;
        drawRect({
          pos: vec2(drift, y),
          width: 28,
          height: 3,
          radius: 1.5,
          color: rgb(130, 195, 255),
          opacity: 0.35,
          fixed: true,
        });
      }

      // Island Landmass - 3D Diorama (Sandy beach -> Dirt Cliff -> SMW Grass)
      // Beach layer (golden sand perimeter)
      drawEllipse({
        pos: vec2(530, 275),
        radiusX: 430,
        radiusY: 165,
        color: rgb(240, 212, 130),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(220, 335),
        radiusX: 185,
        radiusY: 130,
        color: rgb(240, 212, 130),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(825, 235),
        radiusX: 195,
        radiusY: 140,
        color: rgb(240, 212, 130),
        fixed: true,
      });

      // 3D Dirt Cliff Edge (shaded brown drop)
      drawEllipse({
        pos: vec2(530, 278),
        radiusX: 412,
        radiusY: 150,
        color: rgb(135, 90, 52),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(220, 338),
        radiusX: 172,
        radiusY: 118,
        color: rgb(135, 90, 52),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(825, 238),
        radiusX: 182,
        radiusY: 128,
        color: rgb(135, 90, 52),
        fixed: true,
      });

      // SMW Lush Grass Plateau Tabletop
      drawEllipse({
        pos: vec2(530, 266),
        radiusX: 410,
        radiusY: 148,
        gradient: [rgb(88, 212, 98), rgb(54, 172, 74)],
        fixed: true,
      });
      drawEllipse({
        pos: vec2(220, 326),
        radiusX: 170,
        radiusY: 116,
        gradient: [rgb(88, 212, 98), rgb(54, 172, 74)],
        fixed: true,
      });
      drawEllipse({
        pos: vec2(825, 226),
        radiusX: 180,
        radiusY: 126,
        gradient: [rgb(88, 212, 98), rgb(54, 172, 74)],
        fixed: true,
      });

      // SMW Hills with Eyes
      function drawSmwHill(x, y, r, hillCol, eyeCol) {
        drawCircle({
          pos: vec2(x, y),
          radius: r,
          color: hillCol,
          fixed: true,
        });
        drawRect({
          pos: vec2(x - 5, y - r + 12),
          width: 3,
          height: 7,
          radius: 1,
          color: eyeCol,
          fixed: true,
        });
        drawRect({
          pos: vec2(x + 2, y - r + 12),
          width: 3,
          height: 7,
          radius: 1,
          color: eyeCol,
          fixed: true,
        });
      }

      drawSmwHill(370, 260, 42, rgb(48, 160, 72), rgb(12, 45, 20));
      drawSmwHill(710, 240, 48, rgb(60, 185, 82), rgb(12, 45, 20));

      // SMW Trees with vertical eyes!
      function drawSmwTree(x, y, s = 1) {
        // Trunk
        drawRect({
          pos: vec2(x - 3 * s, y + 6 * s),
          width: 6 * s,
          height: 10 * s,
          color: rgb(120, 78, 42),
          fixed: true,
        });
        // 3D Shadow
        drawCircle({
          pos: vec2(x, y + 1 * s),
          radius: 14 * s,
          color: rgb(35, 125, 48),
          fixed: true,
        });
        // Main green puff
        drawCircle({
          pos: vec2(x, y),
          radius: 13 * s,
          color: rgb(58, 188, 76),
          fixed: true,
        });
        // Highlight
        drawCircle({
          pos: vec2(x - 3 * s, y - 4 * s),
          radius: 6 * s,
          color: rgb(110, 230, 125),
          fixed: true,
        });
        // Eyes
        drawRect({
          pos: vec2(x - 4 * s, y - 3 * s),
          width: 2 * s,
          height: 6 * s,
          radius: 1,
          color: rgb(10, 35, 15),
          fixed: true,
        });
        drawRect({
          pos: vec2(x + 2 * s, y - 3 * s),
          width: 2 * s,
          height: 6 * s,
          radius: 1,
          color: rgb(10, 35, 15),
          fixed: true,
        });
      }

      const treeCoords = [
        [120, 320, 1.1],
        [160, 395, 0.9],
        [285, 380, 1.0],
        [320, 270, 0.9],
        [430, 335, 1.1],
        [640, 315, 1.0],
        [675, 210, 0.85],
        [745, 345, 1.1],
        [835, 310, 1.0],
        [930, 235, 0.95],
      ];
      for (const [tx, ty, ts] of treeCoords) drawSmwTree(tx, ty, ts);

      // Drifting cartoon Mario clouds in the upper sky
      function drawMarioCloud(x, y, scale = 1) {
        drawEllipse({
          pos: vec2(x, y),
          radiusX: 42 * scale,
          radiusY: 15 * scale,
          color: rgb(255, 255, 255),
          opacity: 0.92,
          fixed: true,
        });
        drawCircle({
          pos: vec2(x - 14 * scale, y - 6 * scale),
          radius: 16 * scale,
          color: rgb(255, 255, 255),
          opacity: 0.95,
          fixed: true,
        });
        drawCircle({
          pos: vec2(x + 12 * scale, y - 8 * scale),
          radius: 18 * scale,
          color: rgb(255, 255, 255),
          opacity: 0.95,
          fixed: true,
        });
      }

      drawMarioCloud(180 + Math.sin(time() * 0.4) * 12, 95, 0.95);
      drawMarioCloud(510 + Math.sin(time() * 0.35 + 1) * 16, 80, 1.1);
      drawMarioCloud(830 + Math.sin(time() * 0.45 + 2) * 14, 105, 0.9);
    }

    function drawDesertMapBackground() {
      // Warm sunlit desert sky
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [rgb(255, 195, 120), rgb(255, 235, 175)],
        fixed: true,
      });

      // Blazing desert sun
      const sunPos = vec2(850, 75);
      drawCircle({
        pos: sunPos,
        radius: 46,
        color: rgb(255, 240, 140),
        opacity: 0.95,
        fixed: true,
      });
      drawCircle({
        pos: sunPos,
        radius: 64 + Math.sin(time() * 3) * 3,
        color: rgb(255, 230, 120),
        opacity: 0.25,
        fixed: true,
      });

      // Background Dunes
      drawCircle({ pos: vec2(180, 480), radius: 260, color: rgb(235, 182, 96), fixed: true });
      drawCircle({ pos: vec2(500, 490), radius: 280, color: rgb(245, 196, 110), fixed: true });
      drawCircle({ pos: vec2(840, 480), radius: 270, color: rgb(235, 182, 96), fixed: true });

      // Desert Island / Plateau Landmass
      drawEllipse({
        pos: vec2(520, 270),
        radiusX: 430,
        radiusY: 170,
        color: rgb(190, 128, 62),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(520, 260),
        radiusX: 426,
        radiusY: 166,
        gradient: [rgb(245, 202, 118), rgb(225, 174, 90)],
        fixed: true,
      });

      // 3D Step Pyramids (SMB3 World 2 Style)
      function drawStepPyramid(cx, by, w, h) {
        const steps = 4;
        for (let i = 0; i < steps; i++) {
          const sw = w * (1 - (i / steps) * 0.75);
          const sh = h / steps;
          const sy = by - (i + 1) * sh;
          // Shaded left face (sunny)
          drawRect({
            pos: vec2(cx - sw / 2, sy),
            width: sw / 2,
            height: sh,
            color: rgb(238, 185, 96),
            fixed: true,
          });
          // Angled shadow right face
          drawRect({
            pos: vec2(cx, sy),
            width: sw / 2,
            height: sh,
            color: rgb(192, 136, 68),
            fixed: true,
          });
        }
      }

      drawStepPyramid(245, 235, 110, 75);
      drawStepPyramid(735, 180, 130, 85);

      // Shimmering Oasis Lagoon at (410, 360)
      drawEllipse({
        pos: vec2(410, 360),
        radiusX: 68,
        radiusY: 30,
        color: rgb(240, 218, 140),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(410, 360),
        radiusX: 60,
        radiusY: 24,
        gradient: [rgb(50, 180, 235), rgb(30, 145, 205)],
        fixed: true,
      });
      // Water ripple
      drawEllipse({
        pos: vec2(410 + Math.sin(time() * 2) * 4, 360),
        radiusX: 34,
        radiusY: 10,
        color: rgb(180, 235, 255),
        opacity: 0.45,
        fixed: true,
      });

      // Palm Trees by the Oasis
      function drawPalmTree(x, y, dir = 1) {
        // Curved trunk
        drawLine({
          p1: vec2(x, y),
          p2: vec2(x + 6 * dir, y - 24),
          width: 5,
          color: rgb(135, 88, 48),
          fixed: true,
        });
        const top = vec2(x + 6 * dir, y - 24);
        // Fronds
        const frondAngles = [-1.3, -0.7, 0, 0.7, 1.3];
        for (const a of frondAngles) {
          const fx = top.x + Math.sin(a) * 18;
          const fy = top.y - Math.cos(a) * 10 + Math.abs(a) * 4;
          drawLine({
            p1: top,
            p2: vec2(fx, fy),
            width: 3.5,
            color: rgb(55, 175, 68),
            fixed: true,
          });
        }
      }

      drawPalmTree(345, 365, -1);
      drawPalmTree(475, 365, 1);

      // Saguaro Cacti
      function drawCactus(x, y, s = 1) {
        const cCol = rgb(70, 160, 75);
        // Main stem
        drawRect({ pos: vec2(x - 3 * s, y - 26 * s), width: 6 * s, height: 26 * s, radius: 2, color: cCol, fixed: true });
        // Left arm
        drawRect({ pos: vec2(x - 12 * s, y - 18 * s), width: 10 * s, height: 4 * s, radius: 1, color: cCol, fixed: true });
        drawRect({ pos: vec2(x - 12 * s, y - 24 * s), width: 4 * s, height: 8 * s, radius: 1, color: cCol, fixed: true });
        // Right arm
        drawRect({ pos: vec2(x + 2 * s, y - 14 * s), width: 10 * s, height: 4 * s, radius: 1, color: cCol, fixed: true });
        drawRect({ pos: vec2(x + 8 * s, y - 20 * s), width: 4 * s, height: 8 * s, radius: 1, color: cCol, fixed: true });
      }

      drawCactus(110, 365, 1.0);
      drawCactus(580, 290, 0.85);
      drawCactus(875, 270, 0.9);
    }

    function drawCloudMapBackground() {
      // Pastel sky gradient
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [rgb(115, 160, 240), rgb(185, 222, 255)],
        fixed: true,
      });

      // Rainbow Bridge arching across the sky
      const rainbowColors = [
        rgb(255, 85, 85),
        rgb(255, 160, 50),
        rgb(255, 225, 60),
        rgb(75, 215, 85),
        rgb(65, 185, 255),
        rgb(140, 105, 245),
      ];
      for (let i = 0; i < rainbowColors.length; i++) {
        const p0 = vec2(60, 240 + i * 5);
        const p1 = vec2(480, 60 + i * 5);
        const p2 = vec2(900, 240 + i * 5);
        const steps = 30;
        for (let s = 0; s < steps; s++) {
          const pt = quadBezier(p0, p1, p2, s / steps);
          drawCircle({
            pos: pt,
            radius: 4,
            color: rainbowColors[i],
            opacity: 0.55,
            fixed: true,
          });
        }
      }

      // Beanstalk vines rising from below
      function drawBeanstalk(x) {
        const vineCol = rgb(65, 185, 80);
        drawLine({
          p1: vec2(x, height()),
          p2: vec2(x, 260),
          width: 7,
          color: vineCol,
          fixed: true,
        });
        // Leaves
        for (let y = height() - 30; y > 270; y -= 45) {
          drawEllipse({
            pos: vec2(x + 12, y),
            radiusX: 12,
            radiusY: 6,
            color: vineCol,
            fixed: true,
          });
          drawEllipse({
            pos: vec2(x - 12, y - 20),
            radiusX: 12,
            radiusY: 6,
            color: vineCol,
            fixed: true,
          });
        }
      }

      drawBeanstalk(210);
      drawBeanstalk(760);

      // Floating Cloud Decks (3D white puff tops with soft powder-blue shadow)
      function drawFloatingCloudDeck(cx, cy, w, h) {
        const floatY = cy + Math.sin(time() * 2 + cx * 0.01) * 4;
        // Soft blue bottom shadow
        drawRect({
          pos: vec2(cx - w / 2, floatY + 8),
          width: w,
          height: h,
          radius: h / 2,
          color: rgb(185, 215, 248),
          opacity: 0.9,
          fixed: true,
        });
        // Pure white top platform
        drawRect({
          pos: vec2(cx - w / 2, floatY),
          width: w,
          height: h,
          radius: h / 2,
          color: rgb(255, 255, 255),
          fixed: true,
        });
        // Extra puff circles on top edge
        const puffs = Math.floor(w / 35);
        for (let p = 0; p <= puffs; p++) {
          const px = cx - w / 2 + (p / puffs) * w;
          drawCircle({
            pos: vec2(px, floatY - 4),
            radius: 14,
            color: rgb(255, 255, 255),
            fixed: true,
          });
        }
      }

      drawFloatingCloudDeck(500, 280, 360, 48);
      drawFloatingCloudDeck(210, 340, 240, 42);
      drawFloatingCloudDeck(790, 230, 260, 44);

      // Twinkling Golden Overworld Stars
      const starT = time() * 3;
      const cloudStars = [
        [150, 110], [320, 95], [640, 105], [820, 85]
      ];
      for (const [sx, sy] of cloudStars) {
        const sp = 0.7 + Math.sin(starT + sx) * 0.3;
        drawCircle({
          pos: vec2(sx, sy),
          radius: 4 * sp,
          color: rgb(255, 235, 100),
          fixed: true,
        });
      }
    }

    function drawSpaceMapBackground() {
      // Cosmic Indigo void
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [rgb(6, 9, 22), rgb(14, 20, 44)],
        fixed: true,
      });

      // Nebulae
      drawEllipse({
        pos: vec2(260, 130),
        radiusX: 180,
        radiusY: 75,
        color: rgb(75, 45, 130),
        opacity: 0.28,
        fixed: true,
      });
      drawEllipse({
        pos: vec2(710, 140),
        radiusX: 200,
        radiusY: 85,
        color: rgb(35, 95, 160),
        opacity: 0.24,
        fixed: true,
      });

      // Starfield
      for (const star of mapStars) {
        const twinkle = 0.65 + Math.sin(time() * star.speed + star.phase) * 0.35;
        drawCircle({
          pos: vec2(star.x, star.y),
          radius: star.r,
          color: rgb(255, 255, 255),
          opacity: star.alpha * twinkle,
          fixed: true,
        });
      }

      // Distant Home Planet (Earth / Blue Marble) in upper right
      const planetPos = vec2(830, 85);
      // Outer atmospheric glow
      drawCircle({
        pos: planetPos,
        radius: 48,
        color: rgb(80, 170, 255),
        opacity: 0.3,
        fixed: true,
      });
      // Ocean sphere
      drawCircle({
        pos: planetPos,
        radius: 40,
        color: rgb(38, 120, 215),
        fixed: true,
      });
      // Continent swirls
      drawEllipse({
        pos: planetPos.add(-8, -6),
        radiusX: 16,
        radiusY: 12,
        color: rgb(65, 185, 95),
        opacity: 0.85,
        fixed: true,
      });
      drawEllipse({
        pos: planetPos.add(10, 10),
        radiusX: 14,
        radiusY: 10,
        color: rgb(65, 185, 95),
        opacity: 0.85,
        fixed: true,
      });
      // Cloud swirl
      drawEllipse({
        pos: planetPos.add(-2, 2),
        radiusX: 24,
        radiusY: 6,
        color: rgb(255, 255, 255),
        opacity: 0.65,
        fixed: true,
      });

      // Lunar Continent Plateau (Cratered Silver-Gray Landmass)
      drawEllipse({
        pos: vec2(500, 310),
        radiusX: 430,
        radiusY: 165,
        color: rgb(110, 118, 134),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(500, 298),
        radiusX: 424,
        radiusY: 160,
        gradient: [rgb(175, 185, 202), rgb(135, 144, 160)],
        fixed: true,
      });

      // 3D Lunar Craters
      function drawLunarCrater(x, y, rx, ry) {
        drawEllipse({ pos: vec2(x, y), radiusX: rx, radiusY: ry, color: rgb(215, 222, 235), fixed: true });
        drawEllipse({ pos: vec2(x + 2, y + 2), radiusX: rx - 3, radiusY: ry - 2, color: rgb(90, 96, 112), fixed: true });
        drawEllipse({ pos: vec2(x + 1, y + 1), radiusX: rx - 6, radiusY: ry - 4, color: rgb(125, 132, 148), fixed: true });
      }

      drawLunarCrater(220, 310, 28, 16);
      drawLunarCrater(340, 370, 38, 20);
      drawLunarCrater(670, 330, 32, 18);
      drawLunarCrater(790, 270, 24, 14);
      drawLunarCrater(430, 235, 20, 12);
    }

    function drawCastleMapBackground() {
      // Dark volcanic sky
      drawRect({
        pos: vec2(0, 0),
        width: width(),
        height: height(),
        gradient: [rgb(24, 18, 28), rgb(54, 22, 26)],
        fixed: true,
      });

      // Boiling Molten Lava Sea
      drawRect({
        pos: vec2(0, height() - 170),
        width: width(),
        height: 170,
        gradient: [rgb(225, 55, 22), rgb(180, 28, 16)],
        fixed: true,
      });

      // Glowing lava waves & bubbles
      for (let i = 0; i < 28; i++) {
        const bx = (i * 38 + time() * 22) % (width() + 40) - 20;
        const by = height() - 150 + Math.sin(time() * 2.5 + i) * 14;
        drawCircle({
          pos: vec2(bx, by),
          radius: 3 + (i % 3),
          color: rgb(255, 215, 80),
          opacity: 0.65,
          fixed: true,
        });
      }

      // Rising lava embers / sparks
      for (let i = 0; i < 18; i++) {
        const ex = (i * 54 + Math.sin(time() + i) * 20) % width();
        const ey = (height() - ((time() * 45 + i * 30) % 240));
        drawCircle({
          pos: vec2(ex, ey),
          radius: 1.8,
          color: rgb(255, 175, 50),
          opacity: 0.75,
          fixed: true,
        });
      }

      // Volcanic Obsidian / Basalt Continent
      drawEllipse({
        pos: vec2(510, 265),
        radiusX: 430,
        radiusY: 165,
        color: rgb(24, 24, 32),
        fixed: true,
      });
      drawEllipse({
        pos: vec2(510, 256),
        radiusX: 424,
        radiusY: 160,
        gradient: [rgb(58, 62, 75), rgb(36, 38, 48)],
        fixed: true,
      });

      // Fiery cracks / fissures cutting through obsidian
      function drawLavaCrack(x1, y1, x2, y2, x3, y3) {
        drawLine({ p1: vec2(x1, y1), p2: vec2(x2, y2), width: 3, color: rgb(255, 110, 35), fixed: true });
        drawLine({ p1: vec2(x2, y2), p2: vec2(x3, y3), width: 2.5, color: rgb(255, 190, 60), fixed: true });
      }
      drawLavaCrack(220, 290, 260, 330, 290, 310);
      drawLavaCrack(440, 270, 480, 310, 530, 290);
      drawLavaCrack(680, 240, 720, 280, 760, 250);

      // Foreboding Bowser Castle Citadel Silhouette in the background (around 914, 120)
      const bTowerX = 890;
      const bTowerY = 120;
      drawRect({
        pos: vec2(bTowerX - 30, bTowerY - 50),
        width: 60,
        height: 60,
        color: rgb(30, 30, 40),
        outline: { width: 2, color: rgb(18, 18, 24) },
        fixed: true,
      });
      // Battlement teeth
      for (let t = -30; t < 30; t += 15) {
        drawRect({ pos: vec2(bTowerX + t, bTowerY - 60), width: 10, height: 10, color: rgb(30, 30, 40), fixed: true });
      }
      // Glowing red window slits
      drawRect({ pos: vec2(bTowerX - 12, bTowerY - 30), width: 6, height: 12, color: rgb(255, 60, 40), fixed: true });
      drawRect({ pos: vec2(bTowerX + 6, bTowerY - 30), width: 6, height: 12, color: rgb(255, 60, 40), fixed: true });
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

    // Top Mario World Signpost Banner
    add([
      rect(560, 56, { radius: 10 }),
      pos(width() / 2, 38),
      anchor("center"),
      color(16, 22, 36),
      opacity(0.88),
      outline({ width: 3, color: rgb(245, 195, 50) }),
      fixed(),
      z(3000),
    ]);

    add([
      text(`★ ${world.title} ★`, { size: 17 }),
      pos(width() / 2, 27),
      anchor("center"),
      color(255, 220, 60),
      fixed(),
      z(3001),
    ]);

    const stats = add([
      text(
        `LIVES  x${run.lives}   •   COINS  x${run.coins.toString().padStart(2, "0")}   •   SCORE  ${run.score.toString().padStart(6, "0")}`,
        { size: 13 },
      ),
      pos(width() / 2, 48),
      anchor("center"),
      color(240, 245, 255),
      fixed(),
      z(3001),
    ]);

    // Bottom Level Preview Card (replaces plain text and keyboard instructions)
    add([
      rect(620, 44, { radius: 10 }),
      pos(width() / 2, height() - 34),
      anchor("center"),
      color(16, 22, 36),
      opacity(0.92),
      outline({ width: 2, color: rgb(245, 195, 50) }),
      fixed(),
      z(3000),
    ]);

    const info = add([
      text("", { size: 14 }),
      pos(width() / 2, height() - 34),
      anchor("center"),
      color(255, 255, 255),
      fixed(),
      z(3001),
    ]);

    const NODE_RADIUS = 22;

    for (const node of world.nodes) {
      const isCastleNode = node.kind === "castle" || node.label === "C";

      add([
        pos(node.pos),
        fixed(),
        z(2000),
        {
          draw() {
            const unlocked = isUnlocked(node);
            const completed = isCompleted(node);
            const selected = selectedLevelId === node.levelId;

            const baseOpacity = unlocked ? 1 : 0.45;
            const lift = selected ? 2 + Math.sin(time() * 6) * 1.5 : 0;
            const nodePos = this.pos.add(0, -lift);

            // 3D Drop Shadow
            drawEllipse({
              pos: nodePos.add(3, 5),
              radiusX: NODE_RADIUS + 2,
              radiusY: NODE_RADIUS - 3,
              color: rgb(15, 20, 28),
              opacity: 0.3 * baseOpacity,
              fixed: true,
            });

            if (isCastleNode) {
              // Mini 3D Mario Castle Model!
              const castleBaseColor = unlocked
                ? rgb(125, 130, 145)
                : rgb(75, 80, 90);
              const castleTrimColor = unlocked
                ? rgb(155, 160, 175)
                : rgb(95, 100, 110);
              const castleOutline = unlocked
                ? rgb(45, 50, 60)
                : rgb(35, 40, 50);

              // Main fortress block
              drawRect({
                pos: nodePos.add(-16, -10),
                width: 32,
                height: 22,
                radius: 2,
                color: castleBaseColor,
                outline: { width: 2, color: castleOutline },
                opacity: baseOpacity,
                fixed: true,
              });

              // Left & right turrets
              drawRect({
                pos: nodePos.add(-22, -18),
                width: 11,
                height: 28,
                radius: 2,
                color: castleTrimColor,
                outline: { width: 2, color: castleOutline },
                opacity: baseOpacity,
                fixed: true,
              });
              drawRect({
                pos: nodePos.add(11, -18),
                width: 11,
                height: 28,
                radius: 2,
                color: castleTrimColor,
                outline: { width: 2, color: castleOutline },
                opacity: baseOpacity,
                fixed: true,
              });

              // Dark arched entrance gate
              drawRect({
                pos: nodePos.add(-5, 0),
                width: 10,
                height: 12,
                radius: 4,
                color: rgb(20, 22, 30),
                fixed: true,
              });

              // Flagpole & waving flag on left turret
              drawLine({
                p1: nodePos.add(-17, -18),
                p2: nodePos.add(-17, -30),
                width: 2,
                color: rgb(200, 200, 210),
                opacity: baseOpacity,
                fixed: true,
              });
              const flagWav = Math.sin(time() * 7) * 2;
              drawTriangle({
                p1: nodePos.add(-17, -30),
                p2: nodePos.add(-7 + flagWav, -25),
                p3: nodePos.add(-17, -20),
                color: completed ? rgb(255, 215, 0) : rgb(235, 50, 50),
                opacity: baseOpacity,
                fixed: true,
              });

              if (completed) {
                // Gold Star badge on castle gate
                drawCircle({
                  pos: nodePos.add(0, -6),
                  radius: 5,
                  color: rgb(255, 220, 50),
                  fixed: true,
                });
              }
            } else if (node.kind === "training") {
              // Special Star / Training pad
              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS,
                color: unlocked ? rgb(255, 215, 0) : rgb(120, 125, 135),
                opacity: baseOpacity,
                outline: { width: 3.5, color: rgb(255, 255, 255) },
                fixed: true,
              });
              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS - 6,
                color: unlocked ? rgb(255, 240, 130) : rgb(95, 100, 110),
                opacity: baseOpacity,
                fixed: true,
              });
            } else {
              // Embossed Super Mario World Stone Pad
              const rimColor = !unlocked
                ? rgb(85, 90, 102)
                : completed
                  ? rgb(35, 110, 225)
                  : rgb(245, 175, 25);
              const innerColor = !unlocked
                ? rgb(65, 70, 80)
                : completed
                  ? rgb(65, 155, 255)
                  : rgb(255, 215, 65);
              const outlineColor = !unlocked
                ? rgb(50, 55, 65)
                : completed
                  ? rgb(175, 225, 255)
                  : rgb(255, 250, 180);

              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS,
                color: rimColor,
                opacity: baseOpacity,
                outline: { width: 3.5, color: outlineColor },
                fixed: true,
              });

              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS - 5,
                color: innerColor,
                opacity: baseOpacity,
                fixed: true,
              });

              if (completed) {
                // Mario Gold Star in center!
                drawCircle({
                  pos: nodePos.add(NODE_RADIUS - 5, -NODE_RADIUS + 5),
                  radius: 7,
                  color: rgb(255, 225, 50),
                  outline: { width: 1.5, color: rgb(255, 255, 255) },
                  opacity: 0.98 * baseOpacity,
                  fixed: true,
                });
              }
            }

            // Pulsing Selection Ring
            if (selected) {
              drawCircle({
                pos: nodePos,
                radius: NODE_RADIUS + 10 + Math.sin(time() * 6) * 2,
                fill: false,
                outline: { width: 3, color: rgb(255, 235, 90) },
                opacity: 0.9,
                fixed: true,
              });
            }
          },
        },
      ]);

      // Node label (hidden for castle nodes since 3D castle is shown)
      if (!isCastleNode) {
        const labelSize = node.kind === "training" ? 16 : 18;
        const label = add([
          text(node.label, { size: labelSize, align: "center" }),
          pos(node.pos),
          anchor("center"),
          fixed(),
          z(2100),
          opacity(1),
          color(255, 255, 255),
        ]);
        label.onUpdate(() => {
          const unlocked = isUnlocked(node);
          label.opacity = unlocked ? 1 : 0.55;

          const selected = selectedLevelId === node.levelId;
          const lift = selected ? 2 + Math.sin(time() * 6) * 1.5 : 0;
          label.pos = node.pos.add(0, -lift);
        });
      }
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

      stats.text = `LIVES  x${run.lives}   •   COINS  x${run.coins.toString().padStart(2, "0")}   •   SCORE  ${run.score.toString().padStart(6, "0")}`;

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
          ? `🔒 ${levelTitle} — LOCKED (CLEAR: ${needs})`
          : `🔒 ${levelTitle} — LOCKED`;
        info.color = rgb(235, 160, 140);
        return;
      }

      if (isCompleted(node)) {
        info.text = `★ ${levelTitle} — CLEARED  [ENTER / JUMP TO REPLAY]`;
        info.color = rgb(140, 225, 255);
      } else {
        info.text = `▶ ${levelTitle} — READY  [ENTER / JUMP TO START]`;
        info.color = rgb(255, 230, 90);
      }
    });
  });
}
