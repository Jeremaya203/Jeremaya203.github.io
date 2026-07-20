$(document).ready(function () {
    if (window.OOT && window.OOT.loadShell) {
        window.OOT.loadShell();
    }
    
    setTimeout(function () {
        $('.calltocontext').hide();
    }, 5000);

    // --- Vinculación de Eventos para CSP ---
    
    // 1. Limpiar búsqueda
    $(document).on("click", ".btn-limpiar", function (e) {
        e.preventDefault();
        limpiarMain();
    });

    // 2. Limpiar palabra clave
    $(document).on("click", ".clearTextBtn3", function (e) {
        e.preventDefault();
        limpiaPalabra();
    });

    // 3. Compartir enlace
    $(document).on("click", ".shareLink", function (e) {
        e.preventDefault();
        shareLink();
    });

    // 4. Ir a fase de búsqueda
    $(document).on("click", ".btn-goto-fase", function (e) {
        e.preventDefault();
        var fase = $(this).data("fase");
        gotoSearchFase(fase);
    });

    // 5. Volver a búsqueda principal
    $(document).on("click", ".volver-btn", function (e) {
        e.preventDefault();
        backSearchMain();
    });

    // 6. Filtrar mapas
    $(document).on("click", ".btn-filter-mapas", function (e) {
        e.preventDefault();
        filterMapas();
    });

    // 7. Filtrar documentos
    $(document).on("click", ".btn-filter-documentos", function (e) {
        e.preventDefault();
        filterDocumentos();
    });

    // 8. Elementos sin acción (no-click)
    $(document).on("click", ".no-click", function (e) {
        e.preventDefault();
    });

    // 9. Cerrar alerta de avisos
    $(document).on("click", ".btn-close-alert", function (e) {
        e.preventDefault();
        $('#alertList').hide();
    });

    // 10. Cambiar cantidad de documentos a mostrar
    $(document).on("click", ".btn-change-len", function (e) {
        e.preventDefault();
        var len = $(this).data("len");
        changeLenDocs(len);
    });

    // 11. Volver del detalle del documento
    $(document).on("click", ".btn-back-detalle", function (e) {
        e.preventDefault();
        backDetalleDocumento();
    });

    // 12. Cerrar tutorial
    $(document).on("click", ".btn-close-tutorial", function (e) {
        e.preventDefault();
        $('#modalTutorial').modal('hide');
    });

    // 13. Cerrar Login
    $(document).on("click", ".close-login-btn", function (e) {
        e.preventDefault();
        closeLogin();
    });

    // 14. Cerrar sesión
    $(document).on("click", "#logoutBtn", function (e) {
        e.preventDefault();
        signOut();
    });

    // --- Eventos Existentes de Interfaz ---
    $('#headingSearch').on('click', function (e) {
        $('#mainDiv').toggleClass("collapsed pressed");
        if (typeof toggleMenu === 'function') {
            toggleMenu();
        }
    });

    $('.rep-documentos').on('click', function (e) {
        $('.rep-documentos').toggleClass('active');
        if ($('.rep-documentos').hasClass('active')) {
            $('.rep-mapas').removeClass('active');
        }
    });
    
    $('.rep-mapas').on('click', function (e) {
        $('.rep-mapas').toggleClass('active');
        if ($('.rep-mapas').hasClass('active')) {
            $('.rep-documentos').removeClass('active');
        }
    });
});
