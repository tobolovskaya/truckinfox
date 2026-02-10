import * as Location from 'expo-location';

export async function requestLocationAccess() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function getCurrentLocation() {
  return Location.getCurrentPositionAsync({});
}
