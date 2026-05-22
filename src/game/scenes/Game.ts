import { Scene, Input } from 'phaser';
import { StateMachine } from '../PlayerStateMachine';
import { IdleState, RunState, JumpState, WallSlideState, DashState } from '../PlayerStates';

// ─── INTERFACES ──────────────────────────────────────────────────────────────

interface CitadelGuard {
    type: 'pmc' | 'agent';
    bodyRect: Phaser.GameObjects.Rectangle;       // Invisible physics position anchor
    guardGraphics: Phaser.GameObjects.Graphics;   // Drawn character
    healthBar: Phaser.GameObjects.Graphics;       // HP bar above head
    visionGraphics: Phaser.GameObjects.Graphics;  // Detection cone
    platform: Phaser.GameObjects.Rectangle;
    direction: number;      // 1 = right, -1 = left
    speed: number;
    alertState: 'patrol' | 'suspicious' | 'alert';
    alertLevel: number;     // 0 to 100
    startX: number;
    endX: number;
    health: number;         // 2 = full, 1 = one hit, 0 = dead
    firstHitTime: number;   // ms timestamp of first bullet hit (2-shot window)
    lastGuardShotTime: number;
    alive: boolean;
}

interface Bullet {
    graphic: Phaser.GameObjects.Rectangle;
    vx: number;
    vy: number;
    isPlayerBullet: boolean;
    active: boolean;
    damage: number;
}

interface WeaponPickup {
    type: 'pistol' | 'smg' | 'rifle';
    graphic: Phaser.GameObjects.Graphics;
    prompt: Phaser.GameObjects.Text;
    x: number;
    y: number;
    collected: boolean;
}

interface AmmoDrop {
    type: 'pistol' | 'smg' | 'rifle';
    graphic: Phaser.GameObjects.Graphics;
    x: number;
    y: number;
    rounds: number;
    collected: boolean;
}

// ─── GAME SCENE ──────────────────────────────────────────────────────────────

export class Game extends Scene {

    // Camera
    camera: Phaser.Cameras.Scene2D.Camera;

    // Player — invisible physics body
    player!: Phaser.Physics.Arcade.Sprite;
    playerGraphics!: Phaser.GameObjects.Graphics;
    playerFacingRight: boolean = true;

    // Player health
    playerHP: number = 100;
    playerMaxHP: number = 100;
    playerDefeated: boolean = false;
    playerInvincible: boolean = false;
    lastDamageTime: number = 0;
    playerHealthBar!: Phaser.GameObjects.Graphics;
    playerHealthText!: Phaser.GameObjects.Text;

    // Platforms
    platforms!: Phaser.Physics.Arcade.StaticGroup;

    // Input
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    sKey!: Phaser.Input.Keyboard.Key;
    eKey!: Phaser.Input.Keyboard.Key;
    fKey!: Phaser.Input.Keyboard.Key;
    key1!: Phaser.Input.Keyboard.Key;
    key2!: Phaser.Input.Keyboard.Key;
    key3!: Phaser.Input.Keyboard.Key;
    key4!: Phaser.Input.Keyboard.Key;

    // State machine
    stateMachine!: StateMachine;

    // Weapon system
    currentWeapon: 'knife' | 'pistol' | 'smg' | 'rifle' = 'knife';
    weaponInventory: string[] = ['knife'];
    ammo: { pistol: number; smg: number; rifle: number } = { pistol: 0, smg: 0, rifle: 0 };

    // Double-tap dash detection
    lastLeftTapTime: number = 0;
    lastRightTapTime: number = 0;
    dashRequested: boolean = false;
    readonly DOUBLE_TAP_WINDOW: number = 280;

    // Bullets
    bullets: Bullet[] = [];
    lastPlayerShotTime: number = 0;

    // Guards
    guards: CitadelGuard[] = [];
    alertUI!: Phaser.GameObjects.Graphics;
    alertText!: Phaser.GameObjects.Text;
    globalAlertLevel: number = 0;

    // Pickups
    weaponPickups: WeaponPickup[] = [];
    ammoDrops: AmmoDrop[] = [];

    // Chronostasis (time-freeze)
    chronometerCharge: number = 100;
    chronostasisActive: boolean = false;
    chronostasisTime: number = 0;
    chronostasisOverlay!: Phaser.GameObjects.Graphics;
    chronometerHUD!: Phaser.GameObjects.Graphics;
    chronometerHUDText!: Phaser.GameObjects.Text;

    // Server terminal (mission objective)
    terminalGraphics!: Phaser.GameObjects.Graphics;
    terminalX: number = 600;
    terminalY: number = 300;
    terminalHacked: boolean = false;
    hackingProgress: number = 0;
    hackingText!: Phaser.GameObjects.Text;

    // Helipad extraction
    helipadGraphics!: Phaser.GameObjects.Graphics;
    helipadX: number = 895;
    helipadY: number = 440;
    extractionActive: boolean = false;

    // HUD
    weaponHUD!: Phaser.GameObjects.Graphics;
    weaponHUDTexts: Phaser.GameObjects.Text[] = [];

    constructor() {
        super('Game');
    }

    // ─── ROOFTOP PLATFORM BUILDER ─────────────────────────────────────────────

    createRooftop(x: number, y: number, width: number, height: number = 20): Phaser.GameObjects.Rectangle {
        const rect = this.add.rectangle(x, y, width, height, 0x1e2130);
        this.physics.add.existing(rect, true);
        this.platforms.add(rect);

        const left = x - width / 2;
        const top  = y - height / 2;

        const g = this.add.graphics();
        g.setDepth(4);

        // Concrete slab body
        g.fillStyle(0x1e2130, 1);
        g.fillRect(left, top, width, height);

        // Lighter top ledge strip
        g.fillStyle(0x2d3348, 1);
        g.fillRect(left, top, width, 3);

        // Left parapet bump
        g.fillStyle(0x252b3d, 1);
        g.fillRect(left, top - 9, 7, 9);
        // Right parapet bump
        g.fillRect(left + width - 7, top - 9, 7, 9);

        // Neon cyan trim on front face
        g.fillStyle(0x00f0ff, 0.18);
        g.fillRect(left, top + height - 2, width, 2);

        // HVAC unit (on wider platforms)
        if (width > 100) {
            const hvacX = left + 18;
            const hvacTop = top - 14;
            g.fillStyle(0x2a2f3e, 1);
            g.fillRect(hvacX, hvacTop, 22, 14);
            // Vent lines
            g.lineStyle(1, 0x181d2c, 1);
            for (let i = 0; i < 4; i++) {
                g.lineBetween(hvacX + 3 + i * 5, hvacTop + 3, hvacX + 3 + i * 5, hvacTop + 11);
            }
            // Second HVAC on large platforms
            if (width > 160) {
                const hvac2X = left + width - 50;
                g.fillStyle(0x2a2f3e, 1);
                g.fillRect(hvac2X, hvacTop, 20, 12);
                for (let i = 0; i < 3; i++) {
                    g.lineBetween(hvac2X + 3 + i * 5, hvacTop + 3, hvac2X + 3 + i * 5, hvacTop + 9);
                }
            }
        }

        // Zero out friction on the physics body
        const body = (rect as any).body as any;
        if (body?.friction) body.friction.set(0, 0);

        return rect;
    }

    // ─── PROCEDURAL CITY SKYLINE ──────────────────────────────────────────────

    drawCityBackground() {
        // Sky
        const sky = this.add.graphics();
        sky.setDepth(0);
        sky.setScrollFactor(0);
        sky.fillStyle(0x070a13, 1);
        sky.fillRect(0, 0, 1024, 768);
        // Horizon purple haze
        sky.fillGradientStyle(0x1a1040, 0x1a1040, 0x070a13, 0x070a13, 0.55);
        sky.fillRect(0, 320, 1024, 450);

        // ── Layer 1: Far skyscrapers ──
        const far = this.add.graphics();
        far.setDepth(1);
        far.setScrollFactor(0.08);

        const farBuildings = [
            { x: 30, w: 70, h: 310 }, { x: 115, w: 50, h: 240 },
            { x: 175, w: 95, h: 390 }, { x: 285, w: 55, h: 270 },
            { x: 355, w: 85, h: 340 }, { x: 455, w: 65, h: 430 },
            { x: 540, w: 105, h: 370 }, { x: 660, w: 60, h: 290 },
            { x: 735, w: 80, h: 410 }, { x: 830, w: 50, h: 255 },
            { x: 895, w: 75, h: 330 }, { x: 980, w: 55, h: 380 },
        ];
        farBuildings.forEach(({ x, w, h }) => {
            const t = 710 - h;
            far.fillStyle(0x0d1120, 1);
            far.fillRect(x, t, w, h);
            // Randomised window light strips
            const windowColors = [0xffd700, 0x06b6d4, 0x8b5cf6];
            for (let row = 8; row < h - 8; row += 16) {
                if ((x * 7 + row * 3) % 5 > 1) {
                    far.fillStyle(windowColors[(x + row) % 3], 0.12);
                    far.fillRect(x + 5, t + row, w - 10, 5);
                }
            }
            // Neon roof strip on some buildings
            if ((x * 13) % 3 === 0) {
                far.fillStyle(0x8b5cf6, 0.35);
                far.fillRect(x, t, w, 3);
            }
        });

        // ── Layer 2: Mid buildings ──
        const mid = this.add.graphics();
        mid.setDepth(2);
        mid.setScrollFactor(0.18);

        const midBuildings = [
            { x: 0,   w: 110, h: 195 }, { x: 185, w: 85, h: 155 },
            { x: 370, w: 130, h: 215 }, { x: 570, w: 95, h: 175 },
            { x: 775, w: 120, h: 200 }, { x: 940, w: 85, h: 165 },
        ];
        midBuildings.forEach(({ x, w, h }) => {
            const t = 710 - h;
            mid.fillStyle(0x121a28, 1);
            mid.fillRect(x, t, w, h);
            // Amber floor glow strips
            for (let row = 12; row < h - 12; row += 20) {
                if ((x + row) % 3 !== 0) {
                    mid.fillStyle(0xfbbf24, 0.09);
                    mid.fillRect(x + 5, t + row, w - 10, 7);
                }
            }
            // Cyan neon top trim
            if ((x * 7) % 2 === 0) {
                mid.fillStyle(0x06b6d4, 0.3);
                mid.fillRect(x, t, w, 2);
            }
        });

        // ── Layer 3: Ground fog / haze ──
        const haze = this.add.graphics();
        haze.setDepth(3);
        haze.setScrollFactor(0);
        haze.fillGradientStyle(0x070a13, 0x070a13, 0x070a13, 0x070a13, 0, 0, 0.75, 0.75);
        haze.fillRect(0, 540, 1024, 230);
        // Street-level neon glow
        haze.fillStyle(0x003d7a, 0.1);
        haze.fillRect(0, 690, 1024, 80);
    }

    // ─── GUARD FACTORY ────────────────────────────────────────────────────────

    createGuard(platform: Phaser.GameObjects.Rectangle, type: 'pmc' | 'agent'): CitadelGuard {
        const gh = 40, gw = 20;
        const guardY = platform.y - platform.height / 2 - gh / 2 - 1;
        const guardX = platform.x;

        // Invisible anchor rect (no alpha — zero opacity)
        const bodyRect = this.add.rectangle(guardX, guardY, gw, gh, 0x000000, 0);
        bodyRect.setDepth(0);

        const guardGraphics = this.add.graphics();
        guardGraphics.setDepth(12);

        const healthBar = this.add.graphics();
        healthBar.setDepth(13);

        const visionGraphics = this.add.graphics();
        visionGraphics.setDepth(5);

        return {
            type,
            bodyRect,
            guardGraphics,
            healthBar,
            visionGraphics,
            platform,
            direction: Math.random() > 0.5 ? 1 : -1,
            speed: 45,
            alertState: 'patrol',
            alertLevel: 0,
            startX: platform.x - platform.width / 2 + 16,
            endX:   platform.x + platform.width / 2 - 16,
            health: 2,
            firstHitTime: 0,
            lastGuardShotTime: 0,
            alive: true,
        };
    }

    // ─── WEAPON PICKUP FACTORY ────────────────────────────────────────────────

    createWeaponPickup(type: 'pistol' | 'smg' | 'rifle', x: number, y: number) {
        const color = type === 'pistol' ? 0xfbbf24 : type === 'smg' ? 0x3b82f6 : 0x8b5cf6;
        const g = this.add.graphics();
        g.setDepth(8);

        // Gun silhouette
        const barLen = type === 'pistol' ? 11 : type === 'smg' ? 16 : 22;
        g.fillStyle(color, 0.9);
        g.fillRect(x - 6, y - 3, 9, 7);       // grip/body
        g.fillRect(x + 3, y - 2, barLen, 3);   // barrel
        if (type === 'smg') {
            g.fillRect(x + 5, y + 1, 3, 5);    // front grip stub
        }
        // Glow halo
        g.fillStyle(color, 0.18);
        g.fillCircle(x + barLen / 2, y, 14);

        const prompt = this.add.text(x, y - 24, `[E] PICK UP ${type.toUpperCase()}`, {
            fontFamily: 'monospace', fontSize: '10px', color: '#ffffff',
            backgroundColor: '#0d1117cc', padding: { x: 4, y: 2 }
        }).setOrigin(0.5).setDepth(12).setAlpha(0);

        this.weaponPickups.push({ type, graphic: g, prompt, x, y, collected: false });
    }

    // ─── DRAW: PLAYER CHARACTER ───────────────────────────────────────────────

    drawPlayer() {
        this.playerGraphics.clear();
        const cx = this.player.x;
        const cy = this.player.y;
        const d  = this.playerFacingRight ? 1 : -1;

        // ── Head ──
        this.playerGraphics.fillStyle(0x2a1f1a, 1); // dark skin
        this.playerGraphics.fillCircle(cx, cy - 19, 7);
        // Face mask (lower half of face)
        this.playerGraphics.fillStyle(0x18191f, 1);
        this.playerGraphics.fillRect(cx - 6, cy - 18, 12, 7);

        // ── Jacket / Shoulders ──
        this.playerGraphics.fillStyle(0x1c2030, 1);
        this.playerGraphics.fillRect(cx - 12, cy - 13, 24, 6); // shoulders
        this.playerGraphics.fillRect(cx - 9, cy - 7, 18, 14);  // torso

        // Jacket centre seam line
        this.playerGraphics.lineStyle(1, 0x2d3348, 1);
        this.playerGraphics.lineBetween(cx, cy - 7, cx, cy + 7);

        // ── Watch glow on wrist ──
        const watchX = cx - d * 8;
        const watchY = cy + 2;
        const wp = this.chronostasisActive ? (0.6 + Math.sin(this.time.now * 0.01) * 0.4) : 0.85;
        this.playerGraphics.fillStyle(0xf59e0b, wp);
        this.playerGraphics.fillCircle(watchX, watchY, 3);

        if (this.chronostasisActive) {
            const ring = 5 + Math.sin(this.time.now * 0.008) * 2;
            this.playerGraphics.lineStyle(1.5, 0xf59e0b, 0.35 + Math.sin(this.time.now * 0.008) * 0.25);
            this.playerGraphics.strokeCircle(watchX, watchY, ring);
        }

        // ── Weapon Arm ──
        const armY = cy + 1;
        if (this.currentWeapon === 'knife') {
            // Arm
            this.playerGraphics.fillStyle(0x1c2030, 1);
            this.playerGraphics.fillRect(cx + d * 8, armY - 2, d * 5, 5);
            // Knife blade
            this.playerGraphics.lineStyle(1.5, 0xd1d5db, 1);
            this.playerGraphics.lineBetween(cx + d * 13, armY - 4, cx + d * 22, armY - 11);
            // Blade glint
            this.playerGraphics.lineStyle(1, 0xffffff, 0.5);
            this.playerGraphics.lineBetween(cx + d * 14, armY - 5, cx + d * 17, armY - 8);
        } else {
            // Arm
            this.playerGraphics.fillStyle(0x1c2030, 1);
            this.playerGraphics.fillRect(cx + d * 8, armY - 2, d * 7, 5);
            // Gun body
            const bLen = this.currentWeapon === 'pistol' ? 9 : this.currentWeapon === 'smg' ? 15 : 22;
            const gunX = cx + d * 15;
            this.playerGraphics.fillStyle(0x181d28, 1);
            this.playerGraphics.fillRect(gunX, armY - 3, d * 5, 7);      // grip
            this.playerGraphics.fillRect(gunX + d * 5, armY - 2, d * bLen, 3); // barrel
            if (this.currentWeapon === 'smg') {
                this.playerGraphics.fillRect(gunX + d * 7, armY + 1, d * 3, 5); // grip stub
            }
            if (this.currentWeapon === 'rifle') {
                this.playerGraphics.fillStyle(0xff2222, 1);
                this.playerGraphics.fillCircle(gunX + d * 10, armY - 2, 2); // scope dot
            }
        }

        // ── Legs ──
        this.playerGraphics.fillStyle(0x151825, 1);
        this.playerGraphics.fillRect(cx - 8, cy + 7, 7, 14);
        this.playerGraphics.fillRect(cx + 1, cy + 7, 7, 14);

        // ── Boots ──
        this.playerGraphics.fillStyle(0x0e111a, 1);
        this.playerGraphics.fillRect(cx - 9, cy + 19, 8, 5);
        this.playerGraphics.fillRect(cx,     cy + 19, 8, 5);

        // ── Damage flash ──
        if (this.playerInvincible && Math.floor(this.time.now / 80) % 2 === 0) {
            this.playerGraphics.fillStyle(0xff3333, 0.4);
            this.playerGraphics.fillRect(cx - 10, cy - 26, 20, 50);
        }
    }

    // ─── DRAW: GUARD CHARACTER ────────────────────────────────────────────────

    drawGuard(guard: CitadelGuard) {
        guard.guardGraphics.clear();
        guard.healthBar.clear();

        if (!guard.alive) return;

        const cx = guard.bodyRect.x;
        const cy = guard.bodyRect.y;

        // Alert-state colours
        const visorColor  = guard.alertState === 'alert' ? 0xff3333 :
                            guard.alertState === 'suspicious' ? 0xffd700 : 0x00f0ff;
        const bodyColor   = guard.type === 'pmc' ? 0x0a0c10 : 0x0f1e3d;
        const accentColor = guard.type === 'pmc' ? 0xcc0000 : 0xc0c0c0;

        // ── Helmet dome ──
        guard.guardGraphics.fillStyle(bodyColor, 1);
        guard.guardGraphics.fillCircle(cx, cy - 15, 8);
        guard.guardGraphics.fillRect(cx - 8, cy - 15, 16, 9);

        // Visor strip
        guard.guardGraphics.fillStyle(visorColor, 0.88);
        guard.guardGraphics.fillRect(cx - 6, cy - 17, 12, 4);

        // Agent badge
        if (guard.type === 'agent') {
            guard.guardGraphics.fillStyle(0xc0c0c0, 0.75);
            guard.guardGraphics.fillRect(cx - 3, cy - 9, 6, 3);
        }

        // ── Tactical vest / body ──
        guard.guardGraphics.fillStyle(bodyColor, 1);
        guard.guardGraphics.fillRect(cx - 8, cy - 6, 16, 14);

        // Shoulder stripes
        guard.guardGraphics.fillStyle(accentColor, 0.9);
        guard.guardGraphics.fillRect(cx - 8, cy - 6, 4, 6);
        guard.guardGraphics.fillRect(cx + 4, cy - 6, 4, 6);

        // ── Weapon arm ──
        const aimDir = (guard.alertState === 'alert') ? (this.player.x > cx ? 1 : -1) : guard.direction;
        const barLen = guard.type === 'pmc' ? 13 : 9;

        guard.guardGraphics.fillStyle(bodyColor, 1);
        guard.guardGraphics.fillRect(cx + aimDir * 8, cy - 2, aimDir * 6, 5);  // arm
        guard.guardGraphics.fillStyle(0x181d28, 1);
        guard.guardGraphics.fillRect(cx + aimDir * 14, cy - 1, aimDir * barLen, 3); // barrel
        if (guard.type === 'pmc') {
            guard.guardGraphics.fillRect(cx + aimDir * 16, cy + 2, aimDir * 3, 5); // smg grip
        }

        // ── Legs ──
        const legColor = guard.type === 'pmc' ? 0x0a0c10 : 0x1e2535;
        guard.guardGraphics.fillStyle(legColor, 1);
        guard.guardGraphics.fillRect(cx - 7, cy + 8, 6, 12);
        guard.guardGraphics.fillRect(cx + 1, cy + 8, 6, 12);

        // ── Boots ──
        guard.guardGraphics.fillStyle(0x0e111a, 1);
        guard.guardGraphics.fillRect(cx - 8, cy + 18, 7, 4);
        guard.guardGraphics.fillRect(cx + 1, cy + 18, 7, 4);

        // ── Health bar (only visible after first hit) ──
        if (guard.health < 2) {
            const bw = 24, bh = 4;
            const bx = cx - bw / 2, by = cy - 34;
            guard.healthBar.fillStyle(0x1a1d24, 0.9);
            guard.healthBar.fillRect(bx, by, bw, bh);
            guard.healthBar.fillStyle(0xf97316, 1);
            guard.healthBar.fillRect(bx, by, (guard.health / 2) * bw, bh);
            guard.healthBar.lineStyle(1, 0xff6b35, 0.7);
            guard.healthBar.strokeRect(bx, by, bw, bh);
        }
    }

    // ─── DRAW: SERVER TERMINAL ────────────────────────────────────────────────

    drawServerTerminal(time: number) {
        if (this.terminalHacked) return;
        this.terminalGraphics.clear();

        const tx = this.terminalX, ty = this.terminalY;

        // Rack body
        this.terminalGraphics.fillStyle(0x0d1117, 1);
        this.terminalGraphics.fillRect(tx - 14, ty - 18, 28, 36);
        this.terminalGraphics.lineStyle(1.5, 0x1e2535, 1);
        this.terminalGraphics.strokeRect(tx - 14, ty - 18, 28, 36);

        // Amber screen
        this.terminalGraphics.fillStyle(0xf59e0b, 0.13);
        this.terminalGraphics.fillRect(tx - 10, ty - 14, 20, 20);
        // Animated scanline
        const scan = ((time * 0.05) % 20);
        this.terminalGraphics.fillStyle(0xf59e0b, 0.32);
        this.terminalGraphics.fillRect(tx - 10, ty - 14 + scan, 20, 2);

        // LED indicators
        const ledCols = [0x22c55e, 0xf59e0b, 0xf59e0b, 0xef4444];
        for (let i = 0; i < 4; i++) {
            const blink = Math.floor(time * 0.004 + i) % 2 === 0;
            this.terminalGraphics.fillStyle(ledCols[i], blink ? 0.9 : 0.25);
            this.terminalGraphics.fillCircle(tx - 8 + i * 6, ty + 12, 2);
        }

        // Outer pulse glow
        const pulse = 0.18 + Math.sin(time * 0.005) * 0.08;
        this.terminalGraphics.lineStyle(1.5, 0xf59e0b, pulse);
        this.terminalGraphics.strokeCircle(tx, ty, 24);
    }

    // ─── DRAW: HELIPAD ────────────────────────────────────────────────────────

    drawHelipad(time: number) {
        this.helipadGraphics.clear();
        const hx = this.helipadX, hy = this.helipadY;

        // Base landing circle
        this.helipadGraphics.fillStyle(0x1a2a1a, 1);
        this.helipadGraphics.fillCircle(hx, hy, 26);
        this.helipadGraphics.lineStyle(2, 0x2d4a2d, 1);
        this.helipadGraphics.strokeCircle(hx, hy, 26);
        this.helipadGraphics.lineStyle(1, 0x3a5a3a, 0.5);
        this.helipadGraphics.strokeCircle(hx, hy, 19);

        if (!this.extractionActive) return;

        // Rotating dashed beacon ring
        const rot = time * 0.003;
        this.helipadGraphics.lineStyle(2.5, 0x22c55e, 0.65 + Math.sin(time * 0.01) * 0.2);
        for (let i = 0; i < 8; i++) {
            if (i % 2 === 0) {
                const a1 = rot + (i * Math.PI / 4);
                const a2 = a1 + 0.35;
                this.helipadGraphics.beginPath();
                this.helipadGraphics.arc(hx, hy, 31, a1, a2);
                this.helipadGraphics.strokePath();
            }
        }

        // Green ground pulse
        this.helipadGraphics.fillStyle(0x22c55e, 0.08 + Math.sin(time * 0.008) * 0.04);
        this.helipadGraphics.fillCircle(hx, hy, 33);

        // Blinking centre beacon
        if (Math.floor(time * 0.004) % 2 === 0) {
            this.helipadGraphics.fillStyle(0x22c55e, 1);
            this.helipadGraphics.fillCircle(hx, hy, 4);
        }
    }

    // ─── KNIFE ASSASSINATION ──────────────────────────────────────────────────

    checkKnifeAssassination() {
        const pw = 20, ph = 40;
        this.guards.forEach(guard => {
            if (!guard.alive) return;
            const gw = 20, gh = 40;
            const overlap =
                this.player.x + pw / 2 > guard.bodyRect.x - gw / 2 &&
                this.player.x - pw / 2 < guard.bodyRect.x + gw / 2 &&
                this.player.y + ph / 2 > guard.bodyRect.y - gh / 2 &&
                this.player.y - ph / 2 < guard.bodyRect.y + gh / 2;
            if (overlap) {
                this.killGuard(guard, true);
            }
        });
    }

    // ─── KILL GUARD ───────────────────────────────────────────────────────────

    killGuard(guard: CitadelGuard, silent: boolean) {
        if (!guard.alive) return;
        guard.alive = false;
        guard.health = 0;

        // Collapse tween
        this.tweens.add({
            targets: [guard.guardGraphics, guard.healthBar, guard.visionGraphics],
            alpha: 0,
            duration: 380,
            ease: 'Power2',
        });

        // Impact flash
        const flash = this.add.graphics();
        flash.setDepth(20);
        flash.fillStyle(silent ? 0xffffff : 0xff4444, 0.65);
        flash.fillCircle(guard.bodyRect.x, guard.bodyRect.y, 12);
        this.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });

        // Ammo drop
        this.spawnAmmoDrop(guard.bodyRect.x, guard.bodyRect.y + 20, guard.type === 'pmc' ? 'smg' : 'pistol');
    }

    // ─── AMMO DROP ────────────────────────────────────────────────────────────

    spawnAmmoDrop(x: number, y: number, type: 'pistol' | 'smg' | 'rifle') {
        const color = type === 'smg' ? 0x3b82f6 : type === 'rifle' ? 0x8b5cf6 : 0xfbbf24;
        const g = this.add.graphics();
        g.setDepth(8);
        g.fillStyle(color, 0.85);
        g.fillRect(x - 9, y - 4, 18, 8);
        g.lineStyle(1, 0xffffff, 0.4);
        g.strokeRect(x - 9, y - 4, 18, 8);
        g.fillStyle(color, 0.2);
        g.fillCircle(x, y, 13);

        const rounds = type === 'smg' ? 15 : type === 'rifle' ? 5 : 6;
        this.ammoDrops.push({ type, graphic: g, x, y, rounds, collected: false });
    }

    // ─── FIRE PLAYER BULLET ───────────────────────────────────────────────────

    firePlayerBullet() {
        const now = this.time.now;
        const cooldown = this.currentWeapon === 'smg' ? 200 :
                         this.currentWeapon === 'rifle' ? 700 : 400;
        if (now - this.lastPlayerShotTime < cooldown) return;

        const key = this.currentWeapon as 'pistol' | 'smg' | 'rifle';
        if (this.currentWeapon !== 'pistol' && this.ammo[key] <= 0) {
            // Show empty notification
            const noAmmo = this.add.text(this.player.x, this.player.y - 45, 'NO AMMO', {
                fontFamily: 'monospace', fontSize: '11px', color: '#ef4444',
                backgroundColor: '#0d1117cc', padding: { x: 4, y: 2 }
            }).setOrigin(0.5).setDepth(200);
            this.tweens.add({ targets: noAmmo, alpha: 0, y: noAmmo.y - 20, duration: 800, onComplete: () => noAmmo.destroy() });
            return;
        }

        if (this.currentWeapon !== 'pistol') this.ammo[key]--;
        this.lastPlayerShotTime = now;

        const speed = this.currentWeapon === 'rifle' ? 1200 :
                      this.currentWeapon === 'smg'   ? 900 : 700;
        const dir = this.playerFacingRight ? 1 : -1;

        const bg = this.add.rectangle(this.player.x + dir * 22, this.player.y, 7, 2, 0xffffff);
        bg.setDepth(15);
        this.bullets.push({ graphic: bg, vx: speed * dir, vy: 0, isPlayerBullet: true, active: true, damage: 0 });

        // Noise alerting (pistol is suppressed)
        if (this.currentWeapon !== 'pistol') {
            const noiseR = this.currentWeapon === 'smg' ? 260 : 330;
            this.guards.forEach(g => {
                if (!g.alive) return;
                const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, g.bodyRect.x, g.bodyRect.y);
                if (dist <= noiseR && g.alertState === 'patrol') {
                    g.alertLevel = Math.min(100, g.alertLevel + 55);
                }
            });
        }
    }

    // ─── PLAYER DAMAGE ────────────────────────────────────────────────────────

    damagePlayer(amount: number) {
        if (this.playerInvincible || this.playerDefeated) return;
        this.playerHP = Math.max(0, this.playerHP - amount);
        this.playerInvincible = true;
        this.lastDamageTime = this.time.now;
        this.cameras.main.shake(130, 0.007);

        if (this.playerHP <= 0) {
            this.playerDefeated = true;
            this.triggerDefeat();
        }
    }

    // ─── TRIGGER DEFEAT ───────────────────────────────────────────────────────

    triggerDefeat() {
        this.player.setVelocity(0, 0);
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        if (body) body.setEnable(false);

        const overlay = this.add.rectangle(512, 384, 1024, 768, 0xff2222, 0);
        overlay.setDepth(99999);
        this.tweens.add({
            targets: overlay, alpha: 0.7, duration: 500, ease: 'Power2',
            onComplete: () => {
                this.cleanupRegistry();
                overlay.destroy();
                this.scene.start('GameOver', { status: 'defeat' });
            }
        });
    }

    // ─── LOS HELPERS ──────────────────────────────────────────────────────────

    private lineIntersectsLine(x1: number, y1: number, x2: number, y2: number,
                                x3: number, y3: number, x4: number, y4: number): boolean {
        const den = (x4 - x3) * (y2 - y1) - (y4 - y3) * (x2 - x1);
        if (den === 0) return false;
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    private lineIntersectsRect(x1: number, y1: number, x2: number, y2: number,
                                rect: Phaser.GameObjects.Rectangle): boolean {
        const hw = rect.width / 2, hh = rect.height / 2;
        const l = rect.x - hw, r = rect.x + hw, t = rect.y - hh, b = rect.y + hh;
        return this.lineIntersectsLine(x1, y1, x2, y2, l, t, r, t) ||
               this.lineIntersectsLine(x1, y1, x2, y2, l, b, r, b) ||
               this.lineIntersectsLine(x1, y1, x2, y2, l, t, l, b) ||
               this.lineIntersectsLine(x1, y1, x2, y2, r, t, r, b);
    }

    private hasLineOfSight(sx: number, sy: number, ex: number, ey: number): boolean {
        let blocked = false;
        this.platforms.getChildren().forEach((child: any) => {
            if (this.lineIntersectsRect(sx, sy, ex, ey, child as Phaser.GameObjects.Rectangle)) {
                blocked = true;
            }
        });
        return !blocked;
    }

    private cleanupRegistry() {
        ['extract_text'].forEach(key => {
            if (this.sys.registry.has(key)) {
                const obj = this.sys.registry.get(key);
                obj?.destroy?.();
                this.sys.registry.remove(key);
            }
        });
    }

    // ─── DASH GHOST TRAIL ─────────────────────────────────────────────────────

    createDashGhost() {
        const ghost = this.add.rectangle(this.player.x, this.player.y, 20, 40, 0x1c2030, 0.32);
        ghost.setDepth(14);
        this.tweens.add({
            targets: ghost, alpha: 0, scaleX: 0.5, duration: 160,
            onComplete: () => ghost.destroy()
        });
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    create() {
        console.log('[Game] create() — full overhaul build');

        // Hard reset all state
        this.chronometerCharge = 100;
        this.chronostasisActive = false;
        this.chronostasisTime   = 0;
        this.globalAlertLevel   = 0;
        this.terminalHacked     = false;
        this.hackingProgress    = 0;
        this.extractionActive   = false;
        this.guards             = [];
        this.bullets            = [];
        this.weaponPickups      = [];
        this.ammoDrops          = [];
        this.playerHP           = 100;
        this.playerDefeated     = false;
        this.playerInvincible   = false;
        this.currentWeapon      = 'knife';
        this.weaponInventory    = ['knife'];
        this.ammo               = { pistol: 0, smg: 0, rifle: 0 };
        this.lastLeftTapTime    = 0;
        this.lastRightTapTime   = 0;
        this.dashRequested      = false;
        this.playerFacingRight  = true;
        this.lastPlayerShotTime = 0;

        this.cleanupRegistry();

        // Fade-in overlay
        const fadeIn = this.add.rectangle(512, 384, 1024, 768, 0x070a13);
        fadeIn.setDepth(99999);
        this.tweens.add({ targets: fadeIn, alpha: 0, duration: 550, ease: 'Power2', onComplete: () => fadeIn.destroy() });

        this.camera = this.cameras.main;

        // ── Background ──
        this.drawCityBackground();

        // ── Platforms ──
        this.platforms = this.physics.add.staticGroup();

        // Street floor
        const pFloor = this.createRooftop(512, 720, 1024, 40);

        // Boundary walls (invisible)
        const leftWall = this.add.rectangle(40, 500, 20, 600, 0x141824, 0);
        this.physics.add.existing(leftWall, true);
        this.platforms.add(leftWall);

        const rightWall = this.add.rectangle(984, 500, 20, 600, 0x141824, 0);
        this.physics.add.existing(rightWall, true);
        this.platforms.add(rightWall);

        // B1 Entry Rooftop — player spawns here
        const pB1 = this.createRooftop(150, 495, 200, 20);

        // B2 Relay Station
        const pB2 = this.createRooftop(358, 428, 178, 20);

        // Stepping stone B2 → B3
        this.createRooftop(482, 376, 68, 15);

        // B3 Nexus Tower (main target)
        const pB3 = this.createRooftop(578, 325, 232, 20);

        // Stepping stone B3 → B4
        this.createRooftop(672, 364, 68, 15);

        // B4 Broadcast Antenna
        const pB4 = this.createRooftop(748, 403, 165, 20);

        // B5 Extraction Rooftop
        const pB5 = this.createRooftop(895, 463, 162, 20);

        // ── Player ──
        this.player = this.physics.add.sprite(150, 455, 'logo');
        this.player.setAlpha(0);
        this.player.setDisplaySize(20, 40);
        this.player.setFriction(0, 0);
        this.player.setDrag(0, 0);

        this.physics.add.collider(this.player, this.platforms);

        this.playerGraphics = this.add.graphics();
        this.playerGraphics.setDepth(16);

        // ── Input ──
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.sKey   = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.S);
            this.eKey   = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.E);
            this.fKey   = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.F);
            this.key1   = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE);
            this.key2   = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO);
            this.key3   = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE);
            this.key4   = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.FOUR);
        } else {
            const mk: any = { isDown: false };
            this.cursors = { left: mk, right: mk, up: mk, down: mk, space: mk, shift: mk } as any;
            this.sKey = this.eKey = this.fKey = this.key1 = this.key2 = this.key3 = this.key4 = mk;
        }

        // ── State Machine ──
        this.stateMachine = new StateMachine('idle', {
            idle: new IdleState(), run: new RunState(), jump: new JumpState(),
            wallSlide: new WallSlideState(), dash: new DashState()
        }, [this, this.player]);

        // ── Guards ──
        // B2 Relay — Agent
        const g_b2 = this.createGuard(pB2, 'agent');

        // B3 Nexus — 2 PMC (offset so they don't stack)
        const g_b3a = this.createGuard(pB3, 'pmc');
        g_b3a.bodyRect.x = 530;
        g_b3a.startX = 462;
        g_b3a.endX = 578;

        const g_b3b = this.createGuard(pB3, 'pmc');
        g_b3b.bodyRect.x = 625;
        g_b3b.startX = 578;
        g_b3b.endX = 690;

        // B4 Broadcast — Agent
        const g_b4 = this.createGuard(pB4, 'agent');

        // B5 Extraction — PMC
        const g_b5 = this.createGuard(pB5, 'pmc');

        // Street — 2 PMC (manually positioned on floor)
        const g_st1 = this.createGuard(pFloor, 'pmc');
        g_st1.bodyRect.x = 280;
        g_st1.startX = 80;
        g_st1.endX = 490;

        const g_st2 = this.createGuard(pFloor, 'pmc');
        g_st2.bodyRect.x = 720;
        g_st2.startX = 510;
        g_st2.endX = 950;

        this.guards = [g_b2, g_b3a, g_b3b, g_b4, g_b5, g_st1, g_st2];

        // ── Weapon Pickups ──
        // Pistol on B1 entry (easy find near spawn)
        this.createWeaponPickup('pistol', 195, 475);
        // Rifle hidden on B4 broadcast antenna (rewards exploration)
        this.createWeaponPickup('rifle', 778, 383);

        // ── Server Terminal (on B3) ──
        this.terminalX = 600;
        this.terminalY = 300; // sits on top of B3 (top at y=315)
        this.terminalGraphics = this.add.graphics();
        this.terminalGraphics.setDepth(9);

        this.hackingText = this.add.text(this.terminalX, this.terminalY - 32, '[S] BREACH TERMINAL', {
            fontFamily: 'monospace', fontSize: '11px', color: '#f59e0b',
            fontStyle: 'bold', backgroundColor: '#0d1117e6', padding: { x: 6, y: 3 }
        }).setOrigin(0.5).setDepth(11).setAlpha(0);

        // ── Helipad (on B5) ──
        this.helipadX = 895;
        this.helipadY = 443; // top of B5 at y=453, helipad sits on surface
        this.helipadGraphics = this.add.graphics();
        this.helipadGraphics.setDepth(7);

        // H label (static text on helipad)
        this.add.text(this.helipadX, this.helipadY, 'H', {
            fontFamily: 'monospace', fontSize: '16px', color: '#2d4a2d', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(8);

        // ── Alert UI ──
        this.alertUI = this.add.graphics();
        this.alertUI.setDepth(100);

        this.alertText = this.add.text(512, 90, 'CITADEL CORPS ALERT — OPERATIVE DETECTED', {
            fontFamily: 'monospace', fontSize: '15px', color: '#ff3333', fontStyle: 'bold',
            backgroundColor: '#0f1115e8', padding: { x: 14, y: 7 }, align: 'center'
        }).setOrigin(0.5).setStroke('#1a1d24', 4).setDepth(101).setAlpha(0);

        // ── Chronostasis Overlay ──
        this.chronostasisOverlay = this.add.graphics();
        this.chronostasisOverlay.setDepth(4);

        // ── Watch Charge HUD ──
        this.chronometerHUD = this.add.graphics();
        this.chronometerHUD.setDepth(100);
        this.chronometerHUDText = this.add.text(20, 20, 'WATCH CHARGE', {
            fontFamily: 'monospace', fontSize: '11px', color: '#ffd700', fontStyle: 'bold'
        }).setDepth(101).setStroke('#0f1115', 2);

        // ── Player HP HUD ──
        this.playerHealthBar = this.add.graphics();
        this.playerHealthBar.setDepth(100);
        this.playerHealthText = this.add.text(20, 56, 'HP', {
            fontFamily: 'monospace', fontSize: '11px', color: '#ef4444', fontStyle: 'bold'
        }).setDepth(101).setStroke('#0f1115', 2);

        // ── Weapon HUD ──
        this.weaponHUD = this.add.graphics();
        this.weaponHUD.setDepth(100);

        const wLabels = ['[1] KNIFE', '[2] PISTOL', '[3] SMG', '[4] RIFLE'];
        this.weaponHUDTexts = wLabels.map((label, i) =>
            this.add.text(778, 676 + i * 22, label, {
                fontFamily: 'monospace', fontSize: '11px', color: '#374151', fontStyle: 'bold'
            }).setDepth(101).setStroke('#0f1115', 2)
        );

        // ── Controls hint (fades after 5s) ──
        const hint = this.add.text(512, 740,
            '← → MOVE  |  ↑ JUMP  |  ← ←  or  → → KNIFE DASH  |  SPACE FREEZE TIME  |  E PICKUP  |  F SHOOT  |  1-4 WEAPONS',
            { fontFamily: 'monospace', fontSize: '9px', color: '#6b7280', backgroundColor: '#0d1117bb', padding: { x: 6, y: 3 } }
        ).setOrigin(0.5).setDepth(200);
        this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 1200, onComplete: () => hint.destroy() });

        console.log('[Game] create() complete. Guards:', this.guards.length);
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    update(time: number, delta: number) {
        if (this.playerDefeated) return;

        this.stateMachine.step();
        const dt = delta ? delta / 1000 : 0.016;

        // ── Facing direction ──
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        if (body?.velocity.x > 10)  this.playerFacingRight = true;
        if (body?.velocity.x < -10) this.playerFacingRight = false;

        // ── Draw player character ──
        this.drawPlayer();

        // ── Double-tap dash detection ──
        const leftJD  = Input.Keyboard.JustDown(this.cursors.left);
        const rightJD = Input.Keyboard.JustDown(this.cursors.right);

        if (leftJD) {
            if (time - this.lastLeftTapTime < this.DOUBLE_TAP_WINDOW && this.currentWeapon === 'knife') {
                this.dashRequested = true;
            }
            this.lastLeftTapTime = time;
        }
        if (rightJD) {
            if (time - this.lastRightTapTime < this.DOUBLE_TAP_WINDOW && this.currentWeapon === 'knife') {
                this.dashRequested = true;
            }
            this.lastRightTapTime = time;
        }

        // ── Invincibility frame expiry ──
        if (this.playerInvincible && time - this.lastDamageTime > 800) {
            this.playerInvincible = false;
        }

        // ── Weapon switching ──
        if (Input.Keyboard.JustDown(this.key1)) this.currentWeapon = 'knife';
        if (Input.Keyboard.JustDown(this.key2) && this.weaponInventory.includes('pistol')) this.currentWeapon = 'pistol';
        if (Input.Keyboard.JustDown(this.key3) && this.weaponInventory.includes('smg'))    this.currentWeapon = 'smg';
        if (Input.Keyboard.JustDown(this.key4) && this.weaponInventory.includes('rifle'))  this.currentWeapon = 'rifle';

        // ── Shooting ──
        if (this.fKey?.isDown && this.currentWeapon !== 'knife') {
            this.firePlayerBullet();
        }

        // ── Dash trail + knife assassination ──
        if (this.stateMachine.state === 'dash' && this.currentWeapon === 'knife') {
            this.createDashGhost();
            this.checkKnifeAssassination();
        }

        // ── Chronostasis (SPACE) ──
        const spaceDown = this.cursors.space?.isDown;
        if (spaceDown && this.chronometerCharge > 0) {
            this.chronostasisActive = true;
            this.chronometerCharge = Math.max(0, this.chronometerCharge - 33 * dt);
        } else {
            this.chronostasisActive = false;
            this.chronometerCharge = Math.min(100, this.chronometerCharge + 15 * dt);
        }
        if (!this.chronostasisActive) this.chronostasisTime += delta;

        // ── Weapon pickups (E key) ──
        this.weaponPickups.forEach(pickup => {
            if (pickup.collected) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y);
            if (dist < 42) {
                pickup.prompt.setAlpha(1);
                if (Input.Keyboard.JustDown(this.eKey)) {
                    pickup.collected = true;
                    pickup.graphic.destroy();
                    pickup.prompt.destroy();
                    if (!this.weaponInventory.includes(pickup.type)) this.weaponInventory.push(pickup.type);
                    if (pickup.type === 'pistol') this.ammo.pistol += 12;
                    // Pickup notification
                    const notif = this.add.text(this.player.x, this.player.y - 50,
                        `${pickup.type.toUpperCase()} ACQUIRED`, {
                            fontFamily: 'monospace', fontSize: '12px', color: '#ffd700',
                            backgroundColor: '#0d1117cc', padding: { x: 6, y: 3 }
                        }).setOrigin(0.5).setDepth(200);
                    this.tweens.add({ targets: notif, alpha: 0, y: notif.y - 30, duration: 1300, onComplete: () => notif.destroy() });
                }
            } else {
                pickup.prompt.setAlpha(0);
            }
        });

        // ── Ammo drops (auto-pickup on walk-over) ──
        this.ammoDrops.forEach(drop => {
            if (drop.collected) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, drop.x, drop.y);
            if (dist < 26) {
                drop.collected = true;
                drop.graphic.destroy();
                const maxAmmo = { smg: 60, rifle: 20, pistol: 36 };
                this.ammo[drop.type] = Math.min(maxAmmo[drop.type], this.ammo[drop.type] + drop.rounds);
                if (!this.weaponInventory.includes(drop.type)) this.weaponInventory.push(drop.type);
            }
        });

        // ── Bullet update loop ──
        this.bullets = this.bullets.filter(b => b.active);
        this.bullets.forEach(bullet => {
            if (!bullet.active) return;

            // Guard bullets freeze during Chronostasis; player bullets always travel
            if (!this.chronostasisActive || bullet.isPlayerBullet) {
                bullet.graphic.x += bullet.vx * dt;
                bullet.graphic.y += bullet.vy * dt;
            }

            // Off-screen despawn
            if (bullet.graphic.x < -20 || bullet.graphic.x > 1044 ||
                bullet.graphic.y < -20 || bullet.graphic.y > 790) {
                bullet.graphic.destroy();
                bullet.active = false;
                return;
            }

            if (bullet.isPlayerBullet) {
                // Player bullet vs guards
                this.guards.forEach(guard => {
                    if (!guard.alive || !bullet.active) return;
                    const dist = Phaser.Math.Distance.Between(
                        bullet.graphic.x, bullet.graphic.y, guard.bodyRect.x, guard.bodyRect.y
                    );
                    if (dist < 20) {
                        bullet.graphic.destroy();
                        bullet.active = false;

                        const now = this.time.now;
                        if (guard.health === 2) {
                            // First hit — start kill window
                            guard.health = 1;
                            guard.firstHitTime = now;
                            guard.alertLevel = 100;
                            guard.alertState = 'alert';
                        } else if (guard.health === 1) {
                            if (now - guard.firstHitTime <= 2000) {
                                this.killGuard(guard, false); // 2nd shot in window = kill
                            } else {
                                // Window expired — reset window, guard stays at 1 HP
                                guard.health = 1;
                                guard.firstHitTime = now;
                            }
                        }
                    }
                });
            } else {
                // Guard bullet vs player
                const dist = Phaser.Math.Distance.Between(
                    bullet.graphic.x, bullet.graphic.y, this.player.x, this.player.y
                );
                if (dist < 17) {
                    bullet.graphic.destroy();
                    bullet.active = false;
                    this.damagePlayer(bullet.damage);
                }
            }
        });

        // ── Guards update loop ──
        let maxAlert = 0;

        this.guards.forEach(guard => {
            if (!guard.alive) {
                this.drawGuard(guard);
                return;
            }

            // Speed per alert state
            guard.speed = guard.alertState === 'alert' ? 115 :
                          guard.alertState === 'suspicious' ? 28 : 44;

            // Movement
            if (!this.chronostasisActive) {
                if (guard.alertState === 'alert') {
                    guard.direction = this.player.x > guard.bodyRect.x ? 1 : -1;
                }
                guard.bodyRect.x += guard.direction * guard.speed * dt;

                if (guard.alertState !== 'alert') {
                    if (guard.bodyRect.x <= guard.startX && guard.direction === -1) guard.direction = 1;
                    if (guard.bodyRect.x >= guard.endX   && guard.direction === 1)  guard.direction = -1;
                }
            }
            guard.bodyRect.x = Phaser.Math.Clamp(guard.bodyRect.x, guard.startX, guard.endX);

            // Vision cone
            const baseAngle  = guard.direction === 1 ? 0 : Math.PI;
            const wobble     = Math.sin(this.chronostasisTime * 0.003) * 0.22;
            const lookAngle  = baseAngle + wobble;
            const range      = 235;
            const halfFov    = 0.38;

            const distToPlayer = Phaser.Math.Distance.Between(
                guard.bodyRect.x, guard.bodyRect.y, this.player.x, this.player.y
            );

            let detected = false;
            if (distToPlayer <= range && !this.chronostasisActive) {
                const ang = Math.atan2(this.player.y - guard.bodyRect.y, this.player.x - guard.bodyRect.x);
                const diff = Math.abs(Phaser.Math.Angle.Normalize(ang - lookAngle));
                if (diff <= halfFov && this.hasLineOfSight(guard.bodyRect.x, guard.bodyRect.y, this.player.x, this.player.y)) {
                    detected = true;
                }
            }

            if (detected) {
                guard.alertLevel = Math.min(100, guard.alertLevel + 48 * dt);
            } else if (!this.chronostasisActive) {
                guard.alertLevel = Math.max(0, guard.alertLevel - 18 * dt);
            }

            guard.alertState = guard.alertLevel >= 100 ? 'alert' :
                               guard.alertLevel >  0   ? 'suspicious' : 'patrol';

            // 2-shot window expiry → force alert
            if (guard.health === 1 && guard.firstHitTime > 0 && this.time.now - guard.firstHitTime > 2000) {
                guard.alertLevel = 100;
                guard.alertState = 'alert';
                guard.firstHitTime = 0;
            }

            // Guards shoot back when fully alerted
            if (guard.alertState === 'alert' && !this.chronostasisActive) {
                const fireCooldown = guard.type === 'pmc' ? 1500 : 2500;
                if (this.time.now - guard.lastGuardShotTime > fireCooldown) {
                    guard.lastGuardShotTime = this.time.now;

                    const dx = this.player.x - guard.bodyRect.x;
                    const dy = this.player.y - guard.bodyRect.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const bspeed = 420;

                    const bg = this.add.rectangle(guard.bodyRect.x, guard.bodyRect.y, 5, 2, 0xff4422);
                    bg.setDepth(14);
                    this.bullets.push({
                        graphic: bg, vx: (dx / len) * bspeed, vy: (dy / len) * bspeed,
                        isPlayerBullet: false, active: true,
                        damage: guard.type === 'pmc' ? 20 : 25
                    });
                }
            }

            if (guard.alertLevel > maxAlert) maxAlert = guard.alertLevel;

            // Draw vision cone
            guard.visionGraphics.clear();
            const coneColor = guard.alertState === 'alert' ? 0xff3333 :
                              guard.alertState === 'suspicious' ? 0xffd700 : 0x00f0ff;
            const coneAlpha = guard.alertState === 'alert'
                ? 0.22 + Math.sin(time * 0.02) * 0.1
                : guard.alertState === 'suspicious' ? 0.17 : 0.12;

            guard.visionGraphics.fillStyle(coneColor, coneAlpha);
            guard.visionGraphics.beginPath();
            guard.visionGraphics.moveTo(guard.bodyRect.x, guard.bodyRect.y);
            guard.visionGraphics.arc(guard.bodyRect.x, guard.bodyRect.y, range, lookAngle - halfFov, lookAngle + halfFov);
            guard.visionGraphics.closePath();
            guard.visionGraphics.fillPath();

            this.drawGuard(guard);
        });

        this.globalAlertLevel = maxAlert;

        // ── Global alert vignette ──
        this.alertUI.clear();
        if (this.globalAlertLevel >= 100) {
            const w = 3 + Math.sin(time * 0.012) * 2;
            this.alertUI.lineStyle(w, 0xff3333, 0.28 + Math.sin(time * 0.012) * 0.12);
            this.alertUI.strokeRect(0, 0, 1024, 768);
            this.alertText.setAlpha(0.65 + Math.sin(time * 0.016) * 0.3);
        } else {
            this.alertText.setAlpha(0);
        }

        // ── Player HP HUD ──
        this.playerHealthBar.clear();
        this.playerHealthBar.fillStyle(0x0f1115, 0.72);
        this.playerHealthBar.fillRoundedRect(20, 52, 120, 14, 4);
        this.playerHealthBar.lineStyle(1.5, 0xef4444, 0.28);
        this.playerHealthBar.strokeRoundedRect(20, 52, 120, 14, 4);
        const hpW = Math.round(112 * (this.playerHP / this.playerMaxHP));
        if (hpW > 0) {
            const hpC = this.playerHP > 60 ? 0x22c55e : this.playerHP > 30 ? 0xfbbf24 : 0xef4444;
            this.playerHealthBar.fillStyle(hpC, 0.9);
            this.playerHealthBar.fillRoundedRect(24, 55, hpW, 8, 2);
        }

        // ── Watch charge HUD ──
        this.chronometerHUD.clear();
        const chFill = this.chronostasisActive ? 0xf59e0b : 0x00f0ff;
        const chBord = this.chronostasisActive ? 0xffd700 : 0xffffff;
        this.chronometerHUD.fillStyle(0x0f1115, 0.72);
        this.chronometerHUD.fillRoundedRect(20, 32, 120, 14, 4);
        this.chronometerHUD.lineStyle(1.5, chBord, 0.22);
        this.chronometerHUD.strokeRoundedRect(20, 32, 120, 14, 4);
        const chW = Math.round(112 * (this.chronometerCharge / 100));
        if (chW > 0) {
            this.chronometerHUD.fillStyle(chFill, 0.9);
            this.chronometerHUD.fillRoundedRect(24, 35, chW, 8, 2);
        }
        // Segment dividers
        this.chronometerHUD.lineStyle(1, 0x0f1115, 0.5);
        for (let i = 1; i < 5; i++) {
            this.chronometerHUD.lineBetween(20 + i * 24, 32, 20 + i * 24, 46);
        }

        // ── Weapon HUD ──
        this.weaponHUD.clear();
        this.weaponHUD.fillStyle(0x0f1115, 0.68);
        this.weaponHUD.fillRoundedRect(762, 664, 250, 100, 6);
        this.weaponHUD.lineStyle(1, 0x2d3348, 0.45);
        this.weaponHUD.strokeRoundedRect(762, 664, 250, 100, 6);

        const slots = [
            { key: 'knife',  label: '[1] 🔪 KNIFE',  ammo: '∞' },
            { key: 'pistol', label: '[2] PISTOL',     ammo: this.weaponInventory.includes('pistol') ? `${this.ammo.pistol}` : '—' },
            { key: 'smg',    label: '[3] SMG',        ammo: this.weaponInventory.includes('smg')    ? `${this.ammo.smg}`    : '—' },
            { key: 'rifle',  label: '[4] RIFLE',      ammo: this.weaponInventory.includes('rifle')  ? `${this.ammo.rifle}`  : '—' },
        ];

        slots.forEach((slot, i) => {
            const active   = this.currentWeapon === slot.key;
            const hasIt    = this.weaponInventory.includes(slot.key);
            const col      = active ? '#ffffff' : hasIt ? '#9ca3af' : '#374151';
            this.weaponHUDTexts[i].setText(`${slot.label}   ${slot.ammo}`);
            this.weaponHUDTexts[i].setColor(col);
            if (active) {
                this.weaponHUD.fillStyle(0x00f0ff, 0.09);
                this.weaponHUD.fillRoundedRect(765, 667 + i * 23, 244, 21, 3);
            }
        });

        // ── Chronostasis overlay ──
        this.chronostasisOverlay.clear();
        if (this.chronostasisActive) {
            this.chronostasisOverlay.fillStyle(0xf59e0b, 0.06 + Math.sin(time * 0.005) * 0.02);
            this.chronostasisOverlay.fillRect(0, 0, 1024, 768);
            this.chronostasisOverlay.lineStyle(3 + Math.sin(time * 0.01) * 1.5, 0xf59e0b, 0.18 + Math.sin(time * 0.01) * 0.07);
            this.chronostasisOverlay.strokeRect(0, 0, 1024, 768);
        }

        // ── Server Terminal interaction ──
        this.drawServerTerminal(time);

        if (!this.terminalHacked) {
            const distT = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.terminalX, this.terminalY);
            if (distT < 50) {
                this.hackingText.setAlpha(1);
                const hacking = (this.sKey?.isDown || this.cursors.down?.isDown);
                if (hacking) {
                    this.hackingProgress = Math.min(100, this.hackingProgress + 33 * dt);
                    this.hackingText.setText(`BREACHING: ${Math.round(this.hackingProgress)}%`);
                    this.hackingText.setColor('#ffffff');
                } else {
                    this.hackingProgress = Math.max(0, this.hackingProgress - 50 * dt);
                    this.hackingText.setText('[S] BREACH TERMINAL');
                    this.hackingText.setColor('#f59e0b');
                }

                if (this.hackingProgress >= 100) {
                    this.terminalHacked = true;
                    this.extractionActive = true;
                    this.hackingText.setAlpha(0);

                    const success = this.add.text(512, 384, 'TERMINAL BREACHED — REACH EXTRACTION POINT', {
                        fontFamily: 'monospace', fontSize: '18px', color: '#22c55e', fontStyle: 'bold',
                        backgroundColor: '#0d1117f0', padding: { x: 16, y: 10 }
                    }).setOrigin(0.5).setDepth(1000).setStroke('#0d1117', 4);
                    this.tweens.add({ targets: success, alpha: 0, delay: 2800, duration: 500, onComplete: () => success.destroy() });

                    const flash = this.add.graphics();
                    flash.setDepth(9999);
                    flash.fillStyle(0x22c55e, 0.7);
                    flash.fillCircle(this.terminalX, this.terminalY, 44);
                    this.tweens.add({ targets: flash, alpha: 0, scaleX: 2.8, scaleY: 2.8, duration: 450, onComplete: () => flash.destroy() });
                }
            } else {
                this.hackingProgress = Math.max(0, this.hackingProgress - 50 * dt);
                this.hackingText.setAlpha(0);
            }
        }

        // ── Helipad / Extraction ──
        this.drawHelipad(time);

        if (this.extractionActive) {
            if (!this.sys.registry.has('extract_text')) {
                const et = this.add.text(this.helipadX, this.helipadY - 50, 'EXTRACTION ACTIVE — BOARD NOW', {
                    fontFamily: 'monospace', fontSize: '11px', color: '#22c55e',
                    backgroundColor: '#0d1117e6', padding: { x: 5, y: 3 }
                }).setOrigin(0.5).setDepth(10);
                this.sys.registry.set('extract_text', et);
                this.tweens.add({ targets: et, y: et.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }

            const distH = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.helipadX, this.helipadY);
            if (distH < 30) {
                this.player.setVelocity(0, 0);
                const pb = this.player.body as Phaser.Physics.Arcade.Body;
                if (pb) pb.setEnable(false);

                const win = this.add.rectangle(512, 384, 1024, 768, 0x0f1115, 0);
                win.setDepth(99999);
                this.tweens.add({
                    targets: win, alpha: 1, duration: 650, ease: 'Power2',
                    onComplete: () => {
                        this.cleanupRegistry();
                        win.destroy();
                        this.scene.start('GameOver', { status: 'victory', charge: this.chronometerCharge, alerts: this.globalAlertLevel });
                    }
                });
            }
        }

        // ── Fall damage (landing on street) ──
        if (this.player.y > 670 && body?.touching.down && !this.playerInvincible) {
            this.damagePlayer(15);
        }

        // ── Guard physical contact damage (alerted guards ramming player) ──
        this.guards.forEach(guard => {
            if (!guard.alive || guard.alertState !== 'alert') return;
            const pw = 20, ph = 40, gw = 20, gh = 40;
            const hit =
                this.player.x + pw / 2 > guard.bodyRect.x - gw / 2 &&
                this.player.x - pw / 2 < guard.bodyRect.x + gw / 2 &&
                this.player.y + ph / 2 > guard.bodyRect.y - gh / 2 &&
                this.player.y - ph / 2 < guard.bodyRect.y + gh / 2;
            if (hit) this.damagePlayer(35);
        });
    }
}
