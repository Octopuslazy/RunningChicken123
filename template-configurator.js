#!/usr/bin/env node

/**
 * Template Configurator
 * Công cụ để tùy chỉnh template cho từng loại project
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES = {
  simple2d: {
    name: 'Simple 2D Game',
    description: 'Game 2D đơn giản, không dùng Spine',
    config: {
      spine: { enabled: false },
      folders: {
        arts: '../Assets/Images',
        sounds: '../Assets/Sounds'
      },
      fileExtensions: {
        images: ['.png', '.jpg', '.webp'],
        sounds: ['.mp3', '.ogg']
      }
    }
  },
  
  spineGame: {
    name: 'Spine Character Game',
    description: 'Game có nhân vật Spine animation',
    config: {
      spine: {
        enabled: true,
        baseName: 'character',
        basePath: '../Assets/Characters',
        textureAlias: 'character_tex'
      },
      folders: {
        arts: '../Assets/UI',
        sounds: '../Assets/Audio'
      }
    }
  },

  runner: {
    name: 'Endless Runner',
    description: 'Template cho game chạy vô tận',
    config: {
      spine: {
        enabled: true,
        baseName: 'runner',
        basePath: '../Assets/Characters',
        textureAlias: 'runner_tex'
      },
      folders: {
        arts: '../Assets/Environment',
        sounds: '../Assets/SFX'
      }
    }
  },

  puzzle: {
    name: 'Puzzle Game',
    description: 'Template cho game giải đố',
    config: {
      spine: { enabled: false },
      folders: {
        arts: '../Assets/Pieces',
        sounds: '../Assets/Audio'
      },
      fileExtensions: {
        images: ['.png', '.svg'],
        sounds: ['.mp3', '.wav']
      }
    }
  },

  hypercasual: {
    name: 'Hyper Casual',
    description: 'Template cho hyper casual game',
    config: {
      spine: { enabled: false },
      folders: {
        arts: '../Assets/Simple',
        sounds: '../Assets/Short'
      },
      fileExtensions: {
        images: ['.png'],
        sounds: ['.mp3']
      }
    }
  }
};

function generateAssetConfig(templateKey) {
  const template = TEMPLATES[templateKey];
  if (!template) throw new Error(`Template ${templateKey} not found`);

  return `// Asset configuration - ${template.name}
// ${template.description}

import { configureAssetLoader } from './assetLoader';

export const projectConfig = ${JSON.stringify(template.config, null, 4)};

// Apply configuration
configureAssetLoader(projectConfig);
`;
}

function generateMainTemplate(templateKey) {
  const template = TEMPLATES[templateKey];
  const hasSpine = template.config.spine?.enabled;

  let gameLogic = '';
  
  switch(templateKey) {
    case 'simple2d':
      gameLogic = `
        // Simple 2D game setup
        const bg = Sprite.from('background.png');
        bg.width = this.app.screen.width;
        bg.height = this.app.screen.height;
        this.app.stage.addChild(bg);

        // Add some interactive elements
        const playButton = Sprite.from('play_button.png');
        playButton.anchor.set(0.5);
        playButton.x = this.app.screen.width / 2;
        playButton.y = this.app.screen.height / 2;
        playButton.eventMode = 'static';
        playButton.cursor = 'pointer';
        playButton.on('pointerdown', () => this.startGame());
        this.app.stage.addChild(playButton);`;
      break;
      
    case 'runner':
      gameLogic = `
        // Endless runner setup
        this.setupBackground();
        this.setupPlayer();
        this.setupObstacles();
        this.startGameLoop();`;
      break;
      
    case 'puzzle':
      gameLogic = `
        // Puzzle game setup
        this.setupGrid();
        this.setupPieces();
        this.setupUI();`;
      break;
      
    default:
      gameLogic = `
        // Game setup
        const background = Sprite.from('background.png');
        this.app.stage.addChild(background);
        
        ${hasSpine ? '// Load and setup Spine character\n        await this.setupSpineCharacter();' : ''}`;
  }

  return `// ${template.name} - Main Game Logic
// ${template.description}

import { Application, Assets, Sprite, Graphics } from 'pixi.js';
import { loadGameAssets, arts, sounds } from './assetLoader';
${hasSpine ? "import { loadSpineAssets, Spine } from './assetLoader';" : ""}
import './assetLoader.config'; // Apply project configuration

class Game {
    private app: Application;
    private gameStarted = false;
    ${hasSpine ? 'private character: any = null;' : ''}

    constructor() {
        this.app = new Application();
    }

    async init() {
        // Initialize PIXI Application
        await this.app.init({
            width: 720,
            height: 1280,
            backgroundColor: 0x87CEEB, // Sky blue
            antialias: true
        });

        // Add canvas to DOM
        const appDiv = document.getElementById('app');
        if (appDiv) {
            appDiv.appendChild(this.app.canvas);
        }

        // Load assets
        console.log('Loading assets...');
        await loadGameAssets();
        console.log('Assets loaded!');

        // Setup game
        this.setupGame();
        
        // Signal ready to ad networks
        this.signalGameReady();
    }

    private async setupGame() {${gameLogic}
        
        console.log('${template.name} setup complete!');
    }

    ${hasSpine ? `
    private async setupSpineCharacter() {
        try {
            const spineAssets = await loadSpineAssets();
            if (spineAssets.texture && spineAssets.jsonData) {
                // Create spine character
                // this.character = Spine.from('spineAtlas', 'spineSkeleton');
                // this.app.stage.addChild(this.character);
                console.log('Spine character loaded');
            }
        } catch (error) {
            console.warn('Failed to load spine character:', error);
        }
    }` : ''}

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
        
        console.log('${template.name} started!');
        // Add your game start logic here
    }

    close() {
        console.log('${template.name} closed');
        // Add cleanup logic here
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
}

// CLI Interface
if (require.main === module) {
  const templateKey = process.argv[2];
  
  if (!templateKey) {
    console.log('🎮 Available Templates:\n');
    Object.keys(TEMPLATES).forEach(key => {
      const template = TEMPLATES[key];
      console.log(`  ${key}: ${template.name}`);
      console.log(`    ${template.description}\n`);
    });
    console.log('Usage: node template-configurator.js <template-key>');
    process.exit(1);
  }
  
  if (!TEMPLATES[templateKey]) {
    console.error(`❌ Template "${templateKey}" not found`);
    process.exit(1);
  }
  
  try {
    // Generate asset config
    const assetConfigContent = generateAssetConfig(templateKey);
    fs.writeFileSync('src/assetLoader.config.ts', assetConfigContent);
    
    // Generate main.ts
    const mainContent = generateMainTemplate(templateKey);
    fs.writeFileSync('src/main.ts', mainContent);
    
    console.log(`✅ Generated ${TEMPLATES[templateKey].name} template`);
    console.log('📁 Files created:');
    console.log('  - src/assetLoader.config.ts');
    console.log('  - src/main.ts');
    console.log('\n🚀 Run "npm run dev" to start developing!');
    
  } catch (error) {
    console.error('❌ Failed to generate template:', error.message);
  }
}

module.exports = { TEMPLATES, generateAssetConfig, generateMainTemplate };