#!/usr/bin/env node

/**
 * PixiJS Playable Template Setup Script
 * Run: node setup-template.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function setupTemplate() {
  console.log('🎮 PixiJS Playable Game Template Setup\n');

  // Collect project info
  const projectName = await question('Project name (e.g., super-runner): ');
  const gameTitle = await question('Game title (e.g., Super Runner): ');
  const packageId = await question('Package ID (e.g., com.yourcompany.superrunner): ');
  const appStoreId = await question('App Store ID (optional): ');
  const googlePlayUrl = `https://play.google.com/store/apps/details?id=${packageId}`;
  const appStoreUrl = appStoreId ? 
    `https://apps.apple.com/app/${appStoreId}` : 
    'https://apps.apple.com/app/your-app-id';

  console.log('\n🔧 Setting up project...\n');

  // Update package.json
  const packagePath = path.join(__dirname, 'package.json');
  let packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.name = projectName;
  packageJson.description = `${gameTitle} - Playable Ad Game built with PixiJS`;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json');

  // Update index.html
  const indexPath = path.join(__dirname, 'src', 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  indexHtml = indexHtml
    .replace('{{GAME_TITLE}}', gameTitle)
    .replace('{{GOOGLE_PLAY_URL}}', googlePlayUrl)
    .replace('{{APP_STORE_URL}}', appStoreUrl);
  fs.writeFileSync(indexPath, indexHtml);
  console.log('✅ Updated index.html');

  // Update build script
  const buildScriptPath = path.join(__dirname, 'scripts', 'generate-build-vars.js');
  let buildScript = fs.readFileSync(buildScriptPath, 'utf8');
  buildScript = buildScript
    .replace('{{PACKAGE_ID}}', packageId)
    .replace('{{APP_ID}}', appStoreId || 'your-app-id');
  fs.writeFileSync(buildScriptPath, buildScript);
  console.log('✅ Updated build script');

  // Update vercel.json
  const vercelPath = path.join(__dirname, 'vercel.json');
  let vercelJson = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  vercelJson.buildCommand = `npm run build && cp dist/${projectName}_*.html dist/index.html`;
  fs.writeFileSync(vercelPath, JSON.stringify(vercelJson, null, 2));
  console.log('✅ Updated vercel.json');

  // Create project-specific asset config
  const assetConfigPath = path.join(__dirname, 'src', 'assetLoader.config.ts');
  const assetConfigContent = `// Asset configuration for ${gameTitle}
import { configureAssetLoader } from './assetLoader';

// Configure for your project
export const projectConfig = {
    spine: {
        enabled: false, // Change to true if using Spine animations
        baseName: 'character', // Your spine file base name
        basePath: '../Assets/Characters',
        textureAlias: 'character_tex'
    },
    folders: {
        arts: '../Assets/Images',
        sounds: '../Assets/Sounds'
    },
    fileExtensions: {
        images: ['.png', '.jpg', '.webp'],
        sounds: ['.mp3', '.ogg', '.wav']
    }
};

// Apply configuration
configureAssetLoader(projectConfig);
`;
  fs.writeFileSync(assetConfigPath, assetConfigContent);
  console.log('✅ Created asset config');

  // Create main.ts template
  const mainTsPath = path.join(__dirname, 'src', 'main.ts');
  const mainTsContent = `// ${gameTitle} - Main Game Logic
import { Application, Assets } from 'pixi.js';
import { loadGameAssets } from './assetLoader';
import './assetLoader.config'; // Apply project configuration

class Game {
    private app: Application;
    private gameStarted = false;

    constructor() {
        this.app = new Application();
    }

    async init() {
        // Initialize PIXI Application
        await this.app.init({
            width: 720,
            height: 1280,
            backgroundColor: 0x000000,
            antialias: true
        });

        // Add canvas to DOM
        document.getElementById('app')?.appendChild(this.app.canvas);

        // Load assets
        console.log('Loading assets...');
        await loadGameAssets();
        console.log('Assets loaded!');

        // Setup game
        this.setupGame();
        
        // Signal ready to ad networks
        this.signalGameReady();
    }

    private setupGame() {
        // TODO: Add your game logic here
        // Example:
        // const sprite = Sprite.from('your-image.png');
        // this.app.stage.addChild(sprite);
        
        console.log('Game setup complete!');
    }

    private signalGameReady() {
        // Signal to ad networks that game is ready
        if (typeof window !== 'undefined') {
            (window as any).gameReady?.();
            console.log('Game ready signal sent');
        }
    }

    start() {
        if (this.gameStarted) return;
        this.gameStarted = true;
        
        // TODO: Start game logic
        console.log('Game started!');
    }

    close() {
        // TODO: Cleanup when ad closes
        console.log('Game closed');
    }
}

// Initialize game
const game = new Game();
game.init().catch(console.error);

// Export for ad network callbacks
if (typeof window !== 'undefined') {
    (window as any).gameStart = () => game.start();
    (window as any).gameClose = () => game.close();
}
`;
  fs.writeFileSync(mainTsPath, mainTsContent);
  console.log('✅ Created main.ts template');

  console.log(`
🎉 Project "${gameTitle}" setup complete!

📁 Next steps:
1. Add your assets to Assets/ folder
2. Update src/assetLoader.config.ts if needed  
3. Implement game logic in src/main.ts
4. Test: npm run dev
5. Build: npm run build:all

📱 Supported platforms: ${packageJson.playable.platforms.join(', ')}

🚀 Ready to develop your playable ad!
  `);

  rl.close();
}

setupTemplate().catch(console.error);