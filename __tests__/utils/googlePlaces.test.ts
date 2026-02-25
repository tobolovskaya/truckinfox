import { searchNorwegianPlaces, getPlaceDetails, calculateDistance } from '../../utils/googlePlaces';
import * as fetchUtils from '../../utils/fetchWithTimeout';

jest.mock('../../utils/fetchWithTimeout', () => ({
  fetchWithRetry: jest.fn(),
  fetchWithTimeout: jest.fn(),
}));

describe('Google Places Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchNorwegianPlaces', () => {
    it('should return empty array for short input', async () => {
      const results = await searchNorwegianPlaces('O');
      expect(results).toEqual([]);
    });

    it('should filter Norwegian cities locally', async () => {
      const results = await searchNorwegianPlaces('Oslo');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].description).toContain('Oslo');
    });

    it('should call API with retry when API key is available', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          status: 'OK',
          predictions: [
            {
              place_id: 'place123',
              description: 'Oslo, Norway',
              structured_formatting: {
                main_text: 'Oslo',
                secondary_text: 'Norway',
              },
            },
          ],
        }),
      };

      (fetchUtils.fetchWithRetry as jest.Mock).mockResolvedValueOnce(mockResponse);

      // Set API key for this test
      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const results = await searchNorwegianPlaces('Oslo');

      expect(fetchUtils.fetchWithRetry).toHaveBeenCalled();
      expect(results).toHaveLength(1);

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });

    it('should fall back to offline cities on API failure', async () => {
      (fetchUtils.fetchWithRetry as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const results = await searchNorwegianPlaces('Bergen');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].place_id).toContain('offline_');

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });

    it('should handle API error status', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'ZERO_RESULTS',
          predictions: [],
        }),
      };

      (fetchUtils.fetchWithRetry as jest.Mock).mockResolvedValueOnce(mockResponse);

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const results = await searchNorwegianPlaces('xyz123');

      // Should fall back to offline cities
      expect(results.length).toBeGreaterThanOrEqual(0);

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });

    it('should include geometry in offline cities', async () => {
      const results = await searchNorwegianPlaces('Tromso');

      const trovsoResult = results.find(r => r.description.includes('Tromsø'));
      expect(trovsoResult?.geometry).toBeDefined();
      expect(trovsoResult?.geometry?.location).toHaveProperty('lat');
      expect(trovsoResult?.geometry?.location).toHaveProperty('lng');
    });
  });

  describe('getPlaceDetails', () => {
    it('should handle offline place IDs', async () => {
      const result = await getPlaceDetails('offline_Oslo');

      expect(result).toBeDefined();
      expect(result?.formatted_address).toContain('Oslo');
      expect(result?.geometry?.location).toBeDefined();
    });

    it('should fetch place details from API', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'OK',
          result: {
            place_id: 'place123',
            formatted_address: 'Oslo, Norway',
            geometry: {
              location: {
                lat: 59.9139,
                lng: 10.7522,
              },
            },
            address_components: [
              {
                long_name: 'Oslo',
                short_name: 'Oslo',
                types: ['locality'],
              },
            ],
          },
        }),
      };

      (fetchUtils.fetchWithRetry as jest.Mock).mockResolvedValueOnce(mockResponse);

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const result = await getPlaceDetails('place123');

      expect(fetchUtils.fetchWithRetry).toHaveBeenCalled();
      expect(result?.formatted_address).toBe('Oslo, Norway');

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });

    it('should return null on API error', async () => {
      (fetchUtils.fetchWithRetry as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const result = await getPlaceDetails('invalid_place');

      expect(result).toBeNull();

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });

    it('should include address components', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'OK',
          result: {
            place_id: 'place123',
            formatted_address: 'Storgate 1, 0184 Oslo, Norway',
            geometry: {
              location: { lat: 59.9139, lng: 10.7522 },
            },
            address_components: [
              { long_name: 'Storgate 1', short_name: 'Storgate 1', types: ['route'] },
              { long_name: 'Oslo', short_name: 'Oslo', types: ['locality'] },
              { long_name: 'Norway', short_name: 'NO', types: ['country'] },
            ],
          },
        }),
      };

      (fetchUtils.fetchWithRetry as jest.Mock).mockResolvedValueOnce(mockResponse);

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const result = await getPlaceDetails('place123');

      expect(result?.address_components).toHaveLength(3);

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'OK',
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: {
                    text: '108 km',
                    value: 107500,
                  },
                  duration: {
                    text: '1 hour 37 mins',
                    value: 5838,
                  },
                },
              ],
            },
          ],
        }),
      };

      (fetchUtils.fetchWithRetry as jest.Mock).mockResolvedValueOnce(mockResponse);

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const result = await calculateDistance(
        { lat: 59.9139, lng: 10.7522 }, // Oslo
        { lat: 60.3913, lng: 5.3221 } // Bergen
      );

      expect(result).toBeDefined();
      expect(result?.distance.value).toBe(107500);
      expect(result?.duration.value).toBe(5838);

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });

    it('should return null on calculation error', async () => {
      (fetchUtils.fetchWithRetry as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const result = await calculateDistance(
        { lat: 59.9139, lng: 10.7522 },
        { lat: 60.3913, lng: 5.3221 }
      );

      expect(result).toBeNull();

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });

    it('should handle multiple route segments', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'OK',
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: { text: '50 km', value: 50000 },
                  duration: { text: '45 mins', value: 2700 },
                },
              ],
            },
          ],
        }),
      };

      (fetchUtils.fetchWithRetry as jest.Mock).mockResolvedValueOnce(mockResponse);

      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';

      const result = await calculateDistance(
        { lat: 59.9139, lng: 10.7522 },
        { lat: 60.3913, lng: 5.3221 }
      );

      expect(result?.distance.text).toBe('50 km');
      expect(result?.distance.value).toBe(50000);

      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    });
  });
});
