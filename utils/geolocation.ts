/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate estimated delivery time based on distance
 * Assumes average speed of 70 km/h
 * Returns estimated hours
 */
export const calculateEstimatedTime = (distanceInKm: number): number => {
  const averageSpeed = 70; // km/h
  return Math.round((distanceInKm / averageSpeed) * 10) / 10;
};

/**
 * Get region for map based on coordinates and distance
 */
export const getMapRegion = (latitude: number, longitude: number, distanceInKm: number = 10) => {
  // Approximate delta for map region
  const latitudeDelta = distanceInKm / 111; // 1 degree latitude â‰ˆ 111 km
  const longitudeDelta = distanceInKm / (111 * Math.cos(latitude * (Math.PI / 180)));

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
};

export default {
  calculateDistance,
  calculateEstimatedTime,
  getMapRegion,
};
