import { Scene } from 'phaser';
import { StateMachine } from '../PlayerStateMachine';
import { IdleState, RunState, JumpState, WallSlideState, DashState } from '../PlayerStates';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    player: any;
    platforms: Phaser.Physics.Arcade.StaticGroup;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    shiftKey: Phaser.Input.Keyboard.Key;
    stateMachine: StateMachine;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x222222);

        // Create the platforms group
        this.platforms = this.physics.add.staticGroup();

        // Floor
        const floor = this.add.rectangle(512, 700, 800, 40, 0x00ff00);
        this.physics.add.existing(floor, true);
        this.platforms.add(floor);

        // Left Wall
        const leftWall = this.add.rectangle(150, 400, 40, 500, 0x00ff00);
        this.physics.add.existing(leftWall, true);
        this.platforms.add(leftWall);

        // Right Wall
        const rightWall = this.add.rectangle(874, 400, 40, 500, 0x00ff00);
        this.physics.add.existing(rightWall, true);
        this.platforms.add(rightWall);

        // Create the player as a rectangle
        const playerRect = this.add.rectangle(512, 500, 32, 48, 0xff0000);
        this.physics.add.existing(playerRect);
        
        // Phaser Rectangle doesn't have Sprite methods, so we inject them to satisfy the States logic
        this.player = playerRect as any;
        this.player.setVelocityX = (v: number) => { this.player.body.velocity.x = v; };
        this.player.setVelocityY = (v: number) => { this.player.body.velocity.y = v; };
        this.player.setVelocity = (x: number, y: number) => {
            this.player.body.velocity.x = x;
            this.player.body.velocity.y = y;
        };
        this.player.setFlipX = (v: boolean) => { /* Rectangles don't support flipX */ };
        this.player.setFriction = (x: number, y: number) => { this.player.body.friction.set(x, y); };
        this.player.setDrag = (x: number, y: number) => { this.player.body.drag.set(x, y); };

        // Zero out friction and drag on player
        this.player.setFriction(0, 0);
        this.player.setDrag(0, 0);

        // Zero out friction on all static platform bodies
        this.platforms.getChildren().forEach((child: any) => {
            if (child.body && child.body.friction) {
                child.body.friction.set(0, 0);
            }
        });
        
        // Add physics collision
        this.physics.add.collider(this.player, this.platforms);

        // Set up input
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

        // Initialize state machine
        this.stateMachine = new StateMachine('idle', {
            idle: new IdleState(),
            run: new RunState(),
            jump: new JumpState(),
            wallSlide: new WallSlideState(),
            dash: new DashState()
        }, [this, this.player]);
    }

    update()
    {
        // Update loop purely drives the state machine
        this.stateMachine.step();
    }
}
