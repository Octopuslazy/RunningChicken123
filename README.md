# PixiJS Playable Game Template

🎮 **Template chuyên nghiệp để tạo Playable Ads với PixiJS, build được cho 7+ ad networks**

## ⚡ Quick Start

### 1. Sao chép template
```bash
git clone [this-repo] my-awesome-game
cd my-awesome-game
npm install
```

### 2. Setup dự án
```bash
node setup-template.js
```

### 3. Phát triển
```bash
npm run dev        # Development mode
npm run build:all  # Build for all platforms
```

## 🚀 Tính Năng

### ✅ Multi-Platform Build
- **AppLovin** - Tối ưu cho AppLovin network
- **Facebook** - Meta Audience Network
- **Mintegral** - MDSP platform
- **Unity Ads** - Unity monetization
- **IronSource** - ironSource mediation
- **Google** - Google Ad Manager
- **TikTok** - TikTok for Business

### ✅ Asset Management
- **Linh hoạt**: Cấu hình assets theo project
- **Spine Support**: Tích hợp @esotericsoftware/spine-pixi
- **Smart Loading**: Auto-detect và load assets
- **Multiple Formats**: PNG, JPG, WebP, MP3, OGG, WAV

### ✅ Playable Ad Features  
- **MRAID Integration**: Standard MRAID 3.0
- **Store Links**: Auto-handle App Store/Google Play
- **Size Optimized**: Single-file output <5MB
- **Ad Network Hooks**: Lifecycle callbacks

### ✅ Development Experience
- **TypeScript**: Type-safe development
- **Hot Reload**: Fast development iteration
- **Modern Build**: Webpack 5 + optimizations
- **Error Handling**: Comprehensive error management

## 📁 Cấu Trúc Project

```
my-game/
├── src/
│   ├── main.ts                    # Game logic chính
│   ├── assetLoader.ts             # Asset management system
│   ├── assetLoader.config.ts      # Project-specific config
│   ├── index.html                 # HTML template
│   └── index.ts                   # Entry point
├── Assets/                        # Game assets
│   ├── Images/                    # UI images, backgrounds
│   ├── Sounds/                    # Audio files
│   └── Characters/                # Spine animations (optional)
├── scripts/
│   └── generate-build-vars.js     # Build configuration
├── setup-template.js              # Initial project setup
└── dist/                          # Build output
```

## 🎯 Hướng Dẫn Sử Dụng

### Asset Configuration
```typescript
// src/assetLoader.config.ts
import { configureAssetLoader } from './assetLoader';

export const projectConfig = {
    spine: {
        enabled: true,
        baseName: 'hero',
        basePath: '../Assets/Characters'
    },
    folders: {
        arts: '../Assets/Images',
        sounds: '../Assets/Sounds'
    }
};

configureAssetLoader(projectConfig);
```

### Game Implementation
```typescript
// src/main.ts
import { Application, Sprite } from 'pixi.js';
import { loadGameAssets, arts, sounds } from './assetLoader';

class Game {
    private app: Application;

    async init() {
        await this.app.init({ width: 720, height: 1280 });
        
        // Load assets
        await loadGameAssets();
        
        // Use assets
        const bg = Sprite.from('background.png');
        this.app.stage.addChild(bg);
        
        this.signalGameReady();
    }
}
```

---

**Bắt đầu ngay:** `node setup-template.js` 🚀
