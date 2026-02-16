"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupTypingIndicators = exports.scheduledNotifications = exports.refundVippsPayment = exports.processVippsPayment = exports.verifyCarrier = exports.onBidAccepted = exports.onNewBid = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
// Send notification when a new bid is placed
exports.onNewBid = functions.firestore
    .document('bids/{bidId}')
    .onCreate(async (snap, context) => {
    const bid = snap.data();
    const requestRef = admin.firestore().doc(`cargoRequests/${bid.requestId}`);
    const request = await requestRef.get();
    if (!request.exists)
        return;
    const requestData = request.data();
    const customerId = requestData === null || requestData === void 0 ? void 0 : requestData.customerId;
    if (!customerId)
        return;
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
        // Call Brønnøysundregistrene API
        const response = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${organizationNumber}`);
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
    }
    catch (error) {
        console.error('Error verifying carrier:', error);
        throw new functions.https.HttpsError('internal', 'Verification failed');
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
    }
    catch (error) {
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
        const refundResponse = await axios_1.default.post(`https://api.vipps.no/ecomm/v2/payments/${orderId}/refund`, {
            modificationAmount: { currency: 'NOK', value: amount },
            merchantRefundReason: reason,
        }, { headers: { Authorization: `Bearer ${vippsAccessToken}` } });
        return { success: true, refundId: refundResponse.data.refundId };
    }
    catch (error) {
        console.error('Error processing refund:', error);
        throw new functions.https.HttpsError('internal', 'Refund processing failed');
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
    .onRun(async (context) => {
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
    }
    catch (error) {
        console.error('❌ Error cleaning up typing indicators:', error);
        return null;
    }
});
//# sourceMappingURL=index.js.map