export function registerIntroScene(ctx) {
  const {
    registerCommonHotkeys,
    bgm,
    drawStars,
    addFadeIn,
    centerBoxText,
    onAnyInputPress,
    INPUT,
    ensureAudioReady,
    playSfx,
  } = ctx;

  scene("intro", () => {
    registerCommonHotkeys();
    bgm.requestTrack(null);
    drawStars();
    addFadeIn();

    centerBoxText("CAL vs. The Robo-Empire", 120, 36, { align: "center" });
    centerBoxText(
      [
        "My name is Cal.",
        "A Bad Robot is capturing things.",
        "I must save the day!",
        "",
        "Press Enter to continue.",
      ].join("\n"),
      260,
      22,
      { align: "center" },
    );

    centerBoxText("Tip: Hold Shift to RUN • Press M to mute", 440, 16, {
      align: "center",
      opacity: 0.85,
    });

    onAnyInputPress(INPUT.confirm, () => {
      ensureAudioReady();
      playSfx("ui");
      go("characterSelect");
    });
  });
}
