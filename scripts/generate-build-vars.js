const fs = require('fs');
const path = require('path');

const outPath = path.resolve(__dirname, '..', 'src', 'build-vars.js');

const AD_NETWORK = process.env.AD_NETWORK || 'applovin';
const AD_PROTOCOL = process.env.AD_PROTOCOL || 'mraid';
const GOOGLE_PLAY_URL = process.env.GOOGLE_PLAY_URL || 'https://play.google.com/store/apps/details?id=com.ggds.ski.resort.empire.idle.tycoon.game&pcampaignid=web_share';
const APP_STORE_URL = process.env.APP_STORE_URL || 'https://apps.apple.com/vn/app/tam-qu%E1%BB%91c-kh%E1%BB%9Fi-%C4%91%E1%BB%99ng/id6742780202?l=vi';
const BUILD_HASH = process.env.BUILD_HASH || 'local-build';
const SUPPORTED_AD_NETWORKS = (process.env.SUPPORTED_AD_NETWORKS && process.env.SUPPORTED_AD_NETWORKS.split(',')) || ['applovin','mintegral','unity','facebook','ironsource','google','tiktok'];

const content = `(function(){\n  try {\n    window.AD_NETWORK = window.AD_NETWORK || ${JSON.stringify(AD_NETWORK)};\n    window.AD_PROTOCOL = window.AD_PROTOCOL || ${JSON.stringify(AD_PROTOCOL)};\n    window.GOOGLE_PLAY_URL = window.GOOGLE_PLAY_URL || ${JSON.stringify(GOOGLE_PLAY_URL)};\n    window.APP_STORE_URL = window.APP_STORE_URL || ${JSON.stringify(APP_STORE_URL)};\n    window.BUILD_HASH = window.BUILD_HASH || ${JSON.stringify(BUILD_HASH)};\n    window.SUPPORTED_AD_NETWORKS = window.SUPPORTED_AD_NETWORKS || ${JSON.stringify(SUPPORTED_AD_NETWORKS)};\n  } catch(e) {}\n})();\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote build-vars to', outPath);
