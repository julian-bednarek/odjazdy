export const Keys = {
  config: (device: string) => `cfg:${device}`,
  lastProfile: (device: string) => `last:${device}`,
  fallbackRows: (device: string, profile: string) => `rows/${device}/${profile}`,
  pairing: (code: string) => `pair:${code}`,
  session: (token: string) => `sess:${token}`,
};
