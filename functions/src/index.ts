import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();

// Send notification when a new bid is placed
export const onNewBid = functions.firestore
  .document('bids/{bidId}')
  .onCreate(async (snap, _context) => {
    const bid = snap.data();
    const requestRef = admin.firestore().doc(`cargoRequests/${bid.requestId}`);
    const request = await requestRef.get();

    if (!request.exists) return;

    const requestData = request.data();
    const customerId = requestData?.customerId;

    if (!customerId) return;

    // Send push notification
    const userRef = admin.firestore().doc(`users/${customerId}`);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData?.fcmToken) {
      await admin.messaging().send({
        token: userData.fcmToken,
        notification: {
          title: 'New Bid Received',
          body: `You have a new bid of ${bid.amount} NOK on your cargo request`,
        },
        data: {
          type: 'new_bid',
          bidId: snap.id,
          requestId: bid.requestId,
        },
      });
    }

    // Create notification document
    await admin
      .firestore()
      .collection('notifications')
      .add({
        userId: customerId,
        type: 'new_bid',
        title: 'New Bid Received',
        body: `You have a new bid of ${bid.amount} NOK on your cargo request`,
        data: {
          bidId: snap.id,
          requestId: bid.requestId,
        },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  });

// Send notification when a bid is accepted
export const onBidAccepted = functions.firestore
  .document('bids/{bidId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    // Check if bid was just accepted
    if (newData.status === 'accepted' && oldData.status !== 'accepted') {
      const carrierId = newData.carrierId;

      // Send push notification
      const userRef = admin.firestore().doc(`users/${carrierId}`);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      if (userData?.fcmToken) {
        await admin.messaging().send({
          token: userData.fcmToken,
          notification: {
            title: 'Bid Accepted! 🎉',
            body: 'Congratulations! Your bid has been accepted.',
          },
          data: {
            type: 'bid_accepted',
            bidId: context.params.bidId,
            requestId: newData.requestId,
          },
        });
      }

      // Create notification document
      await admin
        .firestore()
        .collection('notifications')
        .add({
          userId: carrierId,
          type: 'bid_accepted',
          title: 'Bid Accepted! 🎉',
          body: 'Congratulations! Your bid has been accepted.',
          data: {
            bidId: context.params.bidId,
            requestId: newData.requestId,
          },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  });

// Verify carrier using Brønnøysundregistrene API
export const verifyCarrier = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { organizationNumber } = data;

  if (!organizationNumber) {
    throw new functions.https.HttpsError('invalid-argument', 'Organization number is required');
  }

  try {
    // Call Brønnøysundregistrene API
    const response = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${organizationNumber}`
    );

    if (!response.ok) {
      throw new functions.https.HttpsError('not-found', 'Organization not found');
    }

    const orgData = await response.json();

    // Update user profile with verification data
    await admin.firestore().doc(`users/${context.auth.uid}`).update({
      organizationNumber,
      companyName: orgData.navn,
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      companyName: orgData.navn,
    };
  } catch (error) {
    console.error('Error verifying carrier:', error);
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
});

// Process Vipps payment (placeholder - actual implementation would use Vipps API)
export const processVippsPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orderId, amount } = data;

  // In production, this would integrate with Vipps payment API
  // For now, we'll create a placeholder payment record

  try {
    await admin.firestore().collection('payments').add({
      orderId,
      amount,
      userId: context.auth.uid,
      status: 'pending',
      provider: 'vipps',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      paymentId: 'vipps_payment_id',
    };
  } catch (error) {
    console.error('Error processing payment:', error);
    throw new functions.https.HttpsError('internal', 'Payment processing failed');
  }
});

export const refundVippsPayment = functions.https.onCall(async (data, context) => {
  const { orderId, amount, reason } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Not logged in');
  }

  if (!orderId || !amount) {
    throw new functions.https.HttpsError('invalid-argument', 'orderId and amount are required');
  }

  const order = await admin.firestore().doc(`orders/${orderId}`).get();
  const orderData = order.data();

  if (!orderData) {
    throw new functions.https.HttpsError('not-found', 'Order not found');
  }

  if (orderData.customer_id !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not order owner');
  }

  try {
    const vippsAccessToken = process.env.VIPPS_ACCESS_TOKEN;
    if (!vippsAccessToken) {
      throw new functions.https.HttpsError('failed-precondition', 'Vipps token not configured');
    }

    const refundResponse = await axios.post(
      `https://api.vipps.no/ecomm/v2/payments/${orderId}/refund`,
      {
        modificationAmount: { currency: 'NOK', value: amount },
        merchantRefundReason: reason,
      },
      { headers: { Authorization: `Bearer ${vippsAccessToken}` } }
    );

    return { success: true, refundId: refundResponse.data.refundId };
  } catch (error) {
    console.error('Error processing refund:', error);
    throw new functions.https.HttpsError('internal', 'Refund processing failed');
  }
});

export const scheduledNotifications = functions.pubsub
  .schedule('every day 09:00')
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    const since = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

    const requestsSnapshot = await admin
      .firestore()
      .collection('cargo_requests')
      .where('status', '==', 'open')
      .where('created_at', '>=', since)
      .get();

    if (requestsSnapshot.empty) {
      return null;
    }

    const carriersSnapshot = await admin
      .firestore()
      .collection('users')
      .where('user_type', '==', 'carrier')
      .get();

    const tokens: string[] = [];
    const carrierIds: string[] = [];

    carriersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data?.fcmToken) {
        tokens.push(data.fcmToken);
        carrierIds.push(doc.id);
      }
    });

    if (tokens.length === 0) {
      return null;
    }

    const title = 'Nye foresporsler i dag';
    const body = `Det er ${requestsSnapshot.size} nye foresporsler fra de siste 24 timene.`;

    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: {
          type: 'daily_requests_summary',
          count: String(requestsSnapshot.size),
        },
      });
    }

    const batch = admin.firestore().batch();
    const createdAt = admin.firestore.FieldValue.serverTimestamp();

    carrierIds.forEach(userId => {
      const notificationRef = admin.firestore().collection('notifications').doc();
      batch.set(notificationRef, {
        userId,
        type: 'daily_requests_summary',
        title,
        body,
        read: false,
        createdAt,
      });
    });

    await batch.commit();
    return null;
  });

/**
 * Cleanup old typing indicators
 * Runs every 1 minute to remove stale typing indicators (>10 seconds old)
 */
export const cleanupTypingIndicators = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async _context => {
    try {
      // Calculate cutoff timestamp (10 seconds ago)
      const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 10000); // 10 seconds ago

      // Query old typing indicators
      const oldIndicators = await admin
        .firestore()
        .collection('typing_indicators')
        .where('timestamp', '<', cutoff)
        .get();

      if (oldIndicators.empty) {
        console.log('No old typing indicators to clean up');
        return null;
      }

      // Batch delete old indicators
      const batch = admin.firestore().batch();
      oldIndicators.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Cleaned up ${oldIndicators.size} old typing indicators`);
      return null;
    } catch (error) {
      console.error('❌ Error cleaning up typing indicators:', error);
      return null;
    }
  });
