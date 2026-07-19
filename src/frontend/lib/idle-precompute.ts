import { apiService } from "./api-service";
import { eventBus } from "./golden-layout-lib/eventBus";
import { VideoService } from "./video-service";

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const HIGH_VALUE_ARTIFACTS = [
  "vaa1_annotation_master_schema",
  "mise_en_scene_scene_cards",
  "datascene_meaning_network",
] as const;

/** Warm the highest-value shared views after inactivity, one task at a time. */
export function installIdlePrecompute(): () => void {
  const idleWindow = window as IdleWindow;
  let analysisId = "";
  let timer: number | null = null;
  let idleHandle: number | null = null;
  let generation = 0;
  let running = false;
  const completed = new Map<string, Set<string>>();

  const cancelScheduled = () => {
    generation += 1;
    if (timer !== null) window.clearTimeout(timer);
    if (idleHandle !== null) idleWindow.cancelIdleCallback?.(idleHandle);
    timer = null;
    idleHandle = null;
  };

  const tasksFor = (id: string) => [
    { key: "summary", run: () => apiService.getStatusSummary(id) },
    { key: "analysis", run: () => VideoService.getAnalysis(id) },
    ...HIGH_VALUE_ARTIFACTS.map((fileType) => ({
      key: `artifact:${fileType}`,
      run: () => apiService.downloadFile(id, fileType),
    })),
  ];

  const schedule = () => {
    cancelScheduled();
    if (!analysisId || running) return;
    const scheduledGeneration = generation;
    timer = window.setTimeout(() => {
      timer = null;
      const launch = () => {
        idleHandle = null;
        if (scheduledGeneration !== generation || !analysisId || running) return;
        const done = completed.get(analysisId) || new Set<string>();
        completed.set(analysisId, done);
        const task = tasksFor(analysisId).find((candidate) => !done.has(candidate.key));
        if (!task) return;
        running = true;
        void task.run()
          .then(() => done.add(task.key))
          .catch(() => undefined)
          .finally(() => {
            running = false;
            if (scheduledGeneration === generation) schedule();
          });
      };
      if (idleWindow.requestIdleCallback && !document.hidden) {
        idleHandle = idleWindow.requestIdleCallback(launch, { timeout: 2_000 });
      } else {
        launch();
      }
    }, document.hidden ? 12_000 : 7_000);
  };

  const activityHandler = () => schedule();
  const videoHandler = (id: string) => {
    analysisId = typeof id === "string" ? id : "";
    schedule();
  };
  const correctionHandler = (payload: string | { analysisId?: string }) => {
    const id = typeof payload === "string" ? payload : payload?.analysisId || analysisId;
    if (id) completed.delete(id);
    if (id === analysisId) schedule();
  };
  const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel"];
  activityEvents.forEach((name) => window.addEventListener(name, activityHandler, { passive: true }));
  document.addEventListener("visibilitychange", activityHandler);
  eventBus.on("videoIdChanged", videoHandler);
  eventBus.on("analysisCorrectionsChanged", correctionHandler);

  return () => {
    cancelScheduled();
    activityEvents.forEach((name) => window.removeEventListener(name, activityHandler));
    document.removeEventListener("visibilitychange", activityHandler);
    eventBus.off("videoIdChanged", videoHandler);
    eventBus.off("analysisCorrectionsChanged", correctionHandler);
  };
}
