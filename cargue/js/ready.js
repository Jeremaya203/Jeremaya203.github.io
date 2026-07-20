$(document).ready(function () {
    if (window.OOT && window.OOT.loadShell) {
        window.OOT.loadShell();
    }
    
    // H-03: Inicialización analítica GA4 para el módulo de cargue
    if (typeof gtag === 'function') {
        gtag('event', 'screen_view', {
            'app_name': 'Observatorio OT',
            'screen_name': 'Cargue de Documentos'
        });
    }
    
    setTimeout(function () {
        $('.calltocontext').hide();
    }, 10000);

    // --- Vinculación de Eventos para CSP ---
    
    // 1. Navegación entre secciones
    $(document).on("click", ".btn-goto-documentos", function (e) {
        e.preventDefault();
        gotoDocumentos();
    });
    $(document).on("click", ".btn-goto-pot", function (e) {
        e.preventDefault();
        gotoPot();
    });
    $(document).on("click", ".btn-goto-recursos", function (e) {
        e.preventDefault();
        gotoRecursos();
    });

    // 2. Navegación entre pasos de documentos
    $(document).on("click", ".btn-goto-doc-paso", function (e) {
        e.preventDefault();
        var paso = $(this).data("paso");
        gotoDocumentosPaso(paso);
    });

    // 3. Cerrar alerta
    $(document).on("click", ".btn-close-alert", function (e) {
        e.preventDefault();
        $('#alertList').hide();
    });

    // 4. Cambiar paginación
    $(document).on("click", ".btn-change-len", function (e) {
        e.preventDefault();
        var len = $(this).data("len");
        changeLenDocs(len);
    });
    $(document).on("click", ".btn-change-len-igac", function (e) {
        e.preventDefault();
        var len = $(this).data("len");
        changeLenDocsIGAC(len);
    });

    // 5. Botones de acción de Documentos
    $(document).on("click", "#btnNewDocumentos", function (e) {
        e.preventDefault();
        newDocumentos();
    });
    $(document).on("click", "#btnDocumentosGuardar", function (e) {
        e.preventDefault();
        salvarDocumentos();
    });
    $(document).on("click", "#btnDocumentosBorrar", function (e) {
        e.preventDefault();
        borrarDocumentos();
    });
    $(document).on("click", "#btnDocumentosCrear", function (e) {
        e.preventDefault();
        crearDocumentos();
    });
    $(document).on("click", "#btnDocumentosPasoPrev", function (e) {
        e.preventDefault();
        DocumentosPasoPrev();
    });
    $(document).on("click", "#btnDocumentosPasoNext", function (e) {
        e.preventDefault();
        DocumentosPasoNext();
    });

    // 6. Botones de acción de Recursos
    $(document).on("click", "#btnNewRecursos", function (e) {
        e.preventDefault();
        newRecursos();
    });
    $(document).on("click", "#btnRecursosGuardar", function (e) {
        e.preventDefault();
        salvarRecursos();
    });
    $(document).on("click", "#btnRecursosBorrar", function (e) {
        e.preventDefault();
        borrarRecursos();
    });

    // 7. Botones de acción de POT
    $(document).on("click", "#btnNewPot", function (e) {
        e.preventDefault();
        newPot();
    });
    $(document).on("click", "#btnPotValidar", function (e) {
        e.preventDefault();
        validarPot();
    });
    $(document).on("click", "#btnPotGuardar", function (e) {
        e.preventDefault();
        salvarPot();
    });
    $(document).on("click", "#btnPotBorrar", function (e) {
        e.preventDefault();
        borrarPot();
    });

    // 8. Autenticación y Cierre de Sesión
    $(document).on("click", ".close-login-btn", function (e) {
        e.preventDefault();
        closeLogin();
    });
    $(document).on("click", "#logoutBtn", function (e) {
        e.preventDefault();
        signOut();
    });

    // 9. Cerrar Modal de Bienvenida
    $(document).on("click", ".close-bienvenida-btn", function (e) {
        e.preventDefault();
        $('#modalBienvenida').modal('hide');
    });

    // --- Eventos Existentes de Interfaz ---
    $('#headingSearch').on('click', function (e) {
        $('#mainDiv').toggleClass("collapsed pressed");
    });
});
