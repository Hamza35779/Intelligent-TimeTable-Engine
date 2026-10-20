import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.timetable.intelligentengine',
  appName: 'Intelligent Timetable',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
