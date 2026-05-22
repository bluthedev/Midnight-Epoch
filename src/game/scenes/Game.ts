import { Scene, Input } from 'phaser';
import { StateMachine } from '../PlayerStateMachine';
import { IdleState, RunState, JumpState, WallSlideState, DashState } from '../PlayerStates';

interface CitadelGuard {
    bodyRect: Phaser.GameObjects.Rectangle;
    coreRect: Phaser.GameObjects.Rectangle;
    visor: Phaser.GameObjects.Rectangle;
    visionGraphics: Phaser.GameObjects.Graphics;
    platform: Phaser.GameObjects.Rectangle;
    direction: number; // 1 = right, -1 = left
    speed: number;
    alertState: 'patrol' | 'suspicious' | 'alert';
    alertLevel: number; // 0 to 100
    startX: number;
    endX: number;
}

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
    
    // Citadel Security Guards AI properties
    guards: CitadelGuard[] = [];
    alertUI: Phaser.GameObjects.Graphics;
    alertText: Phaser.GameObjects.Text;
    globalAlertLevel: number = 0;

    // Chronostasis (Time-Freeze) properties
    chronometerCharge: number = 100;
    chronostasisActive: boolean = false;
    chronostasisOverlay: Phaser.GameObjects.Graphics;
    chronometerHUD: Phaser.GameObjects.Graphics;
    chronometerHUDText: Phaser.GameObjects.Text;
    chronostasisTime: number = 0;

    // Memory Core Hacking & Extraction properties
    memoryCore: Phaser.GameObjects.Rectangle;
    memoryCoreGraphics: Phaser.GameObjects.Graphics;
    memoryCoreHacked: boolean = false;
    hackingProgress: number = 0;
    hackingText: Phaser.GameObjects.Text;
    extractionPortal: Phaser.GameObjects.Graphics;
    extractionActive: boolean = false;
    sKey: Phaser.Input.Keyboard.Key;

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
        // Smooth, premium fade-in using a custom overlay rectangle (bulletproof transition)
        const fadeOverlay = this.add.rectangle(512, 384, 1024, 768, 0x0f1115);
        fadeOverlay.setDepth(99999);
        this.tweens.add({
            targets: fadeOverlay,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                fadeOverlay.destroy();
            }
        });

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

        // Floating Platforms (Stealth Patrol Zones)
        const pLeft = this.createCitadelPlatform(320, 520, 200, 30);
        const pRight = this.createCitadelPlatform(704, 520, 200, 30);
        const pCenter = this.createCitadelPlatform(512, 360, 300, 30);

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
            const body = child.body as any;
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
            this.shiftKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.SHIFT);
            this.sKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.S);
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
            this.sKey = mockKey as any;
        }

        // Initialize state machine
        this.stateMachine = new StateMachine('idle', {
            idle: new IdleState(),
            run: new RunState(),
            jump: new JumpState(),
            wallSlide: new WallSlideState(),
            dash: new DashState()
        }, [this, this.player]);

        // Spawn guards on floating platforms
        this.guards = [
            this.createGuard(pLeft),
            this.createGuard(pRight),
            this.createGuard(pCenter)
        ];

        // Initialize Alert UI
        this.alertUI = this.add.graphics();
        this.alertUI.setDepth(100);

        this.alertText = this.add.text(512, 120, 'CITADEL SECURITY COMPROMISED - INTRUDER SENSORS ACTIVE', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ff3333',
            fontStyle: 'bold',
            backgroundColor: '#0f1115e6',
            padding: { x: 16, y: 8 },
            align: 'center'
        });
        this.alertText.setOrigin(0.5);
        this.alertText.setStroke('#1a1d24', 4);
        this.alertText.setDepth(101);
        this.alertText.setAlpha(0);

        // Initialize Chronostasis VFX overlays & HUD
        this.chronostasisOverlay = this.add.graphics();
        this.chronostasisOverlay.setDepth(4); // Render right behind characters and vision cones

        this.chronometerHUD = this.add.graphics();
        this.chronometerHUD.setDepth(100);

        this.chronometerHUDText = this.add.text(20, 20, 'CHRONOMETER CHARGE', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffd700',
            fontStyle: 'bold'
        });
        this.chronometerHUDText.setDepth(101);
        this.chronometerHUDText.setStroke('#0f1115', 2);

        // Initialize Memory Core Hacking Core (Pristine gold-and-white Horological relic)
        this.memoryCore = this.add.rectangle(512, 325, 24, 30, 0xd4af37, 0.4);
        this.memoryCore.setStrokeStyle(2, 0xffffff);
        this.memoryCore.setDepth(6);

        this.memoryCoreGraphics = this.add.graphics();
        this.memoryCoreGraphics.setDepth(7);

        this.hackingText = this.add.text(512, 280, '[S] HACK MEMORY CORE', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffd700',
            fontStyle: 'bold',
            backgroundColor: '#0f1115e6',
            padding: { x: 8, y: 4 }
        });
        this.hackingText.setOrigin(0.5);
        this.hackingText.setStroke('#0f1115', 2);
        this.hackingText.setDepth(10);
        this.hackingText.setAlpha(0);

        // Initialize Extraction Portal Graphics
        this.extractionPortal = this.add.graphics();
        this.extractionPortal.setDepth(5); // Render behind player but in front of platforms

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

    createGuard(platform: Phaser.GameObjects.Rectangle): CitadelGuard
    {
        const guardHeight = 36;
        const guardWidth = 24;
        const guardY = platform.y - 15 - (guardHeight / 2); // rest guard bottom on platform top
        const guardX = platform.x;

        // pristine white body
        const bodyRect = this.add.rectangle(guardX, guardY, guardWidth, guardHeight, 0xf5f6fa);
        bodyRect.setStrokeStyle(1.5, 0xd4af37); // Gold trim
        bodyRect.setDepth(10);

        // carbon/obsidian core
        const coreRect = this.add.rectangle(guardX, guardY, 10, 18, 0x1a1d24);
        coreRect.setDepth(11);

        // dynamic status visor
        const visor = this.add.rectangle(guardX + 6, guardY - 8, 12, 4, 0x00f0ff);
        visor.setStrokeStyle(0.5, 0xffffff);
        visor.setDepth(12);

        // vision cone graphics
        const visionGraphics = this.add.graphics();
        visionGraphics.setDepth(5); // Render behind player and guards

        const direction = Math.random() > 0.5 ? 1 : -1;

        return {
            bodyRect,
            coreRect,
            visor,
            visionGraphics,
            platform,
            direction,
            speed: 50,
            alertState: 'patrol',
            alertLevel: 0,
            startX: platform.x - platform.width / 2 + 20,
            endX: platform.x + platform.width / 2 - 20
        };
    }

    private lineIntersectsLine(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): boolean
    {
        const den = (x4 - x3) * (y2 - y1) - (y4 - y3) * (x2 - x1);
        if (den === 0) return false;
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    private lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, rect: Phaser.GameObjects.Rectangle): boolean
    {
        const halfWidth = rect.width / 2;
        const halfHeight = rect.height / 2;
        const left = rect.x - halfWidth;
        const right = rect.x + halfWidth;
        const top = rect.y - halfHeight;
        const bottom = rect.y + halfHeight;

        // Check intersection with all 4 edges of the platform
        return this.lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) || // Top edge
               this.lineIntersectsLine(x1, y1, x2, y2, left, bottom, right, bottom) || // Bottom edge
               this.lineIntersectsLine(x1, y1, x2, y2, left, top, left, bottom) || // Left edge
               this.lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom);   // Right edge
    }

    private hasLineOfSight(startX: number, startY: number, endX: number, endY: number): boolean
    {
        let blocked = false;
        this.platforms.getChildren().forEach((platformChild: any) => {
            const platform = platformChild as Phaser.GameObjects.Rectangle;
            if (this.lineIntersectsRect(startX, startY, endX, endY, platform)) {
                blocked = true;
            }
        });
        return !blocked;
    }

    update(time: number, delta: number)
    {
        // Update loop purely drives the state machine
        this.stateMachine.step();

        const dt = delta ? delta / 1000 : 0.016;

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

        // --- CHRONOSTASIS (TIME-FREEZE) CHARGE LOOP ---
        const spaceHeld = this.cursors && this.cursors.space && this.cursors.space.isDown;

        if (spaceHeld && this.chronometerCharge > 0) {
            this.chronostasisActive = true;
            this.chronometerCharge = Math.max(0, this.chronometerCharge - 33.3 * dt); // Drains completely in 3 seconds
        } else {
            this.chronostasisActive = false;
            this.chronometerCharge = Math.min(100, this.chronometerCharge + 15 * dt); // Recharges completely in ~6.6 seconds
        }

        // Advance custom clock only if time is NOT frozen
        if (!this.chronostasisActive) {
            this.chronostasisTime += delta;
        }

        // Draw timepiece active chronometer ticks around the player's base
        this.timepieceAura.clear();
        this.timepieceAura.lineStyle(1.5, this.chronostasisActive ? 0xffb700 : 0xd4af37, 0.75);
        
        // Aura ticks spin much faster in Chronostasis!
        const dialTime = this.chronostasisActive ? (this.time.now * 0.01) : (this.time.now * 0.0025);
        const radius = 24;
        const centerX = this.player.x;
        const centerY = this.player.y + 24;
        
        // Render 8 rotating dials around the feet
        for (let i = 0; i < 8; i++) {
            const angle = dialTime + (i * Math.PI / 4);
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

        // --- CHRONOSTASIS SCREEN-WIDE VISUAL OVERLAYS ---
        this.chronostasisOverlay.clear();
        if (this.chronostasisActive) {
            // Translucent golden-amber full-screen overlay
            this.chronostasisOverlay.fillStyle(0xd4af37, 0.08 + Math.sin(time * 0.005) * 0.02);
            this.chronostasisOverlay.fillRect(0, 0, 1024, 768);

            // Pulsating golden vignette border
            const borderAlpha = 0.25 + Math.sin(time * 0.01) * 0.1;
            this.chronostasisOverlay.lineStyle(4 + Math.sin(time * 0.01) * 2, 0xd4af37, borderAlpha);
            this.chronostasisOverlay.strokeRect(0, 0, 1024, 768);

            // Massive high-tech rotating clockwork gears drawn in the background center
            this.chronostasisOverlay.lineStyle(1.5, 0xd4af37, 0.04);
            this.chronostasisOverlay.strokeCircle(512, 384, 200);
            this.chronostasisOverlay.strokeCircle(512, 384, 180);

            const gearRot = time * 0.0005;
            for (let i = 0; i < 12; i++) {
                const angle = gearRot + (i * Math.PI / 6);
                const sx = 512 + Math.cos(angle) * 180;
                const sy = 384 + Math.sin(angle) * 180;
                const ex = 512 + Math.cos(angle) * 200;
                const ey = 384 + Math.sin(angle) * 200;
                this.chronostasisOverlay.lineBetween(sx, sy, ex, ey);
            }
        }

        // --- CHRONOMETER TOP-LEFT HUD BATTERY CELL ---
        this.chronometerHUD.clear();
        const outlineHUDColor = this.chronostasisActive ? 0xffd700 : 0xffffff;
        const fillHUDColor = this.chronostasisActive ? 0xffb700 : 0x00f0ff; // Amber/Gold when draining, Cyan/Blue when charging

        // HUD Container
        this.chronometerHUD.fillStyle(0x0f1115, 0.75);
        this.chronometerHUD.fillRoundedRect(20, 38, 120, 14, 4);

        // HUD Border
        this.chronometerHUD.lineStyle(1.5, outlineHUDColor, 0.25);
        this.chronometerHUD.strokeRoundedRect(20, 38, 120, 14, 4);

        // Fill Progress
        const fillWidth = Math.round(112 * (this.chronometerCharge / 100));
        if (fillWidth > 0) {
            this.chronometerHUD.fillStyle(fillHUDColor, 0.9);
            this.chronometerHUD.fillRoundedRect(24, 41, fillWidth, 8, 2);
        }

        // Draw segmented ticks separation (power cells)
        this.chronometerHUD.lineStyle(1, 0x0f1115, 0.4);
        for (let i = 1; i < 5; i++) {
            const tx = 20 + 24 * i;
            this.chronometerHUD.lineBetween(tx, 38, tx, 52);
        }

        // --- CITADEL SECURITY GUARDS UPDATE LOOP ---
        let maxGuardAlert = 0;

        this.guards.forEach((guard) => {
            // 1. Alert State Adjustments & Speed
            if (guard.alertState === 'alert') {
                guard.speed = 0;
                guard.direction = this.player.x > guard.bodyRect.x ? 1 : -1;
            } else if (guard.alertState === 'suspicious') {
                guard.speed = 25; // Slower patrol when suspicious
            } else {
                guard.speed = 50; // Standard patrol speed
            }

            // 2. Patrol Movement (Disabled during active Chronostasis)
            if (guard.alertState !== 'alert' && !this.chronostasisActive) {
                guard.bodyRect.x += guard.direction * guard.speed * dt;

                // Rebound off boundaries
                if (guard.bodyRect.x <= guard.startX && guard.direction === -1) {
                    guard.direction = 1;
                } else if (guard.bodyRect.x >= guard.endX && guard.direction === 1) {
                    guard.direction = -1;
                }
            }

            // Clamp and update core + visor
            guard.bodyRect.x = Phaser.Math.Clamp(guard.bodyRect.x, guard.startX, guard.endX);
            guard.coreRect.x = guard.bodyRect.x;
            guard.visor.x = guard.bodyRect.x + guard.direction * 6;
            
            // 3. Vision Sweep Scanning Wedge (Freezes sweep angle when Chronostasis active)
            const baseAngle = guard.direction === 1 ? 0 : Math.PI;
            const sweepWobble = Math.sin(this.chronostasisTime * 0.003) * 0.25; // slow sinus sweep
            const lookAngle = baseAngle + sweepWobble;

            // Detection range is 250, FOV aperture is 45 degrees (+/- 22.5 deg)
            const range = 250;
            const halfFov = 0.392; // ~22.5 degrees in radians

            // 4. Line-of-Sight & Player Detection Check (Bypassed entirely in time-freeze!)
            const dist = Phaser.Math.Distance.Between(guard.bodyRect.x, guard.bodyRect.y, this.player.x, this.player.y);
            let playerDetected = false;

            if (dist <= range && !this.chronostasisActive) {
                const angleToPlayer = Math.atan2(this.player.y - guard.bodyRect.y, this.player.x - guard.bodyRect.x);
                const diff = Math.abs(Phaser.Math.Angle.Normalize(angleToPlayer - lookAngle));

                if (diff <= halfFov) {
                    // Raycast check to verify if solid platforms obscure vision
                    const hasLos = this.hasLineOfSight(guard.bodyRect.x, guard.bodyRect.y, this.player.x, this.player.y);
                    if (hasLos) {
                        playerDetected = true;
                    }
                }
            }

            // 5. Update Alert Meter
            if (playerDetected) {
                guard.alertLevel = Math.min(100, guard.alertLevel + 45 * dt); // Full alert in ~2.2s
            } else if (!this.chronostasisActive) {
                guard.alertLevel = Math.max(0, guard.alertLevel - 20 * dt); // Fades in 5 seconds
            }

            // Set alert state threshold boundaries
            let visorColor = 0x00f0ff; // Cyan (Patrol)
            let coneColor = 0x00f0ff;
            let coneAlpha = 0.15;

            if (guard.alertLevel >= 100) {
                guard.alertState = 'alert';
                visorColor = 0xff3333; // Red
                coneColor = 0xff3333;
                // Flashing red cone when fully alerted
                coneAlpha = 0.3 + Math.sin(time * 0.02) * 0.15;
            } else if (guard.alertLevel > 0) {
                guard.alertState = 'suspicious';
                visorColor = 0xffd700; // Gold/Yellow
                coneColor = 0xffd700;
                coneAlpha = 0.2 + (guard.alertLevel / 100) * 0.15; // grows denser as alert levels rise
            } else {
                guard.alertState = 'patrol';
            }

            guard.visor.setFillStyle(visorColor);

            // 6. Draw Translucent Vision Graphics
            guard.visionGraphics.clear();
            
            // Draw vision cone wedge
            guard.visionGraphics.fillStyle(coneColor, coneAlpha);
            guard.visionGraphics.beginPath();
            guard.visionGraphics.moveTo(guard.bodyRect.x, guard.bodyRect.y);
            guard.visionGraphics.arc(guard.bodyRect.x, guard.bodyRect.y, range, lookAngle - halfFov, lookAngle + halfFov);
            guard.visionGraphics.closePath();
            guard.visionGraphics.fillPath();

            // Draw a subtle outer arc line for high-tech premium aesthetics
            guard.visionGraphics.lineStyle(1.5, coneColor, coneAlpha * 1.5);
            guard.visionGraphics.beginPath();
            guard.visionGraphics.arc(guard.bodyRect.x, guard.bodyRect.y, range, lookAngle - halfFov, lookAngle + halfFov);
            guard.visionGraphics.strokePath();

            // Track highest alert level among all guards for global HUD
            if (guard.alertLevel > maxGuardAlert) {
                maxGuardAlert = guard.alertLevel;
            }
        });

        this.globalAlertLevel = maxGuardAlert;

        // --- GLOBAL ALERT HUD & SCREEN OVERLAYS ---
        this.alertUI.clear();

        if (this.globalAlertLevel > 0) {
            const meterX = this.player.x;
            const meterY = this.player.y - 45;

            // Draw Glassmorphic Container
            this.alertUI.fillStyle(0x0f1115, 0.75);
            this.alertUI.fillRoundedRect(meterX - 22, meterY - 4, 44, 8, 3);
            
            // Container thin gold/red trim
            const outlineColor = this.globalAlertLevel >= 100 ? 0xff3333 : 0xd4af37;
            this.alertUI.lineStyle(1, outlineColor, 0.4);
            this.alertUI.strokeRoundedRect(meterX - 22, meterY - 4, 44, 8, 3);

            // Draw Segmented Alert Level Progress Bar
            const barWidth = Math.round(40 * (this.globalAlertLevel / 100));
            const fillColor = this.globalAlertLevel >= 100 ? 0xff3333 : 0xffd700;
            this.alertUI.fillStyle(fillColor, 0.95);
            this.alertUI.fillRoundedRect(meterX - 20, meterY - 2, barWidth, 4, 2);

            // High-Tech Holographic Floating Warning Indicator [!]
            this.alertUI.fillStyle(fillColor, 0.7 + Math.sin(time * 0.01) * 0.2);
            // Floating diamond/triangle math coordinates
            const glowY = meterY - 14 + Math.sin(time * 0.005) * 2;
            
            this.alertUI.beginPath();
            this.alertUI.moveTo(meterX, glowY - 6);
            this.alertUI.lineTo(meterX + 5, glowY);
            this.alertUI.lineTo(meterX, glowY + 6);
            this.alertUI.lineTo(meterX - 5, glowY);
            this.alertUI.closePath();
            this.alertUI.fillPath();

            // Flashing global vignette at 100% alert
            if (this.globalAlertLevel >= 100) {
                // Red glowing border
                const flashWeight = 4 + Math.sin(time * 0.01) * 2;
                const flashAlpha = 0.35 + Math.sin(time * 0.01) * 0.15;
                this.alertUI.lineStyle(flashWeight, 0xff3333, flashAlpha);
                this.alertUI.strokeRect(0, 0, 1024, 768);

                // Make warning text visible
                this.alertText.setAlpha(0.6 + Math.sin(time * 0.015) * 0.4);
            } else {
                this.alertText.setAlpha(0);
            }
        } else {
            this.alertText.setAlpha(0);
        }

        // --- CITADEL MEMORY CORE HACKING SYSTEM ---
        const distToCore = Phaser.Math.Distance.Between(this.player.x, this.player.y, 512, 325);
        this.memoryCoreGraphics.clear();
        
        if (!this.memoryCoreHacked) {
            // Draw base glowing rotating rings around memory core
            this.memoryCoreGraphics.lineStyle(1.5, 0xd4af37, 0.4 + Math.sin(time * 0.005) * 0.1);
            this.memoryCoreGraphics.strokeCircle(512, 325, 25);
            this.memoryCoreGraphics.strokeCircle(512, 325, 20);
            
            const coreGearRot = time * 0.002;
            for (let i = 0; i < 6; i++) {
                const angle = coreGearRot + (i * Math.PI / 3);
                const sx = 512 + Math.cos(angle) * 20;
                const sy = 325 + Math.sin(angle) * 20;
                const ex = 512 + Math.cos(angle) * 25;
                const ey = 325 + Math.sin(angle) * 25;
                this.memoryCoreGraphics.lineBetween(sx, sy, ex, ey);
            }
            
            // Proximity interaction bounds
            if (distToCore < 50) {
                this.hackingText.setAlpha(1);
                const downHeld = this.cursors && this.cursors.down && this.cursors.down.isDown;
                const sHeld = this.sKey && this.sKey.isDown;
                
                if (downHeld || sHeld) {
                    this.hackingProgress = Math.min(100, this.hackingProgress + 33.3 * dt); // Takes exactly 3 seconds
                    
                    // Render beautiful progress arc ring around the core
                    const radius = 35;
                    this.memoryCoreGraphics.lineStyle(3, 0xffd700, 0.95);
                    this.memoryCoreGraphics.beginPath();
                    const startAngle = -Math.PI / 2;
                    const endAngle = startAngle + (Math.PI * 2 * (this.hackingProgress / 100));
                    this.memoryCoreGraphics.arc(512, 325, radius, startAngle, endAngle);
                    this.memoryCoreGraphics.strokePath();
                    
                    this.hackingText.setText(`HACKING CORE: ${Math.round(this.hackingProgress)}%`);
                    this.hackingText.setColor('#ffffff');
                    this.hackingText.setBackgroundColor('#d4af37cc');
                } else {
                    this.hackingProgress = Math.max(0, this.hackingProgress - 50 * dt);
                    this.hackingText.setText('[S] or [DOWN] TO HACK');
                    this.hackingText.setColor('#ffd700');
                    this.hackingText.setBackgroundColor('#0f1115e6');
                }
                
                if (this.hackingProgress >= 100) {
                    this.memoryCoreHacked = true;
                    this.memoryCore.setAlpha(0); // Base crystal core disappears
                    this.extractionActive = true;
                    this.hackingText.setAlpha(0);
                    
                    // Golden flash VFX burst
                    const flash = this.add.graphics();
                    flash.setDepth(9999);
                    flash.fillStyle(0xffd700, 0.85);
                    flash.fillCircle(512, 325, 50);
                    this.tweens.add({
                         targets: flash,
                         alpha: 0,
                         scaleX: 2.5,
                         scaleY: 2.5,
                         x: 512 * -1.5,
                         y: 325 * -1.5,
                         duration: 400,
                         onComplete: () => { flash.destroy(); }
                    });
                }
            } else {
                this.hackingProgress = Math.max(0, this.hackingProgress - 50 * dt);
                this.hackingText.setAlpha(0);
            }
        }

        // --- CITADEL EXTRACTION PORTAL LOOP ---
        this.extractionPortal.clear();
        if (this.extractionActive) {
            const portalX = 180;
            const portalY = 650;
            const portalWidth = 40;
            const portalHeight = 70;
            
            // Holographic golden portal base ellipse
            this.extractionPortal.fillStyle(0xd4af37, 0.15 + Math.sin(time * 0.01) * 0.05);
            this.extractionPortal.fillEllipse(portalX, portalY, portalWidth, portalHeight);
            
            this.extractionPortal.lineStyle(2, 0xffffff, 0.75 + Math.sin(time * 0.02) * 0.15);
            this.extractionPortal.strokeEllipse(portalX, portalY, portalWidth, portalHeight);
            
            // Animate rising gold line particles
            this.extractionPortal.lineStyle(1.5, 0xd4af37, 0.6);
            for (let i = 0; i < 5; i++) {
                const tOffset = (time * 0.06 + i * 20) % portalHeight;
                const px = portalX + Math.sin(time * 0.01 + i) * 12;
                const py = portalY + (portalHeight / 2) - tOffset;
                this.extractionPortal.lineBetween(px, py, px, py - 6);
            }
            
            // Draw floating interactive portal tooltip
            if (!this.sys.registry.has('portal_text')) {
                const pText = this.add.text(portalX, portalY - 55, 'EXTRACTION PORTAL ACTIVE', {
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    backgroundColor: '#0f1115e6',
                    padding: { x: 6, y: 3 }
                }).setOrigin(0.5).setDepth(10).setStroke('#0f1115', 2);
                this.sys.registry.set('portal_text', pText);
                
                this.tweens.add({
                    targets: pText,
                    y: portalY - 60,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
            
            // Escape portal boundary intersection
            const distToPortal = Phaser.Math.Distance.Between(this.player.x, this.player.y, portalX, portalY);
            if (distToPortal < 30) {
                this.player.setVelocity(0, 0);
                if (this.player.body) {
                    (this.player.body as Phaser.Physics.Arcade.Body).setEnable(false);
                }
                
                const winOverlay = this.add.rectangle(512, 384, 1024, 768, 0x0f1115);
                winOverlay.setDepth(99999);
                winOverlay.setAlpha(0);
                
                this.tweens.add({
                    targets: winOverlay,
                    alpha: 1,
                    duration: 600,
                    onComplete: () => {
                        if (this.sys.registry.has('portal_text')) {
                            const pText = this.sys.registry.get('portal_text');
                            pText.destroy();
                            this.sys.registry.remove('portal_text');
                        }
                        this.scene.start('GameOver', { status: 'victory', charge: this.chronometerCharge, alerts: this.globalAlertLevel });
                    }
                });
            }
        }

        // --- Patrolling Guard Collision & Capture Triggers ---
        this.guards.forEach((guard) => {
            if (guard.alertState === 'alert') {
                const playerBounds = this.playerRect.getBounds();
                const guardBounds = guard.bodyRect.getBounds();
                
                if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, guardBounds)) {
                    this.player.setVelocity(0, 0);
                    if (this.player.body) {
                        (this.player.body as Phaser.Physics.Arcade.Body).setEnable(false);
                    }
                    
                    const failOverlay = this.add.rectangle(512, 384, 1024, 768, 0xff3333, 0.45);
                    failOverlay.setDepth(99999);
                    
                    this.tweens.add({
                        targets: failOverlay,
                        alpha: 1,
                        duration: 300,
                        onComplete: () => {
                            if (this.sys.registry.has('portal_text')) {
                                const pText = this.sys.registry.get('portal_text');
                                pText.destroy();
                                this.sys.registry.remove('portal_text');
                            }
                            failOverlay.destroy();
                            this.scene.start('GameOver', { status: 'defeat' });
                        }
                    });
                }
            }
        });
    }
}

