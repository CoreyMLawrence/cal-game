export function registerCharacterSelectScene(ctx) {
  const {
    registerCommonHotkeys,
    bgm,
    addFadeIn,
    centerBoxText,
    CHARACTERS,
    CONFIG,
    best,
    onAnyInputPress,
    INPUT,
    ensureAudioReady,
    playSfx,
    resetRun,
  } = ctx;

  scene("characterSelect", () => {
    registerCommonHotkeys();
    setGravity(CONFIG.gravity);
    bgm.requestTrack(null);
    add([rect(width(), height()), pos(0, 0), color(0, 0, 0), fixed()]);
    addFadeIn();

    centerBoxText("Choose Your Hero", 110, 30);

    const selected = 0;
    const character = CHARACTERS[selected];

    add([
      sprite(character.sprite),
      pos(CONFIG.gameWidth / 2, 210),
      anchor("center"),
      scale(4),
      fixed(),
    ]);

    centerBoxText(character.displayName, 330, 26, { align: "center" });
    centerBoxText(character.description, 370, 18, { align: "center" });

    const bestTimeLine =
      best.bestTime === null ? "—" : `${best.bestTime.toFixed(1)}s (fastest)`;
    centerBoxText(
      `Best Score: ${best.bestScore}   Best Coins: ${best.bestCoins}   Best Time: ${bestTimeLine}`,
      420,
      16,
      { align: "center", opacity: 0.9 },
    );
    centerBoxText("Press Enter to open the World Map", 470, 18, {
      align: "center",
    });

    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      resetRun();
      go("worldMap", {
        characterId: character.id,
        worldId: "world1",
        focusLevelId: "training",
      });
    });
  });
}
