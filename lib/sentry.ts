import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: __DEV__ ? 'development' : 'production',
  enabled: Boolean(dsn),
  debug: __DEV__,
});

export { Sentry };
