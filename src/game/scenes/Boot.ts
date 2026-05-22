import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        // No assets to load in Boot since Preloader renders procedurally
    }

    create ()
    {
        this.scene.start('Preloader');
    }
}

