import { AdMob, AdMobRewardItem, AdOptions, RewardAdOptions } from '@capacitor-community/admob';

export class AdInterstitialManager {
  private static interstitialAdId = 'ca-app-pub-3940256099942544/1033173712'; // Test ad unit
  private static rewardAdId = 'ca-app-pub-3940256099942544/5224354917'; // Test reward ad unit

  static async prepareInterstitial() {
    try {
      const options: AdOptions = {
        adId: this.interstitialAdId,
        isTesting: true, // Set to false in production
      };
      await AdMob.prepareInterstitial(options);
    } catch (error) {
      console.error('Error preparing interstitial:', error);
    }
  }

  static async showInterstitial() {
    try {
      await this.prepareInterstitial();
      await AdMob.showInterstitial();
    } catch (error) {
      console.error('Error showing interstitial:', error);
    }
  }

  static async prepareRewardVideo() {
    try {
      const options: RewardAdOptions = {
        adId: this.rewardAdId,
        isTesting: true, // Set to false in production
      };
      await AdMob.prepareRewardVideoAd(options);
    } catch (error) {
      console.error('Error preparing reward video:', error);
    }
  }

  static async showRewardVideo(onRewarded?: (reward: AdMobRewardItem) => void) {
    try {
      await this.prepareRewardVideo();
      await AdMob.showRewardVideoAd();
      
      // Note: Implement reward handling in your app's logic
      if (onRewarded) {
        onRewarded({ type: 'reward', amount: 1 });
      }
    } catch (error) {
      console.error('Error showing reward video:', error);
    }
  }
}
