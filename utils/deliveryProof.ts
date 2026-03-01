import { supabase } from '../lib/supabase';
import { trackDeliveryProofSubmitted } from './analytics';
import { compressImageForUpload } from './imageCompression';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365;

const base64ToUint8Array = (base64: string): Uint8Array => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = base64.replace(/=+$/, '');

  let buffer = 0;
  let bitsCollected = 0;
  const output: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const value = alphabet.indexOf(char);

    if (value < 0) {
      continue;
    }

    buffer = (buffer << 6) | value;
    bitsCollected += 6;

    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      output.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return new Uint8Array(output);
};

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

    const base64 = await FileSystem.readAsStringAsync(uriToUpload, {
      encoding: 'base64',
    });
    const fileBytes = base64ToUint8Array(base64);

    if (!fileBytes || fileBytes.byteLength === 0) {
      throw new Error('Delivery proof file is empty');
    }

    const { error: uploadError } = await supabase.storage
      .from('cargo')
      .upload(filePath, fileBytes, {
        contentType: type === 'photo' ? 'image/jpeg' : 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from('cargo')
      .createSignedUrl(filePath, STORAGE_SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedData?.signedUrl) {
      throw signedUrlError || new Error('Failed to create signed URL for uploaded image');
    }

    const downloadURL = signedData.signedUrl;

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
