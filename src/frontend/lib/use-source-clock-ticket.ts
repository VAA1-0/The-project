"use client";
import { useEffect, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { captureSourceClockNavigation } from "@/lib/source-clock-events";

/** A media callback retains the selection/revision from the render that created it. */
export function useSourceClockTicket(analysisId: string) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const changed = () => refresh(value => value + 1);
    eventBus.on("sourceClockContextChanged", changed);
    return () => eventBus.off("sourceClockContextChanged", changed);
  }, []);
  return captureSourceClockNavigation(analysisId);
}
