/**
 * Configuración pública del cliente Firebase.
 * apiKey / authDomain son identificadores de cliente; no se incluyen claves privadas.
 * Preguntar temas seguridad y si es esta apiKey a usar.
 */
"use strict";

class FirebaseConfig {
    constructor() {
        this.apiKey = "AIzaSyCLSp_Qbaohj8owxrpZxvrmxUSkVw0ukig";
        this.authDomain = "geovisor-igac.firebaseapp.com";
        this.projectId = "geovisor-igac";
        Object.freeze(this);
    }
}

window.FirebaseConfig = FirebaseConfig;
window.CaracterizacionesFirebaseConfig = new FirebaseConfig();
