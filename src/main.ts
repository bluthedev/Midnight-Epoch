import StartGame from './game/main';
import { TonConnectUI } from '@tonconnect/ui';

document.addEventListener('DOMContentLoaded', () => {

    // Initialize Telegram Web App
    if ((window as any).Telegram && (window as any).Telegram.WebApp) {
        const webApp = (window as any).Telegram.WebApp;
        webApp.ready();
        webApp.expand();
    }

    // Initialize TON Connect UI overlay
    new TonConnectUI({
        manifestUrl: window.location.origin + '/tonconnect-manifest.json',
        buttonRootId: 'ton-connect-button'
    });

    StartGame('game-container');

});