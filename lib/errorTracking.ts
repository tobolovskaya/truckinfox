import { logEvent } from './analytics';

const toErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message || 'Unknown error';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const initializeGlobalErrorTracking = () => {
  const globalObj = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => (_error: unknown, _isFatal?: boolean) => void;
      setGlobalHandler?: (_handler: (_error: unknown, _isFatal?: boolean) => void) => void;
    };
    onunhandledrejection?: ((_event: { reason?: unknown }) => void) | null;
    addEventListener?: (_type: string, _listener: (_event: { reason?: unknown }) => void) => void;
    removeEventListener?: (
      _type: string,
      _listener: (_event: { reason?: unknown }) => void
    ) => void;
  };

  const errorUtils = globalObj.ErrorUtils;
  const previousGlobalHandler = errorUtils?.getGlobalHandler?.();

  if (errorUtils?.setGlobalHandler) {
    errorUtils.setGlobalHandler((error, isFatal) => {
      logEvent.appError(
        isFatal ? 'GlobalException:fatal' : 'GlobalException',
        toErrorMessage(error),
        error instanceof Error ? Boolean(error.stack) : false
      );

      previousGlobalHandler?.(error, isFatal);
    });
  }

  const onUnhandledRejection = (event: { reason?: unknown }) => {
    const reason = event?.reason;
    logEvent.appError(
      'UnhandledPromiseRejection',
      toErrorMessage(reason),
      reason instanceof Error ? Boolean(reason.stack) : false
    );
  };

  const supportsEventListener =
    typeof globalObj.addEventListener === 'function' &&
    typeof globalObj.removeEventListener === 'function';

  let previousOnUnhandledRejection: ((_event: { reason?: unknown }) => void) | null = null;

  if (supportsEventListener) {
    globalObj.addEventListener?.('unhandledrejection', onUnhandledRejection);
  } else {
    previousOnUnhandledRejection = globalObj.onunhandledrejection || null;
    globalObj.onunhandledrejection = event => {
      onUnhandledRejection(event);
      previousOnUnhandledRejection?.(event);
    };
  }

  return () => {
    if (errorUtils?.setGlobalHandler && previousGlobalHandler) {
      errorUtils.setGlobalHandler(previousGlobalHandler);
    }

    if (supportsEventListener) {
      globalObj.removeEventListener?.('unhandledrejection', onUnhandledRejection);
      return;
    }

    globalObj.onunhandledrejection = previousOnUnhandledRejection;
  };
};
