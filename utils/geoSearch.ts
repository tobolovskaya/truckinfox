/**
 * Geospatial Search Utilities
 * 
 * Utilities for finding nearby cargo requests using geohash-based search.
 * Uses geofire-common for efficient geospatial queries with Firestore.
 * 
 * Installation required:
 * npm install geofire-common
 * or
 * yarn add geofire-common
 */

import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { collection, query, where, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  searchType: 'from' | 'to' = 'from'
): Promise<any[]> {
  try {
    const center = [centerLat, centerLng];
    const radiusInM = radiusInKm * 1000;

    // Calculate geohash query bounds
    const bounds = geohashQueryBounds(center, radiusInM);
    const promises = [];

    // Create queries for each geohash range
    for (const b of bounds) {
      const geohashField = searchType === 'from' ? 'from_geohash' : 'to_geohash';
      
      const q = query(
        collection(db, 'cargo_requests'),
        orderBy(geohashField),
        startAt(b[0]),
        endAt(b[1]),
        where('status', '==', 'active')
      );

      promises.push(getDocs(q));
    }

    // Execute all queries in parallel
    const snapshots = await Promise.all(promises);

    const matchingDocs: any[] = [];

    // Collect all matching documents
    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const data = doc.data();
        const lat = searchType === 'from' ? data.from_lat : data.to_lat;
        const lng = searchType === 'from' ? data.from_lng : data.to_lng;

        // Filter by exact distance
        if (lat && lng) {
          const distanceInKm = distanceBetween([lat, lng], center);
          const distanceInM = distanceInKm * 1000;

          if (distanceInM <= radiusInM) {
            matchingDocs.push({
              id: doc.id,
              ...data,
              distance_to_search_center: distanceInKm,
            });
          }
        }
      }
    }

    // Remove duplicates (geohash ranges can overlap)
    const uniqueDocs = matchingDocs.filter((doc, index, self) =>
      index === self.findIndex((d) => d.id === doc.id)
    );

    // Sort by distance
    uniqueDocs.sort((a, b) => a.distance_to_search_center - b.distance_to_search_center);

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
  radiusInKm: number = 25
): Promise<any[]> {
  try {
    // Search near route start
    const nearStartPromise = findNearbyCargoRequests(fromLat, fromLng, radiusInKm, 'from');
    
    // Search near route end
    const nearEndPromise = findNearbyCargoRequests(toLat, toLng, radiusInKm, 'to');

    const [nearStart, nearEnd] = await Promise.all([nearStartPromise, nearEndPromise]);

    // Combine and deduplicate results
    const combined = [...nearStart, ...nearEnd];
    const unique = combined.filter((doc, index, self) =>
      index === self.findIndex((d) => d.id === doc.id)
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
  cargoTypes?: string[];
  maxWeight?: number;
  minPrice?: number;
  maxPrice?: number;
}): Promise<any[]> {
  try {
    // Get all nearby requests
    const nearby = await findNearbyCargoRequests(
      options.centerLat,
      options.centerLng,
      options.radiusInKm,
      options.searchType || 'from'
    );

    // Apply additional filters
    let filtered = nearby;

    if (options.cargoTypes && options.cargoTypes.length > 0) {
      filtered = filtered.filter(doc => 
        options.cargoTypes!.includes(doc.cargo_type)
      );
    }

    if (options.maxWeight) {
      filtered = filtered.filter(doc => 
        doc.weight <= options.maxWeight!
      );
    }

    if (options.minPrice) {
      filtered = filtered.filter(doc => 
        doc.price >= options.minPrice!
      );
    }

    if (options.maxPrice) {
      filtered = filtered.filter(doc => 
        doc.price <= options.maxPrice!
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
  if (radiusInKm <= 0.6) return 9;      // ~0.6 km
  if (radiusInKm <= 5) return 7;         // ~5 km
  if (radiusInKm <= 20) return 6;        // ~20 km
  if (radiusInKm <= 78) return 5;        // ~78 km
  if (radiusInKm <= 630) return 4;       // ~630 km
  return 3;                               // ~2500 km
}
