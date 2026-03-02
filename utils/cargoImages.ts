import { supabase } from '../lib/supabase';

const CARGO_SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24;

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export const extractCargoStoragePath = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const signedOrPublicMarkers = ['/object/sign/cargo/', '/object/public/cargo/'];
  for (const marker of signedOrPublicMarkers) {
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex >= 0) {
      const rawPath = trimmed.slice(markerIndex + marker.length).split('?')[0];
      const decodedPath = decodeURIComponent(rawPath);
      return decodedPath || null;
    }
  }

  if (!isHttpUrl(trimmed)) {
    const normalized = trimmed.replace(/^\/+/, '');
    return normalized || null;
  }

  return null;
};

export const normalizeCargoImageInputs = (value: unknown, legacyImageUrl?: unknown): string[] => {
  const normalized = new Set<string>();

  const pushIfValid = (candidate: unknown) => {
    if (typeof candidate !== 'string') {
      return;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      return;
    }

    normalized.add(trimmed);
  };

  if (Array.isArray(value)) {
    value.forEach(pushIfValid);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          parsed.forEach(pushIfValid);
        } else {
          pushIfValid(trimmed);
        }
      } catch {
        pushIfValid(trimmed);
      }
    } else {
      pushIfValid(trimmed);
    }
  }

  if (normalized.size === 0) {
    pushIfValid(legacyImageUrl);
  }

  return Array.from(normalized);
};

export const resolveCargoImageUrl = async (rawValue: string): Promise<string | null> => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (isHttpUrl(trimmed)) {
    return trimmed;
  }

  const storagePath = extractCargoStoragePath(trimmed);
  if (!storagePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from('cargo')
    .createSignedUrl(storagePath, CARGO_SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
};

export const resolveCargoImageUrls = async (
  values: string[],
  maxCount?: number
): Promise<string[]> => {
  const selected =
    typeof maxCount === 'number' && maxCount > 0 ? values.slice(0, maxCount) : values;

  const resolved = await Promise.all(selected.map(value => resolveCargoImageUrl(value)));
  return resolved.filter((value): value is string => typeof value === 'string' && value.length > 0);
};
