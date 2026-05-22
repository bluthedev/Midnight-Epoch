import { Scene } from 'phaser';

interface GameOverData {
    status: 'victory' | 'defeat';
    charge?: number;
    alerts?: number;
}

export class GameOver extends Scene
{
    private data: GameOverData = { status: 'defeat' };

    constructor ()
    {
        super('GameOver');
    }

    init(data: GameOverData)
    {
        this.data = data || { status: 'defeat' };
    }

    create ()
    {
        // 1. Premium Custom Dark Fade-in Transition
        const fadeOverlay = this.add.rectangle(512, 384, 1024, 768, 0x0f1115);
        fadeOverlay.setDepth(99999);
        this.tweens.add({
            targets: fadeOverlay,
            alpha: 0,
            duration: 600,
            onComplete: () => {
                fadeOverlay.destroy();
            }
        });

        // 2. Background Layer (Citadel White/Gold theme)
        const bg = this.add.image(512, 384, 'citadel_bg');
        bg.setDisplaySize(1024, 768);
        bg.setDepth(1);
        
        if (this.data.status === 'victory') {
            bg.setAlpha(0.7);
        } else {
            bg.setAlpha(0.35);
            // Apply heavy dark/crimson vignette overlay
            const redOverlay = this.add.graphics();
            redOverlay.setDepth(2);
            redOverlay.fillStyle(0x0f1115, 0.6);
            redOverlay.fillRect(0, 0, 1024, 768);
            redOverlay.lineStyle(10, 0xff3333, 0.2);
            redOverlay.strokeRect(0, 0, 1024, 768);
        }

        // 3. Central Glassmorphic Dashboard Panel
        const panel = this.add.graphics();
        panel.setDepth(10);
        
        const panelX = 212;
        const panelY = 134;
        const panelW = 600;
        const panelH = 500;
        
        // Semi-transparent deep dark container
        panel.fillStyle(0x0f1115, 0.85);
        panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
        
        // High-tech gold or crimson stroke borders
        const borderColor = this.data.status === 'victory' ? 0xd4af37 : 0xff3333;
        panel.lineStyle(2.5, borderColor, 0.65);
        panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

        // 4. Procedural Background Gear VFX (Spinning slowly on victory)
        if (this.data.status === 'victory') {
            const gears = this.add.graphics();
            gears.setDepth(11);
            gears.lineStyle(1.5, 0xd4af37, 0.08);
            
            // Slow rotating gear animation using tween
            this.tweens.addCounter({
                from: 0,
                to: 360,
                duration: 20000,
                repeat: -1,
                onUpdate: (tween) => {
                    gears.clear();
                    const angleRad = (tween.getValue() * Math.PI) / 180;
                    const cx = 512;
                    const cy = 350;
                    
                    gears.strokeCircle(cx, cy, 140);
                    gears.strokeCircle(cx, cy, 120);
                    
                    for (let i = 0; i < 16; i++) {
                        const gearAngle = angleRad + (i * Math.PI / 8);
                        const sx = cx + Math.cos(gearAngle) * 120;
                        const sy = cy + Math.sin(gearAngle) * 120;
                        const ex = cx + Math.cos(gearAngle) * 140;
                        const ey = cy + Math.sin(gearAngle) * 140;
                        gears.lineBetween(sx, sy, ex, ey);
                    }
                }
            });
        }

        // 5. Header Typography Text
        const titleStr = this.data.status === 'victory' ? 'MISSION COMPLETE' : 'EXPEDITION FAILED';
        const titleColor = this.data.status === 'victory' ? '#ffd700' : '#ff3333';
        
        const titleText = this.add.text(512, 185, titleStr, {
            fontFamily: 'monospace',
            fontSize: '36px',
            color: titleColor,
            fontStyle: 'bold',
            letterSpacing: 4
        }).setOrigin(0.5).setDepth(20).setStroke('#0f1115', 4);

        const subStr = this.data.status === 'victory' 
            ? 'CITADEL SECURED • CHRONOMETER STABILIZED'
            : 'CHRONOMETER SHATTERED • OPERATIVE CAPTURED';
        
        const subText = this.add.text(512, 230, subStr, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#a0aec0',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(20).setStroke('#0f1115', 2);

        // 6. Centered Stats Dashboard Card
        const statsBox = this.add.graphics();
        statsBox.setDepth(15);
        statsBox.fillStyle(0x1a1d24, 0.5);
        statsBox.fillRoundedRect(262, 270, 500, 180, 8);
        statsBox.lineStyle(1, 0x2d3748, 0.4);
        statsBox.strokeRoundedRect(262, 270, 500, 180, 8);

        if (this.data.status === 'victory') {
            const charge = this.data.charge !== undefined ? Math.round(this.data.charge) : 100;
            const alerts = this.data.alerts !== undefined ? Math.round(this.data.alerts) : 0;
            const efficiency = Math.max(0, 100 - alerts);

            this.add.text(512, 305, 'EXPEDITION SUMMARY', {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#ffd700',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(20);

            // Remaining power text
            this.add.text(320, 355, 'REMAINING CHRONOMETER POWER:', {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#cbd5e1'
            }).setDepth(20);

            this.add.text(620, 355, `${charge}%`, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#00f0ff',
                fontStyle: 'bold'
            }).setDepth(20);

            // Stealth efficiency text
            this.add.text(320, 395, 'TACTICAL STEALTH EFFICIENCY:', {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#cbd5e1'
            }).setDepth(20);

            const effColor = efficiency > 75 ? '#48bb78' : (efficiency > 40 ? '#ffd700' : '#ff3333');
            this.add.text(620, 395, `${efficiency}%`, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: effColor,
                fontStyle: 'bold'
            }).setDepth(20);

        } else {
            // Defeat logs
            this.add.text(512, 305, 'TACTICAL INTRUDER INCIDENT REPORT', {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#ff3333',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(20);

            const reportStr = 
                "WARNING: CITADEL DEFENSE SYSTEMS FULLY ENGAGED.\n\n" +
                "• OPERATIVE IDENTITY DETECTED & RETRIEVED.\n" +
                "• QUANTUM CHRONOMETER STABILIZATION: FAILURE.\n" +
                "• STATUS: DETAINED IN TETHERED CELL STRUCTURE.\n\n" +
                "RECOMMENDED ACTION: RE-DEPLOY NEW TEMPORAL UNIT.";

            this.add.text(290, 340, reportStr, {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#e2e8f0',
                lineSpacing: 4
            }).setDepth(20);
        }

        // 7. Interactive Glassmorphic CTA Buttons
        const createBtn = (x: number, y: number, text: string, primary: boolean, action: () => void) => {
            const btnW = 220;
            const btnH = 44;
            
            const btnBg = this.add.graphics();
            btnBg.setDepth(20);
            
            // Standard state
            const fillCol = primary ? borderColor : 0x0f1115;
            const fillAlpha = primary ? 0.35 : 0.8;
            btnBg.fillStyle(fillCol, fillAlpha);
            btnBg.fillRoundedRect(x - btnW/2, y - btnH/2, btnW, btnH, 6);
            btnBg.lineStyle(1.5, borderColor, 0.5);
            btnBg.strokeRoundedRect(x - btnW/2, y - btnH/2, btnW, btnH, 6);

            const btnText = this.add.text(x, y, text, {
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(21).setStroke('#0f1115', 2);

            // Create invisible hitbox for interactions
            const hitbox = this.add.rectangle(x, y, btnW, btnH, 0x000000, 0);
            hitbox.setDepth(25);
            hitbox.setInteractive({ useHandCursor: true });

            hitbox.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(borderColor, 0.55);
                btnBg.fillRoundedRect(x - btnW/2, y - btnH/2, btnW, btnH, 6);
                btnBg.lineStyle(2.5, 0xffffff, 0.95);
                btnBg.strokeRoundedRect(x - btnW/2, y - btnH/2, btnW, btnH, 6);
                btnText.setScale(1.04);
            });

            hitbox.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(fillCol, fillAlpha);
                btnBg.fillRoundedRect(x - btnW/2, y - btnH/2, btnW, btnH, 6);
                btnBg.lineStyle(1.5, borderColor, 0.5);
                btnBg.strokeRoundedRect(x - btnW/2, y - btnH/2, btnW, btnH, 6);
                btnText.setScale(1.0);
            });

            hitbox.on('pointerdown', () => {
                // Add click compression animation
                btnText.setScale(0.95);
                this.tweens.add({
                    targets: winOverlay,
                    alpha: 1,
                    duration: 400,
                    onComplete: action
                });
            });
        };

        // Screen-wide fade overlay to reuse during transitions
        const winOverlay = this.add.rectangle(512, 384, 1024, 768, 0x0f1115);
        winOverlay.setDepth(99998);
        winOverlay.setAlpha(0);

        const leftBtnText = this.data.status === 'victory' ? 'RE-RUN EXPEDITION' : 'RE-DEPLOY OPERATIVE';
        createBtn(380, 535, leftBtnText, true, () => {
            this.scene.start('Game');
        });

        createBtn(644, 535, 'RETURN TO OVERWATCH', false, () => {
            this.scene.start('MainMenu');
        });
    }
}
