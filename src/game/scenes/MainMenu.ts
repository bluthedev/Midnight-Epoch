import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    startButton: GameObjects.Container;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        // Fade in from dark blue/grey
        this.cameras.main.fadeIn(500, 15, 17, 21);

        // Add the beautiful Citadel background, scaled to cover the 1024x768 screen
        this.background = this.add.image(512, 384, 'citadel_bg');
        this.background.setDisplaySize(1024, 768);

        // Add a high-tech vignette overlay
        const vignette = this.add.graphics();
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.4, 0.4, 0.7, 0.7);
        vignette.fillRect(0, 0, 1024, 768);

        // Sleek, futuristic white-and-gold Citadel Title
        const titleText = this.add.text(512, 260, 'MIDNIGHT EPOCH', {
            fontFamily: '"Outfit", "Inter", "Arial Black", sans-serif',
            fontSize: '68px',
            color: '#f5f6fa',
            fontWeight: '900',
            letterSpacing: 8,
            stroke: '#d4af37',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Add a premium subtitle under the title
        const subtitleText = this.add.text(512, 320, 'CITADEL EXPEDITION OVERWATCH', {
            fontFamily: '"Inter", sans-serif',
            fontSize: '14px',
            color: '#d4af37',
            fontWeight: '800',
            letterSpacing: 4
        }).setOrigin(0.5);

        // Create a beautiful, premium CTA Button at the center
        const btnX = 512;
        const btnY = 480;
        
        // Translucent golden-white background
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x0f1115, 0.85);
        btnBg.lineStyle(2, 0xd4af37, 1); // Gold outline
        btnBg.fillRoundedRect(-150, -30, 300, 60, 12);
        btnBg.strokeRoundedRect(-150, -30, 300, 60, 12);

        // Golden glowing text
        const btnText = this.add.text(0, 0, 'INITIATE DEPLOYMENT', {
            fontFamily: '"Outfit", "Inter", "Arial", sans-serif',
            fontSize: '18px',
            color: '#ffffff',
            fontWeight: '900',
            stroke: '#d4af37',
            strokeThickness: 1
        }).setOrigin(0.5);

        // Combine into a Container
        this.startButton = this.add.container(btnX, btnY, [btnBg, btnText]);
        
        // Set interactive area for the container
        this.startButton.setSize(300, 60);
        this.startButton.setInteractive({ useHandCursor: true });

        // Add sleek hover micro-animations
        this.startButton.on('pointerover', () => {
            this.tweens.add({
                targets: this.startButton,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 150,
                ease: 'Back.easeOut'
            });
            // Intensify gold glow
            btnBg.clear();
            btnBg.fillStyle(0x1a1d24, 0.95);
            btnBg.lineStyle(2, 0xffd700, 1); // Brighter gold
            btnBg.fillRoundedRect(-150, -30, 300, 60, 12);
            btnBg.strokeRoundedRect(-150, -30, 300, 60, 12);
        });

        this.startButton.on('pointerout', () => {
            this.tweens.add({
                targets: this.startButton,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 150,
                ease: 'Power2'
            });
            btnBg.clear();
            btnBg.fillStyle(0x0f1115, 0.85);
            btnBg.lineStyle(2, 0xd4af37, 1);
            btnBg.fillRoundedRect(-150, -30, 300, 60, 12);
            btnBg.strokeRoundedRect(-150, -30, 300, 60, 12);
        });

        // Trigger scene start on click
        this.startButton.on('pointerdown', () => {
            this.cameras.main.fade(500, 15, 17, 21);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('Game');
            });
        });

        // Ambient subtitle text for that premium feel
        this.add.text(btnX, btnY + 60, 'AETHER-7 CITADEL BOUNDARY ACCESS', {
            fontFamily: '"Inter", sans-serif',
            fontSize: '11px',
            color: '#a0aec0',
            fontWeight: '600',
            letterSpacing: 2
        }).setOrigin(0.5).setAlpha(0.7);
    }
}

