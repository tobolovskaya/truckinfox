import { supabase } from '../lib/supabase';
import { trackDeliveryProofSubmitted } from './analytics';
import { fetchWithTimeout } from './fetchWithTimeout';
import { compressImageForUpload } from './imageCompression';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export interface DeliveryProofData {
  photos: string[]; // Array of photo URLs
  signature: string; // Signature data URL or uploaded URL
  delivery_time: unknown;
}

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
    const filename =
      type === 'signature' ? `signature_${Date.now()}.png` : `photo_${index}_${Date.now()}.jpg`;
    const uriToUpload = type === 'photo' ? await compressImageForUpload(uri) : uri;
    const filePath = `delivery-proofs/${orderId}/${filename}`;

    // Convert URI to blob with timeout
    const response = await fetchWithTimeout(
      uriToUpload,
      {
        method: 'GET',
      },
      15000
    ); // 15 second timeout for image download
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage.from('cargo').upload(filePath, blob, {
      contentType: type === 'photo' ? 'image/jpeg' : 'image/png',
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl: downloadURL },
    } = supabase.storage.from('cargo').getPublicUrl(filePath);

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

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivery_photos: uploadedPhotoURLs,
        delivery_signature_url: uploadedSignatureURL,
        delivered_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Order updated with delivery proof');

    // Track delivery proof submitted
    trackDeliveryProofSubmitted({
      order_id: orderId,
      photo_count: uploadedPhotoURLs.length,
      has_signature: true,
    });

    // Trigger Cloud Function to release funds to carrier
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke(
        'release-funds-to-carrier',
        {
          body: { orderId },
        }
      );

      if (invokeError) {
        throw invokeError;
      }

      console.log('✅ Funds release triggered:', result);
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
    const { data: orderData, error } = await supabase
      .from('orders')
      .select('delivery_photos,delivery_signature_url,delivered_at')
      .eq('id', orderId)
      .maybeSingle();

    if (error || !orderData) {
      return null;
    }

    if (!orderData.delivery_photos || !orderData.delivery_signature_url) {
      return null;
    }

    return {
      photos: orderData.delivery_photos || [],
      signature: orderData.delivery_signature_url || '',
      delivery_time: orderData.delivered_at,
    };
  } catch (error) {
    console.error('Error fetching delivery proof:', error);
    return null;
  }
};
