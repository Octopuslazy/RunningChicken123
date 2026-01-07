# Hướng Dẫn Sử Dụng Asset Loader

## Giới thiệu

Asset Loader này được thiết kế để có thể tái sử dụng cho nhiều dự án khác nhau. Bạn chỉ cần copy file `assetLoader.ts` và cấu hình theo dự án của mình.

## Cách sử dụng

### 1. Copy file vào dự án

```bash
# Copy assetLoader.ts vào thư mục src/ của dự án mới
cp src/assetLoader.ts /path/to/new/project/src/
```

### 2. Cấu hình cho dự án

Có 2 cách để cấu hình:

#### Cách 1: Sử dụng file cấu hình riêng

Tạo file `assetLoader.config.ts` trong thư mục src:

```typescript
import { AssetLoaderConfig } from './assetLoader';

export const assetConfig: AssetLoaderConfig = {
    spine: {
        enabled: true,
        baseName: 'hero_character', // Tên file spine của bạn
        basePath: '../Assets/Spine',
        textureAlias: 'hero_texture'
    },
    folders: {
        arts: '../Assets/Images',
        sounds: '../Assets/Audio'
    },
    fileExtensions: {
        images: ['.png', '.jpg', '.webp'],
        sounds: ['.mp3', '.ogg']
    }
};
```

#### Cách 2: Cấu hình trực tiếp trong code

```typescript
import { configureAssetLoader, loadGameAssets } from './assetLoader';

// Cấu hình trước khi load assets
configureAssetLoader({
    spine: {
        enabled: false // Tắt spine nếu không dùng
    },
    folders: {
        arts: '../MyAssets/Images',
        sounds: '../MyAssets/Sounds'
    }
});

// Load assets
await loadGameAssets();
```

### 3. Ví dụ cấu hình cho các loại dự án

#### Game 2D đơn giản (không dùng Spine)

```typescript
configureAssetLoader({
    spine: { enabled: false },
    folders: {
        arts: '../assets/images',
        sounds: '../assets/sounds'
    },
    fileExtensions: {
        images: ['.png', '.jpg'],
        sounds: ['.mp3', '.wav']
    }
});
```

#### Game với nhân vật Spine

```typescript
configureAssetLoader({
    spine: {
        enabled: true,
        baseName: 'player',
        basePath: '../assets/spine',
        textureAlias: 'player_tex'
    },
    folders: {
        arts: '../assets/ui',
        sounds: '../assets/audio'
    }
});
```

#### Ứng dụng web (chỉ hình ảnh)

```typescript
configureAssetLoader({
    spine: { enabled: false },
    folders: {
        arts: '../public/images',
        sounds: '../public/audio'
    },
    fileExtensions: {
        images: ['.png', '.jpg', '.svg', '.webp'],
        sounds: ['.mp3']
    }
});
```

## Cách sử dụng assets sau khi load

### Load tất cả assets

```typescript
import { loadGameAssets } from './assetLoader';

const assets = await loadGameAssets();
console.log('Loaded images:', Object.keys(assets.images));
console.log('Loaded sounds:', Object.keys(assets.sounds));
```

### Sử dụng assets

```typescript
import { loadTexture, arts, sounds } from './assetLoader';

// Cách 1: Sử dụng proxy objects
const bgTexture = arts['background.png'];
const clickSound = sounds['click.mp3'];

// Cách 2: Load theo đường dẫn
const logoTexture = await loadTexture('logo.png');
const menuTexture = await loadTexture('../Assets/_arts/menu_bg.jpg');
```

### Sử dụng Spine (nếu enabled)

```typescript
import { loadSpineAssets, registerSpineForSpineFrom } from './assetLoader';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

// Load spine assets
const spineAssets = await loadSpineAssets();

// Đăng ký để dùng với Spine.from()
await registerSpineForSpineFrom();
const spine = Spine.from('spineAtlas', 'spineSkeleton');

// Hoặc dùng trực tiếp
if (spineAssets.texture && spineAssets.jsonData) {
    // Tạo spine object thủ công...
}
```

## Cấu trúc thư mục khuyên dùng

```
your-project/
├── src/
│   ├── assetLoader.ts          // File copy từ dự án này
│   ├── assetLoader.config.ts   // Cấu hình riêng (optional)
│   └── index.ts
└── Assets/                     // Hoặc assets/, public/, static/
    ├── Images/                 // Hình ảnh UI, background
    ├── Audio/                  // File âm thanh
    └── Spine/                  // File Spine (nếu dùng)
        ├── character.png
        ├── character.atlas
        └── character.json
```

## Lưu ý quan trọng

1. **Webpack Context**: Asset loader dùng `require.context()` nên cần webpack để hoạt động
2. **Đường dẫn tương đối**: Đường dẫn trong cấu hình phải tương đối so với file build
3. **File extension**: Đảm bảo list extension chứa đủ loại file bạn dùng
4. **Spine assets**: 3 file (png, atlas, json) phải cùng tên base và trong cùng thư mục
5. **Performance**: Assets được cache sau lần load đầu tiên

## Troubleshooting

### Lỗi "Cannot resolve module"
- Kiểm tra đường dẫn trong cấu hình có đúng không
- Đảm bảo thư mục assets tồn tại

### Spine không load được
- Kiểm tra 3 file spine có cùng tên không
- Đảm bảo đã cài package `@esotericsoftware/spine-pixi-v8`
- Kiểm tra basePath và baseName trong cấu hình

### Assets load chậm
- Giảm số lượng file trong thư mục
- Sử dụng format nén tốt hơn (webp thay png)
- Tách assets thành nhiều lần load

## Ví dụ hoàn chỉnh

```typescript
// main.ts
import { configureAssetLoader, loadGameAssets } from './assetLoader';
import { Application, Sprite } from 'pixi.js';

async function main() {
    // 1. Cấu hình
    configureAssetLoader({
        spine: { enabled: false },
        folders: {
            arts: '../assets/images',
            sounds: '../assets/sounds'
        }
    });

    // 2. Load assets
    const assets = await loadGameAssets();
    console.log('Assets loaded!', assets);

    // 3. Sử dụng
    const app = new Application();
    await app.init();

    const sprite = Sprite.from('hero.png');
    app.stage.addChild(sprite);
}

main();
```

Với hướng dẫn này, bạn có thể dễ dàng tái sử dụng asset loader cho bất kỳ dự án nào!