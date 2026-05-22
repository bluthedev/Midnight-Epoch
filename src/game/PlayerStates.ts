import { State } from './PlayerStateMachine';

// ─── IDLE ───────────────────────────────────────────────────────────────────
export class IdleState extends State {
    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        // Double-tap dash (knife only) — flag set by Game.ts
        if (scene.dashRequested && scene.currentWeapon === 'knife') {
            scene.dashRequested = false;
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

// ─── RUN ─────────────────────────────────────────────────────────────────────
export class RunState extends State {
    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        // Double-tap dash (knife only)
        if (scene.dashRequested && scene.currentWeapon === 'knife') {
            scene.dashRequested = false;
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

// ─── JUMP ────────────────────────────────────────────────────────────────────
export class JumpState extends State {
    enter(_scene: any, player: Phaser.Physics.Arcade.Sprite) {
        if (player.body?.touching.down || player.body?.blocked.down) {
            player.setVelocityY(-560);
        }
    }

    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        // Double-tap dash mid-air (knife only)
        if (scene.dashRequested && scene.currentWeapon === 'knife') {
            scene.dashRequested = false;
            this.stateMachine.transition('dash');
            return;
        }

        const speed = 260;
        if (scene.cursors.left.isDown) {
            player.setVelocityX(-speed);
        } else if (scene.cursors.right.isDown) {
            player.setVelocityX(speed);
        }

        // Wall slide transitions
        if (!player.body?.touching.down && !player.body?.blocked.down) {
            if (player.body?.blocked.left && scene.cursors.left.isDown) {
                this.stateMachine.transition('wallSlide', 'left');
                return;
            }
            if (player.body?.blocked.right && scene.cursors.right.isDown) {
                this.stateMachine.transition('wallSlide', 'right');
                return;
            }
        }

        if (player.body?.touching.down) {
            this.stateMachine.transition('idle');
        }
    }
}

// ─── WALL SLIDE ──────────────────────────────────────────────────────────────
export class WallSlideState extends State {
    private bounceTimer: number = 0;

    enter(scene: any, player: Phaser.Physics.Arcade.Sprite, wallSide: 'left' | 'right') {
        if (wallSide === 'left') {
            player.setVelocity(400, -500);
        } else {
            player.setVelocity(-400, -500);
        }
        this.bounceTimer = scene.time.now;
    }

    execute(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        if (scene.time.now - this.bounceTimer > 300) {
            this.stateMachine.transition('jump');
            return;
        }
        if (player.body?.blocked.down || player.body?.touching.down) {
            this.stateMachine.transition('idle');
        }
    }
}

// ─── DASH ────────────────────────────────────────────────────────────────────
export class DashState extends State {
    private dashDirection: number = 1;
    private isDashing: boolean = false;

    enter(scene: any, player: Phaser.Physics.Arcade.Sprite) {
        this.isDashing = true;

        if (player.body) {
            (player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        }

        // Direction: current input wins, else last facing direction
        if (scene.cursors.left.isDown) {
            this.dashDirection = -1;
        } else if (scene.cursors.right.isDown) {
            this.dashDirection = 1;
        } else {
            const body = player.body as Phaser.Physics.Arcade.Body;
            this.dashDirection = (body && body.velocity.x < 0) ? -1 : 1;
        }

        // Knife lunge — fast and precise
        player.setVelocityX(920 * this.dashDirection);
        player.setVelocityY(0);

        scene.time.delayedCall(175, () => {
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
            player.setVelocityX(920 * this.dashDirection);
            player.setVelocityY(0);
        }
    }
}
