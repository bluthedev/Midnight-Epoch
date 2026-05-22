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

    // Global Error Overlay for Runtime Debugging
    window.addEventListener('error', (event) => {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '0';
        errorDiv.style.left = '0';
        errorDiv.style.width = '100%';
        errorDiv.style.height = '100%';
        errorDiv.style.backgroundColor = 'rgba(15, 17, 21, 0.95)';
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.padding = '30px';
        errorDiv.style.fontFamily = '"Consolas", "Courier New", monospace';
        errorDiv.style.zIndex = '999999';
        errorDiv.style.overflow = 'auto';
        errorDiv.style.boxSizing = 'border-box';
        errorDiv.style.border = '3px solid #d4af37';
        errorDiv.innerHTML = `
            <h1 style="color: #ffd700; margin-top: 0; font-family: sans-serif; letter-spacing: 2px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">MIDNIGHT OVERWATCH: RUNTIME ERROR DETECTED</h1>
            <p style="font-size: 16px; margin: 15px 0;"><strong>Message:</strong> <span style="color: #fff;">${event.message}</span></p>
            <p style="font-size: 14px; margin: 10px 0;"><strong>Source:</strong> <span style="color: #a0aec0;">${event.filename}:${event.lineno}:${event.colno}</span></p>
            <p style="font-size: 16px; margin-top: 20px; font-weight: bold; color: #ffd700;">Stack Trace:</p>
            <pre style="background: #0f1115; padding: 15px; border-radius: 6px; border: 1px solid #2d3748; color: #a6e22e; overflow-x: auto; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${event.error?.stack || 'No stack trace available'}</pre>
            <button onclick="window.location.reload(true)" style="margin-top: 20px; padding: 10px 20px; background: #d4af37; border: none; color: #000; font-weight: bold; cursor: pointer; border-radius: 4px;">FORCE HARD RELOAD</button>
        `;
        document.body.appendChild(errorDiv);
    });

    window.addEventListener('unhandledrejection', (event) => {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '0';
        errorDiv.style.left = '0';
        errorDiv.style.width = '100%';
        errorDiv.style.height = '100%';
        errorDiv.style.backgroundColor = 'rgba(15, 17, 21, 0.95)';
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.padding = '30px';
        errorDiv.style.fontFamily = '"Consolas", "Courier New", monospace';
        errorDiv.style.zIndex = '999999';
        errorDiv.style.overflow = 'auto';
        errorDiv.style.boxSizing = 'border-box';
        errorDiv.style.border = '3px solid #d4af37';
        errorDiv.innerHTML = `
            <h1 style="color: #ffd700; margin-top: 0; font-family: sans-serif; letter-spacing: 2px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">MIDNIGHT OVERWATCH: UNHANDLED REJECTION</h1>
            <p style="font-size: 16px; margin: 15px 0;"><strong>Reason:</strong> <span style="color: #fff;">${event.reason}</span></p>
            <p style="font-size: 16px; margin-top: 20px; font-weight: bold; color: #ffd700;">Stack Trace:</p>
            <pre style="background: #0f1115; padding: 15px; border-radius: 6px; border: 1px solid #2d3748; color: #a6e22e; overflow-x: auto; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${event.reason?.stack || 'No stack trace available'}</pre>
            <button onclick="window.location.reload(true)" style="margin-top: 20px; padding: 10px 20px; background: #d4af37; border: none; color: #000; font-weight: bold; cursor: pointer; border-radius: 4px;">FORCE HARD RELOAD</button>
        `;
        document.body.appendChild(errorDiv);
    });

    StartGame('game-container');

});