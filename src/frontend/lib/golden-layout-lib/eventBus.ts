// services/eventBus.ts
type Callback<T> = (payload: T) => void;

class EventBus {
  private events = new Map<string, Set<Callback<any>>>();

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
    this.events.get(event)?.forEach((cb) => cb(payload));
  }
}

export const eventBus = new EventBus();
