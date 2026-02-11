import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { findNearbyCargoRequests } from '../utils/geoSearch';

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/**
 * Hook for finding nearby cargo requests with proper permission handling
 * 
 * Features:
 * - User-friendly permission flow with explanations
 * - Handles permission denial gracefully
 * - Provides option to open Settings if denied
 * - Loads nearby cargo requests automatically
 * - Proper error handling and loading states
 * 
 * @param radiusKm - Search radius in kilometers (default: 50)
 * @param searchType - Search by 'from' (pickup) or 'to' (delivery) location
 * @returns Hook state with requests, loading, location, and permission status
 * 
 * @example
 * const { requests, loading, userLocation, permissionDenied, retry } = useNearbyRequests(50);
 * 
 * if (permissionDenied) {
 *   return <PermissionDeniedView onRetry={retry} />;
 * }
 * 
 * if (loading) {
 *   return <LoadingView />;
 * }
 * 
 * return <RequestsList requests={requests} userLocation={userLocation} />;
 */
export function useNearbyRequests(
  radiusKm: number = 50,
  searchType: 'from' | 'to' = 'from'
) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Request location permission with user-friendly explanation
   */
  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      // 1. Check existing permission status
      const { status: existingStatus, canAskAgain } = await Location.getForegroundPermissionsAsync();
      
      console.log('📍 Current location permission:', existingStatus);
      
      // If already granted, proceed
      if (existingStatus === Location.PermissionStatus.GRANTED) {
        setPermissionStatus({
          granted: true,
          canAskAgain,
          status: existingStatus,
        });
        return true;
      }
      
      // If permission was denied and we can't ask again, show settings option
      if (!canAskAgain) {
        console.log('⚠️  Cannot ask for permission again, showing settings option');
        setPermissionDenied(true);
        setPermissionStatus({
          granted: false,
          canAskAgain: false,
          status: existingStatus,
        });
        
        showSettingsAlert();
        return false;
      }
      
      // 2. Show explanation before requesting permission
      return new Promise((resolve) => {
        Alert.alert(
          t('locationRequired'),
          t('locationPermissionMessage'),
          [
            {
              text: t('cancel'),
              style: 'cancel',
              onPress: () => {
                console.log('❌ User cancelled permission request');
                setPermissionDenied(true);
                setPermissionStatus({
                  granted: false,
                  canAskAgain: true,
                  status: existingStatus,
                });
                setLoading(false);
                resolve(false);
              },
            },
            {
              text: t('allowLocation'),
              onPress: async () => {
                // 3. Request permission
                const { status, canAskAgain: canAskAgainAfter } = await Location.requestForegroundPermissionsAsync();
                
                console.log('📍 Permission response:', status);
                
                const granted = status === Location.PermissionStatus.GRANTED;
                
                setPermissionStatus({
                  granted,
                  canAskAgain: canAskAgainAfter,
                  status,
                });
                
                if (!granted) {
                  setPermissionDenied(true);
                  setLoading(false);
                  
                  // If user denied, show settings option
                  if (!canAskAgainAfter) {
                    showSettingsAlert();
                  }
                }
                
                resolve(granted);
              },
            },
          ],
          { cancelable: false }
        );
      });
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setError('Failed to request location permission');
      setLoading(false);
      return false;
    }
  };

  /**
   * Show alert with option to open Settings
   */
  const showSettingsAlert = () => {
    Alert.alert(
      t('permissionRequired'),
      t('enableLocationInSettings'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('openSettings'),
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  };

  /**
   * Get user's current location
   */
  const getUserLocation = async (): Promise<UserLocation | null> => {
    try {
      console.log('📍 Getting current location...');
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000, // Cache for 10 seconds
        distanceInterval: 100, // Update every 100 meters
      });
      
      const userLoc: UserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
      
      console.log('✅ Location obtained:', userLoc.latitude, userLoc.longitude);
      setUserLocation(userLoc);
      
      return userLoc;
    } catch (error: any) {
      console.error('Error getting location:', error);
      setError(error.message || 'Failed to get location');
      return null;
    }
  };

  /**
   * Fetch nearby cargo requests
   */
  const fetchNearbyRequests = async (location: UserLocation) => {
    try {
      console.log(`🔍 Searching for cargo within ${radiusKm}km...`);
      
      const nearby = await findNearbyCargoRequests(
        location.latitude,
        location.longitude,
        radiusKm,
        searchType
      );
      
      console.log(`✅ Found ${nearby.length} nearby cargo requests`);
      setRequests(nearby);
    } catch (error: any) {
      console.error('Error fetching nearby requests:', error);
      setError(error.message || 'Failed to fetch nearby requests');
    }
  };

  /**
   * Main initialization flow
   */
  const initialize = async () => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);
    
    try {
      // 1. Request location permission
      const hasPermission = await requestLocationPermission();
      
      if (!hasPermission) {
        setLoading(false);
        return;
      }
      
      // 2. Get user location
      const location = await getUserLocation();
      
      if (!location) {
        setError('Could not determine your location');
        setLoading(false);
        return;
      }
      
      // 3. Fetch nearby requests
      await fetchNearbyRequests(location);
    } catch (error: any) {
      console.error('Initialization error:', error);
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retry permission request and initialization
   */
  const retry = () => {
    initialize();
  };

  /**
   * Refresh nearby requests using current location
   */
  const refresh = async () => {
    if (!userLocation) {
      await initialize();
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await fetchNearbyRequests(userLocation);
    } catch (error: any) {
      console.error('Refresh error:', error);
      setError(error.message || 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  // Initialize on mount
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, searchType]);

  return {
    /**
     * Array of nearby cargo requests with distance information
     */
    requests,
    
    /**
     * Loading state
     */
    loading,
    
    /**
     * User's current location
     */
    userLocation,
    
    /**
     * Whether location permission was denied
     */
    permissionDenied,
    
    /**
     * Detailed permission status
     */
    permissionStatus,
    
    /**
     * Error message if any
     */
    error,
    
    /**
     * Retry permission request and load data
     */
    retry,
    
    /**
     * Refresh nearby requests using current location
     */
    refresh,
  };
}
