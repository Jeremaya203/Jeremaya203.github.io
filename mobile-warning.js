(function () {
    'use strict';

    const DISMISS_KEY = 'oot-mobile-warning-dismissed';
    const BREAKPOINT = 768;

    if (window.innerWidth > BREAKPOINT) return;
    try {
        if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch (_) {
        /* sessionStorage no disponible (modo privado/restricciones): mostrar igual */
    }

    const overlay = document.createElement('div');
    overlay.id = 'oot-mobile-warning-overlay';
    overlay.className = 'oot-mobile-warning-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'oot-mobile-warning-title');

    const box = document.createElement('div');
    box.className = 'oot-mobile-warning-box';

    var title = document.createElement('h2');
    title.id = 'oot-mobile-warning-title';
    title.className = 'oot-mobile-warning-title';
    title.textContent = 'Sitio optimizado para computador';

    const text = document.createElement('p');
    text.className = 'oot-mobile-warning-text';
    text.textContent = 'Colombia OT 2.0 está diseñado para pantallas de escritorio. En este dispositivo algunas funciones (mapas, formularios, tablas) pueden no verse correctamente.';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'oot-mobile-warning-button';
    button.textContent = 'Entendido';
    button.addEventListener('click', function () {
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (_) { /* ignorar */ }
        overlay.parentNode && overlay.parentNode.removeChild(overlay);
    });

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(button);
    overlay.appendChild(box);

    if (document.body) {
        document.body.appendChild(overlay);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            document.body.appendChild(overlay);
        });
    }
})();
