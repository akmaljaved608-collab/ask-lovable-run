import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.312e0fdff60e44b887ddac4e12fc3099',
  appName: 'coursetracker',
  webDir: 'dist',
  server: {
    url: 'https://312e0fdf-f60e-44b8-87dd-ac4e12fc3099.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-1034414616463908~4487483497',
      testingDevices: ['YOUR_DEVICE_ID_HERE']
    }
  }
};

export default config;
