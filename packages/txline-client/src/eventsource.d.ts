declare module 'eventsource' {
  class EventSource {
    constructor(url: string, options?: { headers?: Record<string, string> });
    onmessage: ((e: MessageEvent) => void) | null;
    onerror: ((e: Event) => void) | null;
    close(): void;
    addEventListener(type: string, listener: (e: MessageEvent) => void): void;
  }
  export default EventSource;
}
