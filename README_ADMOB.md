# AdMob Integration Guide

## Setup Instructions

Your Course Tracker app now has AdMob integration configured. To deploy on mobile devices:

### 1. Initialize Capacitor
```bash
npm install
npx cap init
```

### 2. Add Mobile Platforms
```bash
npx cap add ios
npx cap add android
```

### 3. Build Your App
```bash
npm run build
npx cap sync
```

### 4. Configure AdMob App IDs

#### For Production:
Replace the test ad unit IDs in the following files with your real AdMob ad unit IDs:

**In `src/components/AdBanner.tsx`:**
- Replace `ca-app-pub-3940256099942544/6300978111` with your real banner ad unit ID

**In `src/components/AdInterstitial.tsx`:**
- Replace `ca-app-pub-3940256099942544/1033173712` with your real interstitial ad unit ID
- Replace `ca-app-pub-3940256099942544/5224354917` with your real reward ad unit ID

**In `capacitor.config.ts`:**
- The app ID `ca-app-pub-1034414616463908~4487483497` is already configured
- Set `isTesting: false` in AdBanner.tsx and AdInterstitial.tsx for production

#### For iOS (ios/App/App/Info.plist):
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-1034414616463908~4487483497</string>
<key>SKAdNetworkItems</key>
<array>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>cstr6suwn9.skadnetwork</string>
  </dict>
</array>
```

#### For Android:

**1. Update settings.gradle (android/settings.gradle):**
```gradle
pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = "coursetracker"
include(":app")
```

**2. Add dependency to build.gradle (android/app/build.gradle):**
```gradle
dependencies {
  implementation("com.google.android.gms:play-services-ads:24.7.0")
}
```

**3. Update AndroidManifest.xml (android/app/src/main/AndroidManifest.xml):**
Add this inside the `<application>` tag:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-1034414616463908~4487483497"/>
```

**4. (Optional) For Android 13 compatibility, add AD_ID permission in AndroidManifest.xml:**
```xml
<uses-permission android:name="com.google.android.gms.permission.AD_ID"/>
```

### 5. Run on Device/Emulator
```bash
# For iOS (requires Mac with Xcode)
npx cap run ios

# For Android
npx cap run android
```

## Ad Types Implemented

### Banner Ads
- Automatically displayed at the bottom of the screen
- Component: `AdBanner`
- Used in: Course Tracker page

### Interstitial Ads
- Full-screen ads that can be shown at transition points
- Usage: `AdInterstitialManager.showInterstitial()`

### Reward Video Ads
- Users watch video and get rewards
- Usage: `AdInterstitialManager.showRewardVideo((reward) => { /* handle reward */ })`

## Testing
The app is currently configured with test ads (`isTesting: true`). You'll see Google's test ads when running on a device. Change to `isTesting: false` and use real ad unit IDs for production.

## Important Notes
1. AdMob only works on real devices or emulators, not in web browser
2. Test ads will show while `isTesting: true`
3. Always test with real ads before publishing to app stores
4. Follow AdMob policies to avoid account suspension
5. Banner ads are automatically shown on app launch

## Resources
- [Capacitor AdMob Plugin Documentation](https://github.com/capacitor-community/admob)
- [Google AdMob Console](https://apps.admob.com/)
- [AdMob Policy Guidelines](https://support.google.com/admob/answer/6128543)
