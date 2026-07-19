// services/eventBus.ts
type Callback<T> = (payload: T) => void;

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
    this.latest.set(event, payload);
    this.events.get(event)?.forEach((cb) => cb(payload));
  }

  getLast<T>(event: string): T | undefined {
    return this.latest.get(event) as T | undefined;
  }
}

export const eventBus = new EventBus();
