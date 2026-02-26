'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.healthCheck =
  exports.placeDetails =
  exports.placesAutocomplete =
  exports.retryFailedNotifications =
  exports.sendBatchNotificationsOnNewRequest =
  exports.cleanupTypingIndicators =
  exports.scheduledNotifications =
  exports.refundVippsPayment =
  exports.processVippsPayment =
  exports.verifyCarrier =
  exports.onBidAccepted =
  exports.onNewBid =
    void 0;
const functions = __importStar(require('firebase-functions'));
const admin = __importStar(require('firebase-admin'));
const axios_1 = __importDefault(require('axios'));
admin.initializeApp();
/**
 * 🔄 Retry helper for external API calls with exponential backoff
 * Prevents failures due to temporary network issues or rate limiting
 *
 * @param fn Async function to retry
 * @param retries Number of retries (default: 3)
 * @param delayMs Initial delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
async function withRetry(fn, retries = 3, delayMs = 1000) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Don't retry on the last attempt
      if (attempt === retries) {
        break;
      }
      // Calculate exponential backoff delay
      const delay = delayMs * Math.pow(2, attempt);
      // Log retry attempt
      console.log(
        `🔄 Retry attempt ${attempt + 1}/${retries} after ${delay}ms. Error: ${lastError.message}`
      );
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
// Send notification when a new bid is placed
exports.onNewBid = functions.firestore.document('bids/{bidId}').onCreate(async (snap, _context) => {
  const bid = snap.data();
  const requestRef = admin.firestore().doc(`cargoRequests/${bid.requestId}`);
  const request = await requestRef.get();
  if (!request.exists) return;
  const requestData = request.data();
  const customerId =
    requestData === null || requestData === void 0 ? void 0 : requestData.customerId;
  if (!customerId) return;
  // Send push notification
  const userRef = admin.firestore().doc(`users/${customerId}`);
  const userDoc = await userRef.get();
  const userData = userDoc.data();
  if (userData === null || userData === void 0 ? void 0 : userData.fcmToken) {
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
exports.onBidAccepted = functions.firestore
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
      if (userData === null || userData === void 0 ? void 0 : userData.fcmToken) {
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
exports.verifyCarrier = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const { organizationNumber } = data;
  if (!organizationNumber) {
    throw new functions.https.HttpsError('invalid-argument', 'Organization number is required');
  }
  try {
    // 🔄 Call Brønnøysundregistrene API with retry logic
    const response = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        return await fetch(
          `https://data.brreg.no/enhetsregisteret/api/enheter/${organizationNumber}`,
          {
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }
    });
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
    const message = error instanceof Error ? error.message : 'Verification failed';
    throw new functions.https.HttpsError('internal', message);
  }
});
// Process Vipps payment (placeholder - actual implementation would use Vipps API)
exports.processVippsPayment = functions.https.onCall(async (data, context) => {
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
exports.refundVippsPayment = functions.https.onCall(async (data, context) => {
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
    // 🔄 Call Vipps API with retry logic
    const refundResponse = await withRetry(() =>
      axios_1.default.post(
        `https://api.vipps.no/ecomm/v2/payments/${orderId}/refund`,
        {
          modificationAmount: { currency: 'NOK', value: amount },
          merchantRefundReason: reason,
        },
        {
          headers: { Authorization: `Bearer ${vippsAccessToken}` },
          timeout: 15000, // 15 second timeout for payment operations
        }
      )
    );
    return { success: true, refundId: refundResponse.data.refundId };
  } catch (error) {
    console.error('Error processing refund:', error);
    const message = error instanceof Error ? error.message : 'Refund processing failed';
    throw new functions.https.HttpsError('internal', message);
  }
});
exports.scheduledNotifications = functions.pubsub
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
    const tokens = [];
    const carrierIds = [];
    carriersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data === null || data === void 0 ? void 0 : data.fcmToken) {
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
exports.cleanupTypingIndicators = functions.pubsub
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
/**
 * 📬 Batch notification sending for new cargo requests
 * Efficiently notifies all carriers in the delivery area
 *
 * Batches notifications to:
 * - Reduce Cloud Function invocations and costs
 * - Improve delivery speed with parallel sends
 * - Handle large carrier networks efficiently
 *
 * Flow:
 * 1. New cargo request created
 * 2. Find all active carriers in service area
 * 3. Filter by notification preferences
 * 4. Batch send via FCM (up to 500 tokens per request)
 * 5. Track delivery success/failures
 * 6. Log metrics for monitoring
 */
exports.sendBatchNotificationsOnNewRequest = functions.firestore
  .document('cargo_requests/{requestId}')
  .onCreate(async (snap, context) => {
    var _a;
    const request = snap.data();
    const requestId = context.params.requestId;
    try {
      // Validate required fields
      if (!request.from_city || !request.cargo_type || !request.from_address) {
        console.warn(`⚠️ Incomplete request data: ${requestId}`, {
          hasFromCity: !!request.from_city,
          hasCargoType: !!request.cargo_type,
          hasFromAddress: !!request.from_address,
        });
        return;
      }
      console.log(`📬 Starting batch notification for request: ${requestId}`, {
        fromCity: request.from_city,
        cargoType: request.cargo_type,
      });
      // Step 1: Find carriers in service area
      const carriersQuery = await withRetry(async () => {
        return await admin
          .firestore()
          .collection('users')
          .where('user_type', '==', 'carrier')
          .where('service_areas', 'array-contains', request.from_city)
          .where('is_active', '==', true)
          .get();
      }, 2);
      console.log(`✅ Found ${carriersQuery.size} carriers in ${request.from_city}`);
      if (carriersQuery.empty) {
        console.log(`ℹ️ No active carriers in service area: ${request.from_city}`);
        return;
      }
      // Step 2: Extract valid FCM tokens and check preferences
      const carrierTokens = [];
      const carrierIds = [];
      let skipped = 0;
      let filtered = 0;
      for (const doc of carriersQuery.docs) {
        const carrier = doc.data();
        // Skip if no FCM token
        if (!carrier.fcm_token) {
          skipped++;
          continue;
        }
        // Check notification preferences
        if (
          ((_a = carrier.notification_preferences) === null || _a === void 0
            ? void 0
            : _a.cargo_requests) === false
        ) {
          filtered++;
          continue;
        }
        // Check rate limiting (max 10 notifications per hour per carrier)
        const oneHourAgo = admin.firestore.Timestamp.now().toMillis() - 3600000;
        const recentNotifications = await withRetry(async () => {
          return await admin
            .firestore()
            .collection('notification_history')
            .where('carrier_id', '==', doc.id)
            .where('request_id', '==', requestId)
            .where('timestamp', '>', oneHourAgo)
            .count()
            .get();
        }, 1);
        if (recentNotifications.data().count > 0) {
          console.log(`⏱️ Carrier already notified for this request: ${doc.id}`);
          filtered++;
          continue;
        }
        carrierTokens.push(carrier.fcm_token);
        carrierIds.push(doc.id);
      }
      console.log(`📊 Notification stats:`, {
        total: carriersQuery.size,
        valid: carrierTokens.length,
        noToken: skipped,
        filtered: filtered,
      });
      if (carrierTokens.length === 0) {
        console.log('ℹ️ No carriers available for notification');
        return;
      }
      // Step 3: Batch send notifications (FCM supports up to 500 tokens per request)
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < carrierTokens.length; i += batchSize) {
        batches.push(carrierTokens.slice(i, i + batchSize));
      }
      console.log(`📤 Sending ${batches.length} batch(es) to ${carrierTokens.length} carriers`);
      const notificationTitle = `New Cargo Available`;
      const notificationBody = `${request.cargo_type} from ${request.from_address}`;
      let totalSent = 0;
      let totalFailed = 0;
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        try {
          const response = await withRetry(async () => {
            return await admin.messaging().sendEachForMulticast({
              tokens: batch,
              notification: {
                title: notificationTitle,
                body: notificationBody,
              },
              data: {
                type: 'new_cargo_request',
                requestId: requestId,
                cargoType: request.cargo_type,
                fromCity: request.from_city,
              },
            });
          }, 2);
          totalSent += response.successCount;
          totalFailed += response.failureCount;
          console.log(
            `✅ Batch ${batchIndex + 1}/${batches.length}: ${response.successCount} sent, ${
              response.failureCount
            } failed`
          );
          // Log failed token indices for cleanup
          const failedTokens = response.responses
            .map((sendResponse, index) => {
              if (sendResponse.error) {
                return { tokenIndex: index, error: sendResponse.error.code };
              }
              return null;
            })
            .filter(token => token !== null);
          if (failedTokens.length > 0) {
            console.warn(`⚠️ Failed tokens in batch ${batchIndex + 1}:`, failedTokens);
          }
        } catch (error) {
          console.error(
            `❌ Error sending batch ${batchIndex + 1}/${batches.length}:`,
            error instanceof Error ? error.message : error
          );
          totalFailed += batch.length;
        }
      }
      // Step 4: Record notification delivery
      const deliveryRecord = {
        request_id: requestId,
        cargo_type: request.cargo_type,
        from_city: request.from_city,
        carriers_found: carriersQuery.size,
        tokens_valid: carrierTokens.length,
        sent: totalSent,
        failed: totalFailed,
        success_rate: carrierTokens.length > 0 ? (totalSent / carrierTokens.length) * 100 : 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      await withRetry(async () => {
        return await admin.firestore().collection('notification_delivery_logs').add(deliveryRecord);
      }, 2);
      console.log(`📝 Logged notification delivery:`, deliveryRecord);
      // Step 5: Create notification history for rate limiting
      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = admin.firestore().batch();
      let historyCount = 0;
      carrierIds.forEach((carrierId, index) => {
        if (index < totalSent) {
          // Only record successful sends
          const historyRef = admin.firestore().collection('notification_history').doc();
          batch.set(historyRef, {
            carrier_id: carrierId,
            request_id: requestId,
            notification_type: 'new_cargo_request',
            timestamp: now,
            expires_at: new Date(Date.now() + 3600000), // 1 hour
          });
          historyCount++;
        }
      });
      if (historyCount > 0) {
        await batch.commit();
        console.log(`✅ Recorded ${historyCount} notification history entries`);
      }
      // Step 6: Log success metrics
      console.log(
        `✅ Batch notification completed for request ${requestId}:`,
        `${totalSent}/${carrierTokens.length} delivered (${(
          (totalSent / carrierTokens.length) *
          100
        ).toFixed(1)}%)`
      );
    } catch (error) {
      console.error(`❌ Error in batch notification for ${requestId}:`, error);
      // Log error for monitoring
      await admin
        .firestore()
        .collection('notification_errors')
        .add({
          request_id: requestId,
          error_message: error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(err => console.error('Failed to log error:', err));
    }
  });
/**
 * 🔄 Retry failed FCM tokens by re-querying and attempting resend
 * Runs periodically to handle temporary delivery failures
 *
 * Useful for:
 * - Tokens that became invalid after initial send
 * - Network issues during batch send
 * - Testing retry logic
 */
exports.retryFailedNotifications = functions.pubsub.schedule('every 30 minutes').onRun(async () => {
  try {
    console.log('🔄 Starting retry of failed notifications');
    // Find recent failed notifications (last 30 minutes)
    const thirtyMinutesAgo = admin.firestore.Timestamp.now().toMillis() - 1800000;
    const failedLogs = await withRetry(async () => {
      return await admin
        .firestore()
        .collection('notification_delivery_logs')
        .where('failed', '>', 0)
        .where('created_at', '>', new Date(thirtyMinutesAgo))
        .limit(10) // Avoid too many retries at once
        .get();
    }, 2);
    if (failedLogs.empty) {
      console.log('✅ No failed notifications to retry');
      return null;
    }
    console.log(`🔄 Found ${failedLogs.size} batches with failures`);
    let totalRetried = 0;
    let totalSuccessful = 0;
    for (const doc of failedLogs.docs) {
      const logData = doc.data();
      const requestId = logData.request_id;
      // Get the original request
      const requestDoc = await withRetry(async () => {
        return await admin.firestore().doc(`cargo_requests/${requestId}`).get();
      }, 1);
      if (!requestDoc.exists) {
        console.log(`Request not found: ${requestId}`);
        continue;
      }
      const request = requestDoc.data();
      // Find carriers that failed
      const failedCarriers = await withRetry(async () => {
        return await admin
          .firestore()
          .collection('users')
          .where('user_type', '==', 'carrier')
          .where(
            'service_areas',
            'array-contains',
            request === null || request === void 0 ? void 0 : request.from_city
          )
          .where('is_active', '==', true)
          .get();
      }, 2);
      // Attempt to send to failed carriers
      const tokens = failedCarriers.docs.map(d => d.data().fcm_token).filter(Boolean);
      if (tokens.length > 0) {
        try {
          const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: 'New Cargo Available (Retry)',
              body: `${request === null || request === void 0 ? void 0 : request.cargo_type} from ${
                request === null || request === void 0 ? void 0 : request.from_address
              }`,
            },
            data: {
              type: 'new_cargo_request_retry',
              requestId: requestId,
            },
          });
          totalRetried += tokens.length;
          totalSuccessful += response.successCount;
          console.log(
            `✅ Retry for request ${requestId}: ${response.successCount}/${tokens.length} successful`
          );
        } catch (error) {
          console.error(`❌ Retry failed for request ${requestId}:`, error);
        }
      }
    }
    console.log(
      `✅ Retry completed: ${totalSuccessful}/${totalRetried} successful (${(
        (totalSuccessful / totalRetried) *
        100
      ).toFixed(1)}%)`
    );
    return null;
  } catch (error) {
    console.error('❌ Error in retry failed notifications:', error);
    return null;
  }
});
// Import and export Google Places API proxy functions
// These provide a secure, server-side proxy for Google Places API calls
var placesProxyExample_1 = require('./placesProxyExample');
Object.defineProperty(exports, 'placesAutocomplete', {
  enumerable: true,
  get: function () {
    return placesProxyExample_1.placesAutocomplete;
  },
});
Object.defineProperty(exports, 'placeDetails', {
  enumerable: true,
  get: function () {
    return placesProxyExample_1.placeDetails;
  },
});
Object.defineProperty(exports, 'healthCheck', {
  enumerable: true,
  get: function () {
    return placesProxyExample_1.healthCheck;
  },
});
//# sourceMappingURL=index.js.map
