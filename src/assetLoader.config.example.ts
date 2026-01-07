// ==========================================
// ASSET LOADER CONFIGURATION EXAMPLES
// ==========================================
// Copy this file and customize it for your project

import { configureAssetLoader } from './assetLoader';

// Example 1: Basic configuration for a different character
export const heroProjectConfig = {
    spine: {
        enabled: true,
        baseName: 'hero_character',  // Will look for hero_character.png, .atlas, .json
        basePath: '../Assets/Characters/hero',
        textureAlias: 'hero_texture'
    },
    folders: {
        arts: '../Assets/UI',
        sounds: '../Assets/Audio'
    }
};

// Example 2: Disable spine, different file extensions
export const simpleGameConfig = {
    spine: {
        enabled: false
    },
    folders: {
        arts: '../images',
        sounds: '../audio'
    },
    fileExtensions: {
        images: ['.png', '.webp'],
        sounds: ['.ogg', '.m4a']
    }
};

// Example 3: Multiple spine characters (use different instances)
export const multiCharacterConfig = {
    spine: {
        enabled: true,
        baseName: 'monster_boss',
        basePath: '../Assets/Enemies/boss',
        textureAlias: 'boss_texture'
    },
    folders: {
        arts: '../Assets/GameUI',
        sounds: '../Assets/SFX'
    }
};

// How to use:
// 1. At the beginning of your main.ts or index.ts:
// import { configureAssetLoader } from './assetLoader';
// import { heroProjectConfig } from './assetLoader.config';
// 
// configureAssetLoader(heroProjectConfig);
//
// 2. Then use loadGameAssets() as normal:
// import { loadGameAssets } from './assetLoader';
// const { images, sounds } = await loadGameAssets();

// Quick setup for common project types:

// For RPG games:
export const rpgConfig = {
    spine: { enabled: true, baseName: 'player', basePath: '../Assets/Characters' },
    folders: { arts: '../Assets/UI', sounds: '../Assets/Audio' }
};

// For platformer games:
export const platformerConfig = {
    spine: { enabled: true, baseName: 'player', basePath: '../Assets/Player' },
    folders: { arts: '../Assets/Sprites', sounds: '../Assets/Sounds' }
};

// For puzzle games (no spine):
export const puzzleConfig = {
    spine: { enabled: false },
    folders: { arts: '../Assets/Pieces', sounds: '../Assets/SFX' }
};