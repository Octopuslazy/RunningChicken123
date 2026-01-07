// Endless Runner - Main Game Logic
// Template cho game chạy vô tận

import { Application, Assets, Sprite, Graphics } from 'pixi.js';
import { loadGameAssets, arts, sounds } from './assetLoader';
import { loadSpineAssets, Spine } from './assetLoader';
import './assetLoader.config'; // Apply project configuration

class Game {
    private app: Application;
    private gameStarted = false;
    private character: any = null;

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

    private async setupGame() {
        // Endless runner setup
        this.setupBackground();
        this.setupPlayer();
        this.setupObstacles();
        this.startGameLoop();
        
        console.log('Endless Runner setup complete!');
    }

    
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
        
        console.log('Endless Runner started!');
        // Add your game start logic here
    }

    close() {
        console.log('Endless Runner closed');
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
