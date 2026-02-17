import { trace } from 'firebase/performance';
import { performance } from '../lib/firebase';

/**
 * Start a performance trace
 * @param traceName - Name of the trace
 * @returns Trace object with stop method, or null if performance monitoring is not available
 */
export const startTrace = (traceName: string) => {
  try {
    if (performance) {
      const traceInstance = trace(performance, traceName);
      traceInstance.start();
      console.log(`âš¡ Performance trace started: ${traceName}`);

      let stopped = false;

      // Return a wrapper with safe stop method
      return {
        stop: () => {
          if (!stopped) {
            try {
              traceInstance.stop();
              stopped = true;
              console.log(`âš¡ Performance trace stopped: ${traceName}`);
            } catch {
              console.debug(`Performance trace already stopped: ${traceName}`);
            }
          }
        },
        putAttribute: (attribute: string, value: string) => {
          try {
            if (!stopped) {
              traceInstance.putAttribute(attribute, value);
            }
          } catch (error) {
            console.debug('Error setting trace attribute:', error);
          }
        },
        putMetric: (metricName: string, value: number) => {
          try {
            if (!stopped) {
              traceInstance.putMetric(metricName, value);
            }
          } catch (error) {
            console.debug('Error setting trace metric:', error);
          }
        },
      };
    } else {
      // For native platforms, just log
      const startTime = Date.now();
      let stopped = false;
      console.log(`âš¡ Performance trace (console only): ${traceName}`);
      return {
        stop: () => {
          if (!stopped) {
            const duration = Date.now() - startTime;
            console.log(`âš¡ Performance trace stopped: ${traceName} (${duration}ms)`);
            stopped = true;
          }
        },
        putAttribute: () => {},
        putMetric: () => {},
      };
    }
  } catch (error) {
    console.error('Error starting performance trace:', error);
    return null;
  }
};

/**
 * Measure the execution time of an async function
 * @param traceName - Name of the trace
 * @param fn - Async function to measure
 * @returns Result of the function
 */
export const measureAsync = async <T>(traceName: string, fn: () => Promise<T>): Promise<T> => {
  const traceInstance = startTrace(traceName);
  try {
    const result = await fn();
    traceInstance?.stop();
    return result;
  } catch (error) {
    traceInstance?.stop();
    throw error;
  }
};

/**
 * Measure the execution time of a sync function
 * @param traceName - Name of the trace
 * @param fn - Function to measure
 * @returns Result of the function
 */
export const measureSync = <T>(traceName: string, fn: () => T): T => {
  const traceInstance = startTrace(traceName);
  try {
    const result = fn();
    traceInstance?.stop();
    return result;
  } catch (error) {
    traceInstance?.stop();
    throw error;
  }
};

/**
 * Common performance traces
 */
export const PerformanceTraces = {
  FILTER_SHEET_LOAD: 'filter_sheet_load',
  IMAGE_LOAD_TIME: 'image_load_time',
  TYPING_INDICATOR_LATENCY: 'typing_indicator_latency',
  CHAT_MESSAGE_SEND: 'chat_message_send',
  CARGO_REQUEST_CREATE: 'cargo_request_create',
  BID_SUBMIT: 'bid_submit',
} as const;
