const appJson = require('./app.json')

module.exports = ({ config }) => {
  const fallback = config || appJson.expo

  return {
    ...fallback,
    extra: {
      ...(fallback.extra || {}),
      googleOAuth: {
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || null,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || null,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || null,
      },
    },
  }
}
