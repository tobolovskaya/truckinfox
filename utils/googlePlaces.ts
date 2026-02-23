import { fetchWithTimeout } from './fetchWithTimeout';

// Read API key from environment variables
// In Expo, use EXPO_PUBLIC_ prefix for client-accessible variables
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Validate API key exists
if (!GOOGLE_PLACES_API_KEY) {
  console.warn(
    '⚠️ Google Places API key not found in environment variables.\n' +
      'Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your .env file.\n' +
      'Falling back to offline Norwegian cities only.'
  );
}

export interface PlaceDetails {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export interface DistanceMatrixResult {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  status: string;
}

export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface PlacesAutocompleteResponse {
  status: string;
  predictions: PlaceSuggestion[];
}

// Norwegian autocomplete with major cities fallback
export const norwegianCities = [
  { name: 'Oslo', lat: 59.9139, lng: 10.7522 },
  { name: 'Bergen', lat: 60.3913, lng: 5.3221 },
  { name: 'Trondheim', lat: 63.4305, lng: 10.3951 },
  { name: 'Stavanger', lat: 58.97, lng: 5.7331 },
  { name: 'Kristiansand', lat: 58.1467, lng: 7.9956 },
  { name: 'Fredrikstad', lat: 59.2181, lng: 10.9298 },
  { name: 'Tromsø', lat: 69.6492, lng: 18.9553 },
  { name: 'Drammen', lat: 59.7434, lng: 10.2045 },
  { name: 'Asker', lat: 59.8327, lng: 10.4345 },
  { name: 'Lillehammer', lat: 61.1153, lng: 10.4662 },
];

export const searchNorwegianPlaces = async (input: string): Promise<PlaceSuggestion[]> => {
  if (!input || input.length < 2) {
    return [];
  }

  // If no API key, use offline fallback immediately
  if (!GOOGLE_PLACES_API_KEY) {
    return norwegianCities
      .filter(city => city.name.toLowerCase().includes(input.toLowerCase()))
      .map(city => ({
        place_id: `offline_${city.name}`,
        description: `${city.name}, Norge`,
        structured_formatting: {
          main_text: city.name,
          secondary_text: 'Norge',
        },
        geometry: {
          location: {
            lat: city.lat,
            lng: city.lng,
          },
        },
      }));
  }

  try {
    const response = await fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(input)}&` +
        `components=country:no&` +
        `language=no&` +
        `key=${GOOGLE_PLACES_API_KEY}`,
      { method: 'GET' },
      10000 // 10 second timeout for autocomplete API
    );

    const data = (await response.json()) as PlacesAutocompleteResponse;

    if (data.status === 'OK') {
      return data.predictions.map(prediction => ({
        place_id: prediction.place_id,
        description: prediction.description,
        structured_formatting: prediction.structured_formatting,
      }));
    } else {
      // Fallback to offline Norwegian cities
      return norwegianCities
        .filter(city => city.name.toLowerCase().includes(input.toLowerCase()))
        .map(city => ({
          place_id: `offline_${city.name}`,
          description: `${city.name}, Norge`,
          structured_formatting: {
            main_text: city.name,
            secondary_text: 'Norge',
          },
          geometry: {
            location: {
              lat: city.lat,
              lng: city.lng,
            },
          },
        }));
    }
  } catch (error) {
    console.error('Places API error:', error);
    // Return offline fallback
    return norwegianCities
      .filter(city => city.name.toLowerCase().includes(input.toLowerCase()))
      .map(city => ({
        place_id: `offline_${city.name}`,
        description: `${city.name}, Norge`,
        structured_formatting: {
          main_text: city.name,
          secondary_text: 'Norge',
        },
        geometry: {
          location: {
            lat: city.lat,
            lng: city.lng,
          },
        },
      }));
  }
};

export const getPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
  // Handle offline cities
  if (placeId.startsWith('offline_')) {
    const cityName = placeId.replace('offline_', '');
    const city = norwegianCities.find(c => c.name === cityName);
    if (city) {
      return {
        place_id: placeId,
        formatted_address: `${city.name}, Norge`,
        geometry: {
          location: {
            lat: city.lat,
            lng: city.lng,
          },
        },
        address_components: [
          {
            long_name: city.name,
            short_name: city.name,
            types: ['locality', 'political'],
          },
          {
            long_name: 'Norge',
            short_name: 'NO',
            types: ['country', 'political'],
          },
        ],
      };
    }
  }

  try {
    const response = await fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}&` +
        `fields=place_id,formatted_address,geometry,address_components&` +
        `language=no&` +
        `key=${GOOGLE_PLACES_API_KEY}`,
      { method: 'GET' },
      10000 // 10 second timeout for place details API
    );

    const data = await response.json();

    if (data.status === 'OK') {
      return data.result;
    }
  } catch (error) {
    console.error('Place details error:', error);
  }

  return null;
};

export const calculateDistance = async (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<DistanceMatrixResult | null> => {
  try {
    const response = await fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/distancematrix/json?` +
        `origins=${origin.lat},${origin.lng}&` +
        `destinations=${destination.lat},${destination.lng}&` +
        `units=metric&` +
        `language=no&` +
        `key=${GOOGLE_PLACES_API_KEY}`,
      { method: 'GET' },
      10000 // 10 second timeout for distance matrix API
    );

    const data = await response.json();

    if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
      return data.rows[0].elements[0];
    }
  } catch (error) {
    console.error('Distance calculation error:', error);
  }

  return null;
};

export const formatNorwegianAddress = (address: string): string => {
  // Format address according to Norwegian postal standards
  return address
    .replace(/,\s*Norway\s*$/i, ', Norge')
    .replace(/,\s*NO\s*$/i, ', Norge')
    .trim();
};
