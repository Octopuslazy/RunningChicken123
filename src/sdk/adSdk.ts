// Lightweight ad SDK stub for playable reporting and click-through.
export default {
  init(options: any = {}) {
    console.log('[adSdk] init', options);
    this.options = options;
  },
  report(event: string, data: any = {}) {
    // For real SDKs, replace this with network call or SDK API
    console.log('[adSdk] report', event, data);
  },
  clickthrough(url?: string) {
    console.log('[adSdk] clickthrough', url);
    try {
      // MRAID support (in-app webviews)
      if ((window as any).mraid && (window as any).mraid.open) {
        (window as any).mraid.open(url || this.options?.clickUrl || 'about:blank');
        return;
      }
    } catch (e) {
      // fallthrough
    }
    window.open(url || this.options?.clickUrl || 'about:blank', '_blank');
  },
  rewardClaim(data: any = {}) {
    console.log('[adSdk] rewardClaim', data);
  }
};
