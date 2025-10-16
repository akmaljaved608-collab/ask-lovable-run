import { useEffect, useState } from 'react';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

interface AdBannerProps {
  adUnitId?: string;
  position?: BannerAdPosition;
}

export const AdBanner = ({ 
  adUnitId = 'ca-app-pub-3940256099942544/6300978111', // Default test ad unit
  position = BannerAdPosition.BOTTOM_CENTER 
}: AdBannerProps) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeAdMob();
  }, []);

  const initializeAdMob = async () => {
    try {
      await AdMob.initialize({
        testingDevices: ['YOUR_DEVICE_ID_HERE'],
      });
      setIsInitialized(true);
      showBanner();
    } catch (error) {
      console.error('AdMob initialization error:', error);
    }
  };

  const showBanner = async () => {
    try {
      const options: BannerAdOptions = {
        adId: adUnitId,
        adSize: BannerAdSize.BANNER,
        position: position,
        isTesting: true, // Set to false in production
      };

      await AdMob.showBanner(options);
    } catch (error) {
      console.error('Error showing banner ad:', error);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup banner ad on unmount
      AdMob.removeBanner().catch(console.error);
    };
  }, []);

  return null; // Banner is displayed natively, no React component needed
};
