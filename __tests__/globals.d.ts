// Jest test globals
declare const global: {
  fetch: jest.Mock;
};

// DOM APIs available in Jest environment
interface AbortSignal {
  aborted: boolean;
  onabort: ((this: AbortSignal, ev: Event) => any) | null;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  dispatchEvent(event: Event): boolean;
}

interface AbortController {
  readonly signal: AbortSignal;
  abort(): void;
}

declare var AbortController: {
  prototype: AbortController;
  new(): AbortController;
};

declare var AbortSignal: {
  prototype: AbortSignal;
};
