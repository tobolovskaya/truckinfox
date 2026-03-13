/**
 * Expo config plugin — adds PrivacyInfo.xcprivacy to the iOS app target.
 *
 * Apple requires every app binary to ship a PrivacyInfo.xcprivacy that lists
 * every "Required Reason API" the app uses. Without it, App Store Connect
 * will reject the build starting with iOS 17 / Xcode 15.
 *
 * The declarations here match the APIs used by React Native core, AsyncStorage,
 * expo-file-system, expo-localization and expo-constants.
 */

const { withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>35F9.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>85F4.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
</dict>
</plist>
`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withPrivacyManifest = (config) => {
  return withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const projectName = config.modRequest.projectName;
    const iosDir = path.join(projectRoot, 'ios', projectName);
    const destPath = path.join(iosDir, 'PrivacyInfo.xcprivacy');

    // Write the file (idempotent)
    if (!fs.existsSync(iosDir)) {
      fs.mkdirSync(iosDir, { recursive: true });
    }
    fs.writeFileSync(destPath, PRIVACY_MANIFEST, 'utf8');

    // Add to the Xcode project so Xcode includes it in the app bundle
    const xcodeProject = config.modResults;
    const target = xcodeProject.getFirstTarget();

    // Avoid duplicate entries on repeated prebuild runs
    const existing = xcodeProject.pbxFileReferenceSection();
    const alreadyAdded = Object.values(existing).some(
      (ref) => ref && ref.path === '"PrivacyInfo.xcprivacy"'
    );

    if (!alreadyAdded) {
      xcodeProject.addResourceFile(
        'PrivacyInfo.xcprivacy',
        { target: target.uuid },
        projectName
      );
    }

    return config;
  });
};

module.exports = withPrivacyManifest;
