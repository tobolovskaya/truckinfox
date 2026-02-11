# Vipps Payment Integration Report

## Overview

This document details the implementation of Vipps payment integration for the TruckinFox cargo transportation platform. Vipps is Norway's leading mobile payment solution with over 4 million users.

## Business Requirements

### Payment Flow

1. **Escrow System**: Payments are held in escrow until delivery is confirmed
2. **Instant Transfers**: Carriers receive payment within 24 hours of confirmed delivery
3. **Refund Support**: Full or partial refunds for disputed transactions
4. **Transaction History**: Complete audit trail for all payments

### Use Cases

- **Cargo Request Payment**: Customer pays the accepted bid amount
- **Delivery Confirmation**: Payment is released after signature capture
- **Dispute Resolution**: Ability to refund or adjust payments
- **Commission**: Platform takes a percentage of each transaction

## Technical Implementation

### 1. Vipps API Integration

#### API Endpoints

**Base URL**: `https://api.vipps.no`

**Authentication**:
```typescript
headers: {
  'client_id': process.env.VIPPS_CLIENT_ID,
  'client_secret': process.env.VIPPS_CLIENT_SECRET,
  'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY,
  'Merchant-Serial-Number': process.env.VIPPS_MERCHANT_SERIAL_NUMBER
}
```

#### Payment Initiation

```typescript
POST /ecomm/v2/payments

{
  "merchantInfo": {
    "merchantSerialNumber": "123456",
    "callbackPrefix": "https://truckinfox.app/api/vipps",
    "fallBack": "https://truckinfox.app/payment/result"
  },
  "customerInfo": {
    "mobileNumber": "4712345678"
  },
  "transaction": {
    "orderId": "order_123",
    "amount": 50000, // Amount in øre (NOK * 100)
    "transactionText": "Cargo delivery Oslo to Bergen",
    "timeStamp": "2024-03-15T10:30:00Z"
  }
}
```

#### Payment Capture

```typescript
POST /ecomm/v2/payments/{orderId}/capture

{
  "merchantInfo": {
    "merchantSerialNumber": "123456"
  },
  "transaction": {
    "amount": 50000,
    "transactionText": "Delivery confirmed"
  }
}
```

### 2. Firebase Cloud Function

```typescript
// functions/src/vipps.ts
export const initiateVippsPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orderId, amount, phoneNumber } = data;

  // Get Vipps access token
  const accessToken = await getVippsAccessToken();

  // Initiate payment
  const response = await fetch('https://api.vipps.no/ecomm/v2/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY,
    },
    body: JSON.stringify({
      merchantInfo: {
        merchantSerialNumber: process.env.VIPPS_MERCHANT_SERIAL_NUMBER,
        callbackPrefix: 'https://truckinfox.app/api/vipps',
        fallBack: 'https://truckinfox.app/payment/result',
      },
      customerInfo: {
        mobileNumber: phoneNumber,
      },
      transaction: {
        orderId,
        amount: amount * 100, // Convert to øre
        transactionText: 'TruckinFox cargo delivery',
        timeStamp: new Date().toISOString(),
      },
    }),
  });

  const result = await response.json();

  // Store payment record
  await admin.firestore().collection('payments').doc(orderId).set({
    userId: context.auth.uid,
    amount,
    status: 'initiated',
    vippsOrderId: result.orderId,
    vippsUrl: result.url,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    url: result.url,
  };
});
```

### 3. Webhook Handler

```typescript
export const vippsWebhook = functions.https.onRequest(async (req, res) => {
  const { orderId, transactionStatus } = req.body;

  // Verify webhook authenticity
  const isValid = await verifyVippsWebhook(req);
  if (!isValid) {
    res.status(401).send('Unauthorized');
    return;
  }

  // Update payment status
  await admin.firestore().collection('payments').doc(orderId).update({
    status: transactionStatus.toLowerCase(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // If payment is reserved, capture it
  if (transactionStatus === 'RESERVED') {
    // Payment will be captured after delivery confirmation
    await admin.firestore().collection('orders').doc(orderId).update({
      paymentStatus: 'reserved',
    });
  }

  res.status(200).send('OK');
});
```

### 4. Client-Side Implementation

```typescript
// app/payment/[orderId].tsx
const handlePayment = async () => {
  try {
    setLoading(true);

    // Call Cloud Function
    const result = await functions().httpsCallable('initiateVippsPayment')({
      orderId: order.id,
      amount: order.amount,
      phoneNumber: userProfile.phoneNumber,
    });

    // Open Vipps app or web interface
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Linking.openURL(result.data.url);
    } else {
      // Web: Open in new tab
      window.open(result.data.url, '_blank');
    }

    // Poll for payment status
    pollPaymentStatus(order.id);
  } catch (error) {
    Alert.alert('Error', 'Failed to initiate payment');
  } finally {
    setLoading(false);
  }
};
```

## Escrow System

### Payment Hold

When a bid is accepted:
1. Customer initiates Vipps payment
2. Payment is "reserved" (authorized but not captured)
3. Funds are held by Vipps until capture
4. Order status updated to "payment_reserved"

### Payment Release

When delivery is confirmed:
1. Customer signs delivery confirmation
2. Cloud Function captures the payment
3. Funds are transferred to carrier
4. Platform commission is deducted
5. Order status updated to "completed"

### Refund Process

If delivery is disputed:
1. Admin reviews the dispute
2. Partial or full refund is initiated via Vipps API
3. Funds are returned to customer
4. Carrier is notified

```typescript
export const refundVippsPayment = functions.https.onCall(async (data, context) => {
  const { orderId, amount, reason } = data;

  // Verify admin permission
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const accessToken = await getVippsAccessToken();

  // Initiate refund
  const response = await fetch(
    `https://api.vipps.no/ecomm/v2/payments/${orderId}/refund`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify({
        merchantInfo: {
          merchantSerialNumber: process.env.VIPPS_MERCHANT_SERIAL_NUMBER,
        },
        transaction: {
          amount: amount * 100,
          transactionText: `Refund: ${reason}`,
        },
      }),
    }
  );

  return { success: true };
});
```

## Security Considerations

### 1. API Key Management

- Store keys in Firebase Functions config
- Never expose keys in client code
- Rotate keys regularly
- Use different keys for test/production

### 2. Webhook Verification

```typescript
function verifyVippsWebhook(req: functions.https.Request): boolean {
  const signature = req.headers['x-vipps-signature'];
  const payload = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.VIPPS_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}
```

### 3. Transaction Logging

- Log all API calls
- Store transaction history
- Monitor for suspicious activity
- Implement rate limiting

## Testing

### Test Environment

**Test API**: `https://apitest.vipps.no`

**Test Credentials**:
```
Client ID: test_client_id
Client Secret: test_client_secret
Subscription Key: test_subscription_key
```

### Test Cards

Vipps provides a test app for simulation:
- Download Vipps Test app
- Use test phone number: 90000000
- Test various scenarios (success, failure, timeout)

### Test Scenarios

1. **Successful Payment**
   - Initiate payment
   - Approve in test app
   - Verify status updated

2. **Failed Payment**
   - Initiate payment
   - Decline in test app
   - Verify error handling

3. **Timeout**
   - Initiate payment
   - Don't respond
   - Verify timeout handling

4. **Refund**
   - Complete a payment
   - Initiate refund
   - Verify funds returned

## Production Checklist

- [ ] Obtain production Vipps credentials
- [ ] Update environment variables
- [ ] Configure production webhook URL
- [ ] Test in production environment
- [ ] Set up monitoring and alerts
- [ ] Document support procedures
- [ ] Train support staff
- [ ] Create runbook for common issues

## Monitoring & Alerts

### Metrics to Track

- Payment initiation rate
- Payment success rate
- Average payment time
- Refund rate
- Failed transactions

### Alerts

- High failure rate (> 5%)
- Webhook timeout
- API errors
- Unusual refund volume

## Cost Structure

### Vipps Fees

- Transaction fee: 1.5% + 1 NOK
- Monthly fee: 200 NOK
- Setup fee: Free

### Platform Commission

- 10% of transaction amount
- Minimum: 50 NOK
- Maximum: 5000 NOK

## Support & Troubleshooting

### Common Issues

**Payment Fails to Initiate**
- Check API credentials
- Verify phone number format
- Ensure sufficient funds

**Webhook Not Received**
- Verify webhook URL configuration
- Check firewall settings
- Review Vipps dashboard

**Refund Fails**
- Ensure payment was captured
- Verify refund amount doesn't exceed payment
- Check refund timeframe (30 days)

### Contact Information

- Vipps Support: support@vipps.no
- Technical Issues: integration@vipps.no
- Phone: +47 22 48 28 00

## References

- [Vipps eCom API Documentation](https://github.com/vippsas/vipps-ecom-api)
- [Vipps Integration Guide](https://github.com/vippsas/vipps-developers)
- [Vipps Test Environment](https://github.com/vippsas/vipps-test-environment)
