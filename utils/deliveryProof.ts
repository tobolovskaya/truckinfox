import { app, db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { trackDeliveryProofSubmitted } from './analytics';
import { fetchWithTimeout } from './fetchWithTimeout';

const functions = getFunctions(app, 'europe-west1');

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export interface DeliveryProofData {
  photos: string[]; // Array of photo URLs
  signature: string; // Signature data URL or uploaded URL
  delivery_time: unknown; // Firestore timestamp
}

const compressPhoto = async (uri: string): Promise<string> => {
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: 1200 } }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.error('Error compressing delivery photo:', error);
    return uri;
  }
};

/**
 * Upload a single image to Firebase Storage
 */
export const uploadImage = async (
  uri: string,
  orderId: string,
  type: 'photo' | 'signature',
  index?: number
): Promise<string> => {
  try {
    const storage = getStorage();
    const filename =
      type === 'signature' ? `signature_${Date.now()}.png` : `photo_${index}_${Date.now()}.jpg`;
    const uriToUpload = type === 'photo' ? await compressPhoto(uri) : uri;

    const storageRef = ref(storage, `delivery_proofs/${orderId}/${filename}`);

    // Convert URI to blob with timeout
    const response = await fetchWithTimeout(
      uriToUpload,
      {
        method: 'GET',
      },
      15000
    ); // 15 second timeout for image download
    const blob = await response.blob();

    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob, {
      contentType: type === 'photo' ? 'image/jpeg' : 'image/png',
    });

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Upload delivery proof (photos + signature) and update order
 */
export const uploadDeliveryProof = async (
  orderId: string,
  photos: string[], // Local URIs from camera/gallery
  signature: string // Base64 or local URI from signature canvas
): Promise<void> => {
  try {
    console.log('📦 Uploading delivery proof for order:', orderId);

    // Upload all photos to Storage
    const photoUploadPromises = photos.map((photoUri, index) =>
      uploadImage(photoUri, orderId, 'photo', index)
    );
    const uploadedPhotoURLs = await Promise.all(photoUploadPromises);
    console.log('✅ Photos uploaded:', uploadedPhotoURLs);

    // Upload signature to Storage
    const uploadedSignatureURL = await uploadImage(signature, orderId, 'signature');
    console.log('✅ Signature uploaded:', uploadedSignatureURL);

    // Update order document with delivery proof
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status: 'delivered',
      delivery_photos: uploadedPhotoURLs,
      delivery_signature: uploadedSignatureURL,
      delivery_time: serverTimestamp(),
      delivered_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    console.log('✅ Order updated with delivery proof');

    // Track delivery proof submitted
    trackDeliveryProofSubmitted({
      order_id: orderId,
      photo_count: uploadedPhotoURLs.length,
      has_signature: true,
    });

    // Trigger Cloud Function to release funds to carrier
    try {
      const releaseFunds = httpsCallable(functions, 'releaseFundsToCarrier');
      const result = await releaseFunds({ orderId });
      console.log('✅ Funds release triggered:', result.data);
    } catch (fundsError: unknown) {
      console.error('⚠️ Error releasing funds:', fundsError);
      // Don't throw - delivery proof is still recorded
      // Admin can manually process the payout
    }

    console.log('✅ Delivery proof uploaded successfully');
  } catch (error: unknown) {
    console.error('❌ Error uploading delivery proof:', error);
    throw new Error(getErrorMessage(error, 'Failed to upload delivery proof'));
  }
};

/**
 * Get delivery proof for an order
 */
export const getDeliveryProof = async (orderId: string): Promise<DeliveryProofData | null> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await (await import('firebase/firestore')).getDoc(orderRef);

    if (!orderSnap.exists()) {
      return null;
    }

    const orderData = orderSnap.data();
    if (!orderData.delivery_photos || !orderData.delivery_signature) {
      return null;
    }

    return {
      photos: orderData.delivery_photos || [],
      signature: orderData.delivery_signature || '',
      delivery_time: orderData.delivery_time,
    };
  } catch (error) {
    console.error('Error fetching delivery proof:', error);
    return null;
  }
};
