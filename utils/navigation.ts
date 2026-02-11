import { Router } from 'expo-router';

interface NavigationOptions {
  timeout?: number;
  maxRetries?: number;
  fallbackRoute?: string;
}

/**
 * Safe navigation wrapper for Expo Router
 * Handles navigation errors and provides fallback mechanisms
 */
export class SafeNavigation {
  static async navigate(
    router: Router,
    route: string,
    method: 'push' | 'replace' = 'push',
    options: NavigationOptions = {}
  ): Promise<void> {
    const { timeout = 100, maxRetries = 3, fallbackRoute } = options;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (method === 'push') {
          router.push(route as any);
        } else {
          router.replace(route as any);
        }
        return; // Success
      } catch (error) {
        console.warn(`Navigation attempt ${attempt + 1} failed:`, error);

        if (attempt < maxRetries - 1) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, timeout * (attempt + 1)));
        } else if (fallbackRoute && fallbackRoute !== route) {
          // Try fallback route as last resort
          try {
            if (method === 'push') {
              router.push(fallbackRoute as any);
            } else {
              router.replace(fallbackRoute as any);
            }
          } catch (fallbackError) {
            console.error('Fallback navigation also failed:', fallbackError);
            throw new Error(`Navigation failed after ${maxRetries} attempts`);
          }
        } else {
          throw new Error(`Navigation failed after ${maxRetries} attempts`);
        }
      }
    }
  }

  /**
   * Safe push navigation
   */
  static async push(
    router: Router,
    route: string,
    options?: NavigationOptions
  ): Promise<void> {
    return this.navigate(router, route, 'push', options);
  }

  /**
   * Safe replace navigation
   */
  static async replace(
    router: Router,
    route: string,
    options?: NavigationOptions
  ): Promise<void> {
    return this.navigate(router, route, 'replace', options);
  }

  /**
   * Navigate back with error handling
   */
  static back(router: Router): void {
    try {
      router.back();
    } catch (error) {
      console.warn('Back navigation failed:', error);
      // Try to navigate to home as fallback
      this.push(router, '/(tabs)/home').catch(console.error);
    }
  }
}

/**
 * Hook-friendly navigation helpers
 */
export const useNavigationHelpers = (router: Router) => {
  const safePush = (route: string, options?: NavigationOptions) =>
    SafeNavigation.push(router, route, options);

  const safeReplace = (route: string, options?: NavigationOptions) =>
    SafeNavigation.replace(router, route, options);

  const safeBack = () => SafeNavigation.back(router);

  return { safePush, safeReplace, safeBack };
};