import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home tab immediately
    router.replace('/home');
  }, [router]);

  return null;
}