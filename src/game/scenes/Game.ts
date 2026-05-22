import { Scene } from 'phaser';
import { StateMachine } from '../PlayerStateMachine';
import { IdleState, RunState, JumpState, WallSlideState, DashState } from '../PlayerStates';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    player: Phaser.Physics.Arcade.Sprite;
    playerRect: Phaser.GameObjects.Rectangle;
    playerVisor: Phaser.GameObjects.Rectangle;
    timepieceAura: Phaser.GameObjects.Graphics;
    platforms: Phaser.Physics.Arcade.StaticGroup;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    shiftKey: Phaser.Input.Keyboard.Key;
    stateMachine: StateMachine;

    constructor ()
    {
        super('Game');
    }

    createCitadelPlatform (x: number, y: number, width: number, height: number)
    {
        // Core brutalist structure (pristine white concrete)
        const rect = this.add.rectangle(x, y, width, height, 0xf5f6fa);
        rect.setStrokeStyle(1.5, 0xe2e8f0);
        
        // Glowing gold trim on the top ledge
        this.add.rectangle(x, y - (height / 2) + 2, width, 4, 0xd4af37);
        
        // Deep obsidian accent on the bottom base
        this.add.rectangle(x, y + (height / 2) - 2, width, 4, 0x1a1d24);

        this.physics.add.existing(rect, true);
        this.platforms.add(rect);

        // Subtle geometric gridlines inside the platform to make it feel architectural
        const grid = this.add.graphics();
        grid.lineStyle(1.5, 0xd1d5db, 0.35);
        // Draw vertical panel lines to simulate concrete panels
        for (let i = -width/2 + 40; i < width/2; i += 40) {
            grid.lineBetween(x + i, y - height/2 + 4, x + i, y + height/2 - 4);
        }

        return rect;
    }

    create ()
    {
        console.log('Game Scene [create] initialized.');
        // Smoothly fade the game screen in from the dark transition color
        this.cameras.main.fadeIn(500, 15, 17, 21);

        this.camera = this.cameras.main;
        
        // Add the beautiful Citadel background with minor parallax setting
        const bg = this.add.image(512, 384, 'citadel_bg');
        bg.setDisplaySize(1024, 768);
        bg.setScrollFactor(0.2);

        // Create the platforms group
        this.platforms = this.physics.add.staticGroup();

        // Floor
        this.createCitadelPlatform(512, 700, 800, 40);

        // Left Wall
        this.createCitadelPlatform(150, 400, 40, 500);

        // Right Wall
        this.createCitadelPlatform(874, 400, 40, 500);

        // Create the player as a standard physics sprite (invisible)
        this.player = this.physics.add.sprite(512, 500, 'logo');
        this.player.setAlpha(0); // Fully transparent
        this.player.setDisplaySize(32, 48); // Set dimensions
        
        this.player.setFriction(0, 0);
        this.player.setDrag(0, 0);

        // Sleek Citadel-themed visual representation that tracks the physics body
        this.playerRect = this.add.rectangle(512, 500, 32, 48, 0xf5f6fa);
        this.playerRect.setStrokeStyle(2.5, 0xd4af37); // Gold border

        // Zero out friction on all static platform bodies
        this.platforms.getChildren().forEach((child: any) => {
            const body = child.body as Phaser.Physics.Arcade.StaticBody;
            if (body && body.friction) {
                body.friction.set(0, 0);
            }
        });
        
        // Add physics collision
        this.physics.add.collider(this.player, this.platforms);

        // Glowing golden active visor
        this.playerVisor = this.add.rectangle(512, 500 - 12, 24, 6, 0x00f0ff);
        this.playerVisor.setStrokeStyle(1, 0xffffff);

        // Timepiece holographic chronometer aura
        this.timepieceAura = this.add.graphics();

        // Set up input with robust keyboard mock fallback for mobile/Telegram WebApp contexts
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        } else {
            const mockKey = { isDown: false };
            this.cursors = {
                left: mockKey,
                right: mockKey,
                up: mockKey,
                down: mockKey,
                space: mockKey,
                shift: mockKey
            } as any;
            this.shiftKey = mockKey as any;
        }

        // Initialize state machine
        this.stateMachine = new StateMachine('idle', {
            idle: new IdleState(),
            run: new RunState(),
            jump: new JumpState(),
            wallSlide: new WallSlideState(),
            dash: new DashState()
        }, [this, this.player]);
        console.log('Game Scene [create] successfully completed. State Machine:', this.stateMachine);
    }

    createDashGhost()
    {
        // Create a fading cyan holographic trailing capsule representing techwear speed trails
        const ghost = this.add.rectangle(this.player.x, this.player.y, 32, 48, 0x00f0ff, 0.45);
        ghost.setStrokeStyle(2, 0xd4af37, 0.4);
        
        this.tweens.add({
            targets: ghost,
            alpha: 0,
            scaleX: 0.75,
            scaleY: 0.75,
            duration: 200,
            onComplete: () => {
                ghost.destroy();
            }
        });
    }

    update()
    {
        // Update loop purely drives the state machine
        this.stateMachine.step();

        // Have the visual player rectangle follow the physics body
        this.playerRect.x = this.player.x;
        this.playerRect.y = this.player.y;

        const body = this.player.body as Phaser.Physics.Arcade.Body;

        // Dynamic visor offsets based on velocity direction
        this.playerVisor.y = this.player.y - 12;
        if (body && body.velocity.x > 10) {
            this.playerVisor.x = this.player.x + 5;
        } else if (body && body.velocity.x < -10) {
            this.playerVisor.x = this.player.x - 5;
        } else {
            this.playerVisor.x = this.player.x;
        }

        // Draw timepiece active chronometer ticks around the player's base
        this.timepieceAura.clear();
        this.timepieceAura.lineStyle(1.5, 0xd4af37, 0.75);
        
        const time = this.time.now * 0.0025;
        const radius = 24;
        const centerX = this.player.x;
        const centerY = this.player.y + 24;
        
        // Render 8 rotating dials around the feet
        for (let i = 0; i < 8; i++) {
            const angle = time + (i * Math.PI / 4);
            const startX = centerX + Math.cos(angle) * (radius - 5);
            const startY = centerY + Math.sin(angle) * (radius - 5);
            const endX = centerX + Math.cos(angle) * radius;
            const endY = centerY + Math.sin(angle) * radius;
            this.timepieceAura.lineBetween(startX, startY, endX, endY);
        }

        // Generate glowing speed trails during active Dash
        if (this.stateMachine.state === 'dash') {
            this.createDashGhost();
        }
    }
}
