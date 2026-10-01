// services/eventBus.ts
type Callback<T> = (payload: T) => void;
import { isAnalysisAllowedInActiveProject, projectScopeViolation } from "@/lib/active-project-scope";

class EventBus {
  private events = new Map<string, Set<Callback<any>>>();
  private latest = new Map<string, unknown>();

  on<T>(event: string, cb: Callback<T>) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(cb);
  }

  off<T>(event: string, cb: Callback<T>) {
    this.events.get(event)?.delete(cb);
  }

  emit<T>(event: string, payload: T) {
    if (event === "videoIdChanged" && typeof payload === "string" && payload && !isAnalysisAllowedInActiveProject(payload)) {
      const violation = projectScopeViolation(payload, "event");
      this.latest.set("projectScopeViolation", violation);
      this.events.get("projectScopeViolation")?.forEach((cb) => cb(violation));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vaa1-project-scope-violation", { detail: violation }));
      }
      return;
    }
    this.latest.set(event, payload);
    this.events.get(event)?.forEach((cb) => cb(payload));
  }

  getLast<T>(event: string): T | undefined {
    return this.latest.get(event) as T | undefined;
  }
}

export const eventBus = new EventBus();
