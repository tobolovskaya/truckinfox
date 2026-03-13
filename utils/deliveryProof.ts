import { supabase } from '../lib/supabase';
import { trackDeliveryProofSubmitted } from './analytics';
import { compressImageForUpload } from './imageCompression';
import { File as ExpoFile } from 'expo-file-system';

/** Short-lived URL for display/download — evidence object in Storage is permanent */
const DISPLAY_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

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
  photos: string[]; // Array of fresh signed URLs (1-hour expiry)
  signature: string; // Fresh signed URL (1-hour expiry)
  delivery_time: unknown;
}

/**
 * Upload a single delivery-proof image and return its storage path.
 * The path is permanent — callers regenerate signed URLs on demand.
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

    const base64 = await new ExpoFile(uriToUpload).base64();
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

    // Return the storage path — not a signed URL — so it never expires in the DB.
    return filePath;
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
    const uploadedPhotoPaths = await Promise.all(photoUploadPromises);
    console.log('✅ Photos uploaded:', uploadedPhotoPaths);

    // Upload signature to Storage
    const uploadedSignaturePath = await uploadImage(signature, orderId, 'signature');
    console.log('✅ Signature uploaded:', uploadedSignaturePath);

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivery_photos: uploadedPhotoPaths,
        delivery_signature_url: uploadedSignaturePath,
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
      photo_count: uploadedPhotoPaths.length,
      has_signature: true,
    });

    // Trigger Edge Function to release funds to carrier
    const { data: { session } } = await supabase.auth.getSession();
    const { data: result, error: invokeError } = await supabase.functions.invoke(
      'release-funds-to-carrier',
      {
        body: { orderId },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      }
    );

    if (invokeError) {
      throw new Error(`Failed to release funds: ${invokeError.message}`);
    }

    console.log('✅ Funds release triggered:', result);

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

    // Regenerate short-lived signed URLs from permanent storage paths.
    const photoPaths: string[] = orderData.delivery_photos || [];
    const signedPhotoResults = await Promise.all(
      photoPaths.map(path =>
        supabase.storage.from('cargo').createSignedUrl(path, DISPLAY_URL_EXPIRY_SECONDS)
      )
    );
    const photoUrls = signedPhotoResults.map(r => r.data?.signedUrl ?? '').filter(Boolean);

    const { data: sigData } = await supabase.storage
      .from('cargo')
      .createSignedUrl(orderData.delivery_signature_url, DISPLAY_URL_EXPIRY_SECONDS);

    return {
      photos: photoUrls,
      signature: sigData?.signedUrl ?? '',
      delivery_time: orderData.delivered_at,
    };
  } catch (error) {
    console.error('Error fetching delivery proof:', error);
    return null;
  }
};
