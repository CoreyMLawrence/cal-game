export function registerLevelClearScene(ctx) {
  const {
    registerCommonHotkeys,
    CONFIG,
    bgm,
    addFadeIn,
    centerBoxText,
    onAnyInputPress,
    INPUT,
    ensureAudioReady,
    playSfx,
    worldIdForLevel,
    LEVELS,
  } = ctx;

  scene("levelClear", (data) => {
    registerCommonHotkeys({ characterId: data?.characterId ?? "cal" });
    setGravity(CONFIG.gravity);
    bgm.requestTrack(null);
    add([rect(width(), height()), pos(0, 0), color(0, 0, 0), fixed()]);
    addFadeIn();

    const bonusLabel = data.bonusLabel ?? "Flag Bonus";
    centerBoxText(data.title ?? "LEVEL CLEAR!", 160, 46, { align: "center" });
    centerBoxText(
      `${bonusLabel}: ${data.flagBonus}   Time Bonus: ${data.timeBonus}`,
      240,
      20,
      {
        align: "center",
      },
    );
    centerBoxText(`Score: ${data.score}   Coins: ${data.coins}`, 290, 22, {
      align: "center",
    });

    const nextId = data.nextLevelId ?? null;
    const nextTitle = nextId ? (LEVELS[nextId]?.title ?? "NEXT") : null;
    centerBoxText(
      nextId
        ? `Path unlocked: ${nextTitle}`
        : "Sneak peek complete — more levels coming soon.",
      360,
      18,
      { align: "center", opacity: 0.9 },
    );
    centerBoxText("Press Enter to return to the World Map.", 420, 18, {
      align: "center",
    });
    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      const focusLevelId = nextId ?? data.levelId ?? "training";
      go("worldMap", {
        characterId: data.characterId ?? "cal",
        worldId: data.worldId ?? worldIdForLevel(focusLevelId),
        focusLevelId,
      });
    });
  });
}
