import type { ManualVisualAnnotation } from "@/lib/api-service";
import {
  buildEvidenceNavigationState,
  resolveManualVisualEvidence,
} from "@/lib/evidence-authority";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

function annotationCueTime(annotation: ManualVisualAnnotation): number {
  return Number(annotation.start_seconds ?? annotation.timestamp_seconds ?? 0);
}

export function openVideoAtTime(videoId: string, time: number) {
  const timestamp = Math.max(0, Number(time || 0));
  eventBus.emit("openPanelRequest", {
    panelType: "VideoPanel",
    panelProps: { videoId },
  });
  eventBus.emit("videoIdChanged", videoId);
  eventBus.emit("videoTimeLineChanged", timestamp);
}

export function openManualAnnotationInVideo(
  videoId: string,
  annotation: ManualVisualAnnotation,
  options: { focusVideoPanel?: boolean; seekVideo?: boolean } = {},
) {
  const focusVideoPanel = options.focusVideoPanel ?? true;
  const seekVideo = options.seekVideo ?? true;
  const resolvedEvidence = resolveManualVisualEvidence(videoId, annotation);
  const navigationState = buildEvidenceNavigationState(resolvedEvidence);
  const timestamp = navigationState.activeTime || annotationCueTime(annotation);
  if (focusVideoPanel) {
    openVideoAtTime(videoId, timestamp);
  } else {
    eventBus.emit("videoIdChanged", videoId);
    if (seekVideo) {
      eventBus.emit("videoTimeLineChanged", timestamp);
    }
  }
  eventBus.emit("videoIndicationEditOpen", {
    videoId,
    annotationId: annotation.id,
    timestamp,
    annotation,
    resolvedEvidence,
    navigationState,
  });
  eventBus.emit("videoEvidenceSelected", {
    videoId,
    panelType: "VideoPanel",
    overlayKey: `manual-${annotation.id}`,
    modality: "manual",
    timestamp,
    label: annotation.label,
    sourceItem: annotation,
    resolvedEvidence,
    navigationState,
  });
}

export function closeManualAnnotationInVideo(
  videoId: string,
  annotationId: string,
) {
  eventBus.emit("videoIndicationEditClose", {
    videoId,
    annotationId,
    overlayKey: `manual-${annotationId}`,
  });
}

export function openObjectIndicationInVideo(
  videoId: string,
  payload: {
    timestamp: number;
    trackId?: number;
    label?: string;
    start?: number;
    end?: number;
    category?: ManualVisualAnnotation["category"];
    note?: string;
  },
) {
  openVideoAtTime(videoId, payload.timestamp);
  eventBus.emit("videoObjectIndicationEditOpen", {
    videoId,
    ...payload,
  });
}
