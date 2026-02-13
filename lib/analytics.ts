import analytics from '@react-native-firebase/analytics';

export const logEvent = {
  cargoRequestCreated: (requestId: string) => 
    analytics().logEvent('cargo_request_created', { request_id: requestId }),
  
  bidSubmitted: (bidId: string, amount: number) => 
    analytics().logEvent('bid_submitted', { bid_id: bidId, amount }),
  
  paymentCompleted: (orderId: string, amount: number) =>
    analytics().logEvent('purchase', { 
      transaction_id: orderId, 
      value: amount,
      currency: 'NOK' 
    }),
};
