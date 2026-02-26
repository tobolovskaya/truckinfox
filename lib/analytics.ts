import { analytics } from './firebase';
import { logEvent as firebaseLogEvent } from 'firebase/analytics';

const logFirebaseEvent = (eventName: string, params?: Record<string, string | number>) => {
  if (!analytics) {
    return;
  }

  firebaseLogEvent(analytics, eventName, params);
};

export const logEvent = {
  cargoRequestCreated: (requestId: string) =>
    logFirebaseEvent('cargo_request_created', { request_id: requestId }),

  bidSubmitted: (bidId: string, amount: number) =>
    logFirebaseEvent('bid_submitted', { bid_id: bidId, amount }),

  paymentCompleted: (orderId: string, amount: number) =>
    logFirebaseEvent('purchase', {
      transaction_id: orderId,
      value: amount,
      currency: 'NOK',
    }),

  appError: (source: string, message: string, hasStack: boolean) =>
    logFirebaseEvent('app_error', {
      source: source.slice(0, 40),
      message: message.slice(0, 100),
      has_stack: hasStack ? 1 : 0,
    }),
};
