import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Send notification when a new bid is placed
export const onNewBid = functions.firestore
  .document('bids/{bidId}')
  .onCreate(async (snap, context) => {
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
    await admin.firestore().collection('notifications').add({
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
      await admin.firestore().collection('notifications').add({
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
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { organizationNumber } = data;

  if (!organizationNumber) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Organization number is required'
    );
  }

  try {
    // Call Brønnøysundregistrene API
    const response = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${organizationNumber}`
    );

    if (!response.ok) {
      throw new functions.https.HttpsError(
        'not-found',
        'Organization not found'
      );
    }

    const orgData = await response.json();

    // Update user profile with verification data
    await admin
      .firestore()
      .doc(`users/${context.auth.uid}`)
      .update({
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
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
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
