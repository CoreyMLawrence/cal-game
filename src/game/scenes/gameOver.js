export function registerGameOverScene(ctx) {
  const {
    registerCommonHotkeys,
    bgm,
    addFadeIn,
    centerBoxText,
    best,
    onAnyInputPress,
    INPUT,
    ensureAudioReady,
    playSfx,
  } = ctx;

  scene("gameOver", (data) => {
    registerCommonHotkeys();
    bgm.requestTrack(null);
    add([rect(width(), height()), pos(0, 0), color(0, 0, 0), fixed()]);
    addFadeIn();

    centerBoxText("GAME OVER", 170, 48, { align: "center" });
    centerBoxText(`Score: ${data.score}   Coins: ${data.coins}`, 250, 22, {
      align: "center",
    });

    const bestTimeLine =
      best.bestTime === null ? "—" : `${best.bestTime.toFixed(1)}s`;
    centerBoxText(
      `Best Score: ${best.bestScore}   Best Coins: ${best.bestCoins}   Best Time: ${bestTimeLine}`,
      310,
      18,
      { align: "center", opacity: 0.9 },
    );

    centerBoxText("Press Enter to play again.", 390, 20, { align: "center" });
    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      go("characterSelect");
    });
  });
}
