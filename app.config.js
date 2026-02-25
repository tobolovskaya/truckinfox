const appJson = require('./app.json')

module.exports = ({ config }) => {
  const fallback = config || appJson.expo

  return {
    ...fallback,
    extra: {
      ...(fallback.extra || {}),
      googleOAuth: {
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || null,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || null,
      },
    },
  }
}
