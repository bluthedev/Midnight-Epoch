import * as Phaser from 'phaser';
import { State } from './PlayerStateMachine';

export class IdleState extends State {
    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        if (scene.input.keyboard && Phaser.Input.Keyboard.JustDown(scene.shiftKey)) {
            this.stateMachine.transition('dash');
            return;
        }

        if (scene.cursors.left.isDown || scene.cursors.right.isDown) {
            this.stateMachine.transition('run');
            return;
        }
        if (scene.cursors.up.isDown && player.body?.touching.down) {
            this.stateMachine.transition('jump');
            return;
        }
        player.setVelocityX(0);
    }
}

export class RunState extends State {
    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        if (scene.input.keyboard && Phaser.Input.Keyboard.JustDown(scene.shiftKey)) {
            this.stateMachine.transition('dash');
            return;
        }

        const speed = 300;
        
        if (scene.cursors.left.isDown) {
            player.setVelocityX(-speed);
        } else if (scene.cursors.right.isDown) {
            player.setVelocityX(speed);
        } else {
            this.stateMachine.transition('idle');
            return;
        }

        if (scene.cursors.up.isDown && player.body?.touching.down) {
            this.stateMachine.transition('jump');
        }
    }
}

export class JumpState extends State {
    enter(_scene: any, player: Phaser.Physics.Arcade.Sprite) {
        if (player.body?.touching.down || player.body?.blocked.down) {
            player.setVelocityY(-400); // Initial explosive jump force
        }
    }

    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        if (scene.input.keyboard && Phaser.Input.Keyboard.JustDown(scene.shiftKey)) {
            this.stateMachine.transition('dash');
            return;
        }
        // Allow horizontal control in the air
        const speed = 250;
        if (scene.cursors.left.isDown) {
            player.setVelocityX(-speed);
        } else if (scene.cursors.right.isDown) {
            player.setVelocityX(speed);
        }

        const touchingLeft = player.body?.blocked.left;
        const touchingRight = player.body?.blocked.right;

        if (!player.body?.touching.down && !player.body?.blocked.down) {
            // FIX: Pass the side context into the state transition
            if (touchingLeft && scene.cursors.left.isDown) {
                this.stateMachine.transition('wallSlide', 'left');
                return;
            }
            if (touchingRight && scene.cursors.right.isDown) {
                this.stateMachine.transition('wallSlide', 'right');
                return;
            }
        }

        if (player.body?.touching.down) {
            this.stateMachine.transition('idle');
        }
    }
}

export class WallSlideState extends State {
    private bounceTimer: number = 0;

    enter(scene: any, player: Phaser.Physics.Arcade.Sprite, wallSide: 'left' | 'right') {
        const bounceForceX = 400;
        const bounceForceY = -400;
        
        // Automatically change direction with high velocity away from the wall
        if (wallSide === 'left') {
            player.setVelocity(bounceForceX, bounceForceY);
        } else {
            player.setVelocity(-bounceForceX, bounceForceY);
        }
        
        // Record the time we bounced to create an input lockout window
        this.bounceTimer = scene.time.now;
    }

    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        // Lock out horizontal air-control for 300ms to allow the bounce to actually happen.
        // Without this, JumpState would immediately overwrite the bounce velocity on the next frame!
        if (scene.time.now - this.bounceTimer > 300) {
            this.stateMachine.transition('jump');
            return;
        }

        // Drop off if they hit the ground during the bounce
        if (player.body?.blocked.down || player.body?.touching.down) {
            this.stateMachine.transition('idle');
            return;
        }
    }
}

export class DashState extends State {
    private dashDirection: number = 1;
    private isDashing: boolean = false;

    enter(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        this.isDashing = true;
        
        if (player.body) {
            (player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        }
        
        // Determine direction based on input
        if (scene.cursors.left.isDown) {
            this.dashDirection = -1;
        } else if (scene.cursors.right.isDown) {
            this.dashDirection = 1;
        } else {
            const body = player.body as Phaser.Physics.Arcade.Body;
            this.dashDirection = body && body.velocity.x < 0 ? -1 : 1;
        }

        player.setVelocityX(800 * this.dashDirection);
        player.setVelocityY(0);

        scene.time.delayedCall(200, () => {
            if (this.stateMachine.state === 'dash') {
                this.isDashing = false;
                if (player.body) {
                    (player.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
                }
                if (player.body?.touching.down || player.body?.blocked.down) {
                    this.stateMachine.transition('idle');
                } else {
                    this.stateMachine.transition('jump');
                }
            }
        });
    }

    execute(_scene: any, player: Phaser.Physics.Arcade.Sprite) {
        if (this.isDashing) {
            player.setVelocityX(800 * this.dashDirection);
            player.setVelocityY(0);
        }
    }
}
