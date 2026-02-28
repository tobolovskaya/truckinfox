/**
 * Geospatial Search Utilities
 *
 * Utilities for finding nearby cargo requests using location-based filtering.
 * Uses geofire-common for geohash/distance helpers and Supabase for data access.
 *
 * Installation required:
 * npm install geofire-common
 * or
 * yarn add geofire-common
 */

import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { supabase } from '../lib/supabase';

type GeoPointTuple = [number, number];

interface CargoRequestResult {
  id: string;
  cargo_type?: string;
  weight?: number;
  price?: number;
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  distance_to_search_center?: number;
  [key: string]: unknown;
}

/**
 * Calculate geohash for a location
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Geohash string
 *
 * @example
 * const hash = calculateGeohash(59.9139, 10.7522); // Oslo
 * console.log(hash); // "u4pruyd"
 */
export function calculateGeohash(lat: number, lng: number): string {
  return geohashForLocation([lat, lng]);
}

/**
 * Search for nearby cargo requests within a radius
 *
 * @param centerLat - Center latitude
 * @param centerLng - Center longitude
 * @param radiusInKm - Search radius in kilometers
 * @param searchType - 'from' or 'to' - which location to search by
 * @returns Array of cargo requests within the radius
 *
 * @example
 * // Find cargo requests within 50km of Oslo
 * const nearbyRequests = await findNearbyCargoRequests(
 *   59.9139,
 *   10.7522,
 *   50,
 *   'from'
 * );
 */
export async function findNearbyCargoRequests(
  centerLat: number,
  centerLng: number,
  radiusInKm: number,
  searchType: 'from' | 'to' = 'from',
  countryCode?: string
): Promise<CargoRequestResult[]> {
  try {
    const center: GeoPointTuple = [centerLat, centerLng];
    const radiusInM = radiusInKm * 1000;

    // Keep geohash bounds utility call for compatibility with existing helper behavior.
    // Supabase query below uses a bounding-box prefilter + exact distance filtering.
    geohashQueryBounds(center, radiusInM);

    const latDelta = radiusInKm / 111;
    const lngDenominator = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.00001);
    const lngDelta = radiusInKm / (111 * lngDenominator);

    const latField = searchType === 'from' ? 'from_lat' : 'to_lat';
    const lngField = searchType === 'from' ? 'from_lng' : 'to_lng';

    let query = supabase
      .from('cargo_requests')
      .select('*')
      .in('status', ['open', 'active', 'bidding'])
      .gte(latField, centerLat - latDelta)
      .lte(latField, centerLat + latDelta)
      .gte(lngField, centerLng - lngDelta)
      .lte(lngField, centerLng + lngDelta)
      .limit(500);

    if (countryCode) {
      query = query.eq('country_code', countryCode.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const matchingDocs: CargoRequestResult[] = (data || [])
      .map(row => {
        const latRaw = row[latField as keyof typeof row];
        const lngRaw = row[lngField as keyof typeof row];
        const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
        const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        const distanceInKm = distanceBetween([lat, lng], center);
        const distanceInM = distanceInKm * 1000;

        if (distanceInM > radiusInM) {
          return null;
        }

        return {
          id: row.id,
          ...row,
          weight: (() => {
            const normalizedWeight =
              typeof row.weight_kg === 'number'
                ? row.weight_kg
                : typeof row.weight_kg === 'string'
                  ? Number(row.weight_kg)
                  : typeof row.weight === 'number'
                    ? row.weight
                    : typeof row.weight === 'string'
                      ? Number(row.weight)
                      : undefined;
            return Number.isFinite(normalizedWeight) ? normalizedWeight : undefined;
          })(),
          distance_to_search_center: distanceInKm,
        } as CargoRequestResult;
      })
      .filter((doc): doc is CargoRequestResult => Boolean(doc));

    const uniqueDocs = matchingDocs.filter(
      (doc, index, self) => index === self.findIndex(d => d.id === doc.id)
    );

    // Sort by distance
    uniqueDocs.sort(
      (a, b) =>
        (a.distance_to_search_center ?? Number.POSITIVE_INFINITY) -
        (b.distance_to_search_center ?? Number.POSITIVE_INFINITY)
    );

    return uniqueDocs;
  } catch (error) {
    console.error('Error finding nearby cargo requests:', error);
    throw error;
  }
}

/**
 * Search for cargo requests along a route
 *
 * Finds cargo requests that are near the route between two points.
 * Useful for carriers to find loads along their planned route.
 *
 * @param fromLat - Route start latitude
 * @param fromLng - Route start longitude
 * @param toLat - Route end latitude
 * @param toLng - Route end longitude
 * @param radiusInKm - Search radius around route points (in km)
 * @returns Array of cargo requests near the route
 *
 * @example
 * // Find cargo along route from Oslo to Bergen
 * const routeCargo = await findCargoAlongRoute(
 *   59.9139, 10.7522,  // Oslo
 *   60.3913, 5.3221,   // Bergen
 *   30  // 30km radius
 * );
 */
export async function findCargoAlongRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  radiusInKm: number = 25,
  countryCode?: string
): Promise<CargoRequestResult[]> {
  try {
    // Search near route start
    const nearStartPromise = findNearbyCargoRequests(
      fromLat,
      fromLng,
      radiusInKm,
      'from',
      countryCode
    );

    // Search near route end
    const nearEndPromise = findNearbyCargoRequests(toLat, toLng, radiusInKm, 'to', countryCode);

    const [nearStart, nearEnd] = await Promise.all([nearStartPromise, nearEndPromise]);

    // Combine and deduplicate results
    const combined = [...nearStart, ...nearEnd];
    const unique = combined.filter(
      (doc, index, self) => index === self.findIndex(d => d.id === doc.id)
    );

    return unique;
  } catch (error) {
    console.error('Error finding cargo along route:', error);
    throw error;
  }
}

/**
 * Calculate distance between two locations
 *
 * @param lat1 - First location latitude
 * @param lng1 - First location longitude
 * @param lat2 - Second location latitude
 * @param lng2 - Second location longitude
 * @returns Distance in kilometers
 *
 * @example
 * const distance = calculateGeoDistance(
 *   59.9139, 10.7522,  // Oslo
 *   60.3913, 5.3221    // Bergen
 * );
 * console.log(distance); // ~304 km
 */
export function calculateGeoDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return distanceBetween([lat1, lng1], [lat2, lng2]);
}

/**
 * Search for cargo requests with flexible filters
 *
 * @param options - Search options
 * @returns Array of matching cargo requests
 *
 * @example
 * const results = await searchCargoRequests({
 *   centerLat: 59.9139,
 *   centerLng: 10.7522,
 *   radiusInKm: 100,
 *   cargoTypes: ['furniture', 'electronics'],
 *   maxWeight: 1000,
 *   minPrice: 500,
 *   maxPrice: 5000,
 * });
 */
export async function searchCargoRequests(options: {
  centerLat: number;
  centerLng: number;
  radiusInKm: number;
  searchType?: 'from' | 'to';
  countryCode?: string;
  cargoTypes?: string[];
  maxWeight?: number;
  minPrice?: number;
  maxPrice?: number;
}): Promise<CargoRequestResult[]> {
  try {
    // Get all nearby requests
    const nearby = await findNearbyCargoRequests(
      options.centerLat,
      options.centerLng,
      options.radiusInKm,
      options.searchType || 'from',
      options.countryCode
    );

    // Apply additional filters
    let filtered = nearby;

    if (options.cargoTypes && options.cargoTypes.length > 0) {
      filtered = filtered.filter(
        doc => typeof doc.cargo_type === 'string' && options.cargoTypes!.includes(doc.cargo_type)
      );
    }

    if (options.maxWeight) {
      filtered = filtered.filter(
        doc => typeof doc.weight === 'number' && doc.weight <= options.maxWeight!
      );
    }

    if (options.minPrice) {
      filtered = filtered.filter(
        doc => typeof doc.price === 'number' && doc.price >= options.minPrice!
      );
    }

    if (options.maxPrice) {
      filtered = filtered.filter(
        doc => typeof doc.price === 'number' && doc.price <= options.maxPrice!
      );
    }

    return filtered;
  } catch (error) {
    console.error('Error searching cargo requests:', error);
    throw error;
  }
}

/**
 * Get geohash precision based on search radius
 *
 * Returns the appropriate geohash precision for a given radius.
 * Smaller radius = higher precision needed.
 *
 * @param radiusInKm - Search radius in kilometers
 * @returns Geohash precision (1-9)
 */
export function getGeohashPrecision(radiusInKm: number): number {
  if (radiusInKm <= 0.6) return 9; // ~0.6 km
  if (radiusInKm <= 5) return 7; // ~5 km
  if (radiusInKm <= 20) return 6; // ~20 km
  if (radiusInKm <= 78) return 5; // ~78 km
  if (radiusInKm <= 630) return 4; // ~630 km
  return 3; // ~2500 km
}
