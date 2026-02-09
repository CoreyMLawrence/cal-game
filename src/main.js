import { createGameCore } from "./game/core.js";
import { registerScenes } from "./game/scenes/index.js";

const core = createGameCore();
registerScenes(core);

onLoad(() => {
  go("intro");
});
