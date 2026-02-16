import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function TabsIndexScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home tab immediately
    router.replace('/(tabs)/home');
  }, [router]);

  return null;
}
