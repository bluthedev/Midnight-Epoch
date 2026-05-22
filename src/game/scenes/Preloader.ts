import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        // Draw a premium dark radial gradient/background using Phaser Graphics
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0f1115, 0x0f1115, 0x07080a, 0x07080a, 1);
        bg.fillRect(0, 0, 1024, 768);

        // Elegant, high-tech grid accents in the background (brutalist sci-fi styling)
        const grid = this.add.graphics();
        grid.lineStyle(1, 0xd4af37, 0.08);
        for (let x = 0; x < 1024; x += 64) {
            grid.lineBetween(x, 0, x, 768);
        }
        for (let y = 0; y < 768; y += 64) {
            grid.lineBetween(0, y, 1024, y);
        }

        // Sleek white-and-gold tech text
        this.add.text(512, 320, 'ESTABLISHING CITADEL CONNECTION', {
            fontFamily: '"Outfit", "Inter", sans-serif',
            fontSize: '14px',
            color: '#d4af37',
            fontWeight: '800',
            letterSpacing: 2
        }).setOrigin(0.5);

        // A beautiful progress bar outline (Citadel style)
        const outline = this.add.graphics();
        outline.lineStyle(2, 0xd4af37, 0.3);
        outline.strokeRoundedRect(512 - 200, 360, 400, 16, 8);

        // Progress bar fill
        const bar = this.add.graphics();

        // Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {
            bar.clear();
            bar.fillStyle(0xf5f6fa, 0.9); // Pristine white fill
            bar.fillRoundedRect(512 - 196, 364, 392 * progress, 8, 4);
        });
    }

    preload ()
    {
        // Load the assets for the game
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png?v=1.0.2');
        this.load.image('citadel_bg', 'citadel_bg.png?v=1.0.2');
    }

    create ()
    {
        // Move to the MainMenu scene
        this.scene.start('MainMenu');
    }
}

