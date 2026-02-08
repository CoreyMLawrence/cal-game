export function createWorldData({ rgb, vec2 }) {
  const WORLD_THEMES = Object.freeze({
    grassy: Object.freeze({
      id: "grassy",
      mapStyle: "grassy",
      levelStyle: "grassy",
      skyTop: rgb(82, 187, 255),
      skyBottom: rgb(135, 206, 235),
      grassTop: rgb(80, 220, 110),
      grassBottom: rgb(44, 178, 88),
      dirtTop: rgb(152, 110, 72),
      dirtBottom: rgb(118, 82, 52),
      hillLight: rgb(74, 210, 106),
      hillDark: rgb(54, 190, 92),
      pathActive: rgb(255, 255, 255),
      pathInactive: rgb(170, 170, 170),
      nodeOutline: rgb(20, 60, 28),
      nodeShadow: rgb(0, 0, 0),
      trainingDot: rgb(255, 214, 10),
      levelDot: rgb(52, 199, 89),
      textDark: rgb(16, 28, 20),
    }),
    desert: Object.freeze({
      id: "desert",
      mapStyle: "desert",
      levelStyle: "desert",
      skyTop: rgb(255, 205, 128),
      skyBottom: rgb(255, 238, 184),
      sandTop: rgb(243, 198, 112),
      sandBottom: rgb(226, 177, 90),
      duneLight: rgb(234, 186, 100),
      duneDark: rgb(212, 160, 78),
      pyramidLight: rgb(214, 162, 86),
      pyramidDark: rgb(188, 136, 68),
      sun: rgb(255, 234, 132),
      pathActive: rgb(115, 74, 28),
      pathInactive: rgb(170, 140, 110),
      nodeOutline: rgb(108, 70, 25),
      nodeShadow: rgb(40, 24, 8),
      trainingDot: rgb(255, 214, 10),
      levelDot: rgb(245, 156, 66),
      textDark: rgb(72, 46, 20),
    }),
    cloud: Object.freeze({
      id: "cloud",
      mapStyle: "cloud",
      levelStyle: "cloud",
      skyTop: rgb(124, 214, 255),
      skyBottom: rgb(198, 238, 255),
      cloudTop: rgb(252, 252, 255),
      cloudBottom: rgb(214, 234, 255),
      vine: rgb(74, 170, 92),
      pathActive: rgb(255, 255, 255),
      pathInactive: rgb(165, 190, 214),
      nodeOutline: rgb(54, 103, 138),
      nodeShadow: rgb(40, 74, 102),
      trainingDot: rgb(255, 214, 10),
      levelDot: rgb(116, 201, 255),
      textDark: rgb(29, 66, 92),
    }),
  });

  const WORLD_MAPS = Object.freeze({
    world1: Object.freeze({
      id: "world1",
      title: "WORLD 1 — GRASSY AREA",
      themeId: "grassy",
      startLevelId: "training",
      nodes: Object.freeze([
        Object.freeze({
          levelId: "training",
          label: "T",
          kind: "training",
          pos: vec2(210, 344),
          requires: [],
        }),
        Object.freeze({
          levelId: "level1",
          label: "1",
          kind: "level",
          pos: vec2(548, 284),
          requires: ["training"],
          dotColor: WORLD_THEMES.grassy.levelDot,
        }),
        Object.freeze({
          levelId: "level2",
          label: "2",
          kind: "level",
          pos: vec2(792, 258),
          requires: ["level1"],
          dotColor: WORLD_THEMES.grassy.levelDot,
        }),
        Object.freeze({
          levelId: "castle1",
          label: "C",
          kind: "level",
          pos: vec2(884, 166),
          requires: ["level2"],
          dotColor: rgb(230, 230, 230),
        }),
      ]),
      connections: Object.freeze([
        Object.freeze({
          fromLevelId: "training",
          toLevelId: "level1",
          control: vec2(380, 220),
        }),
        Object.freeze({
          fromLevelId: "level1",
          toLevelId: "level2",
          control: vec2(680, 210),
        }),
        Object.freeze({
          fromLevelId: "level2",
          toLevelId: "castle1",
          control: vec2(860, 200),
        }),
      ]),
    }),
    world2: Object.freeze({
      id: "world2",
      title: "WORLD 2 — DESERT DUNES",
      themeId: "desert",
      startLevelId: "desert1",
      nodes: Object.freeze([
        Object.freeze({
          levelId: "desert1",
          label: "1",
          kind: "level",
          pos: vec2(500, 296),
          requires: ["boss1"],
          dotColor: WORLD_THEMES.desert.levelDot,
        }),
      ]),
      connections: Object.freeze([]),
    }),
    world3: Object.freeze({
      id: "world3",
      title: "WORLD 3 — CLOUD KINGDOM",
      themeId: "cloud",
      startLevelId: "cloud1",
      nodes: Object.freeze([
        Object.freeze({
          levelId: "cloud1",
          label: "1",
          kind: "level",
          pos: vec2(500, 274),
          requires: ["desert1"],
          dotColor: WORLD_THEMES.cloud.levelDot,
        }),
      ]),
      connections: Object.freeze([]),
    }),
  });

  function worldIdForLevel(levelId) {
    if (typeof levelId !== "string") return "world1";
    for (const world of Object.values(WORLD_MAPS)) {
      if (world.nodes.some((n) => n.levelId === levelId)) return world.id;
    }
    return "world1";
  }

  return {
    WORLD_THEMES,
    WORLD_MAPS,
    worldIdForLevel,
  };
}
