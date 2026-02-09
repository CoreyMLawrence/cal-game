import { registerIntroScene } from "./intro.js";
import { registerCharacterSelectScene } from "./characterSelect.js";
import { registerWorldMapScene } from "./worldMap.js";
import { registerGameOverScene } from "./gameOver.js";
import { registerLevelClearScene } from "./levelClear.js";
import { registerGameScene } from "./game.js";

export function registerScenes(core) {
  registerIntroScene(core);
  registerCharacterSelectScene(core);
  registerWorldMapScene(core);
  registerGameOverScene(core);
  registerLevelClearScene(core);
  registerGameScene(core);
}
