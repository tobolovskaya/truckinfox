/**
 * Secure Google Places Client Proxy Hook
 * 
 * This utility demonstrates how to call the Cloud Function proxy instead
 * of directly calling the Google Places API (which would expose the API key).
 * 
 * Usage:
 * const { searchPlaces, placeDetails } = useSecurePlacesProxy();
 * const results = await searchPlaces('Oslo');
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetailsResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

/**
 * Hook for accessing Google Places API through secure Forest Cloud Function proxy
 * 
 * This keeps the API key server-side and prevents exposure in the client app
 */
export const useSecurePlacesProxy = () => {
  const functions = getFunctions();

  /**
   * Search for places using the Cloud Function proxy
   * 
   * @param input - Search query
   * @param components - Optional API components restriction (e.g., 'country:no')
   * @returns Array of place suggestions
   */
  const searchPlaces = async (
    input: string,
    components?: string
  ): Promise<PlaceSuggestion[]> => {
    try {
      // Call the Cloud Function instead of Google API directly
      const placesAutocomplete = httpsCallable(functions, 'placesAutocomplete');

      const result = await placesAutocomplete({
        input,
        components: components || 'country:no',
      });

      return result.data.predictions || [];
    } catch (error) {
      console.error('Error searching places via proxy:', error);
      return [];
    }
  };

  /**
   * Get detailed information about a place
   * 
   * @param placeId - Google Places place_id
   * @returns Place details with coordinates and address
   */
  const getPlaceDetails = async (
    placeId: string
  ): Promise<PlaceDetailsResult | null> => {
    try {
      const placeDetails = httpsCallable(functions, 'placeDetails');

      const result = await placeDetails({
        place_id: placeId,
      });

      return result.data.result || null;
    } catch (error) {
      console.error('Error fetching place details via proxy:', error);
      return null;
    }
  };

  /**
   * Check if the proxy is working (health check)
   */
  const checkHealth = async (): Promise<boolean> => {
    try {
      const healthCheck = httpsCallable(functions, 'healthCheck');
      const result = await healthCheck({});

      return result.data.status === 'ok';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  };

  return {
    searchPlaces,
    getPlaceDetails,
    checkHealth,
  };
};

/**
 * Migration guide: Switching from direct API to Cloud Function proxy
 * 
 * BEFORE (Exposes API key):
 * ```typescript
 * const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
 * const response = await fetch(
 *   `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
 *   `key=${GOOGLE_PLACES_API_KEY}&input=${input}`
 * );
 * ```
 * 
 * AFTER (Secure proxy):
 * ```typescript
 * const { searchPlaces } = useSecurePlacesProxy();
 * const results = await searchPlaces(input);
 * ```
 * 
 * Setup steps:
 * 1. Deploy Cloud Functions: firebase deploy --only functions
 * 2. In Google Cloud Console:
 *    - Set environment variable: GOOGLE_PLACES_API_KEY=your_key
 *    - Or use: firebase functions:config:set places.api_key="YOUR_KEY"
 * 3. Update all client code to use useSecurePlacesProxy()
 * 4. Remove EXPO_PUBLIC_GOOGLE_PLACES_API_KEY from .env
 * 5. Test offline mode still works
 * 6. Deploy app update
 */
