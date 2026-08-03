(function initializeCharacterizationsFooter() {
    "use strict";

    const footer = document.querySelector("footer.footer");
    if (!footer) return;

    footer.className = "footer characterizations-footer";
    footer.innerHTML = `
        <div class="containerf">
            <div class="footer-container">
                <div class="rowf">
                    <div class="col-md-6f">
                        <h2 class="footer-titulo">Instituto Geográfico Agustín Codazzi - IGAC</h2>
                    </div>
                    <div class="logos-footer col-md-6f">&nbsp;</div>
                </div>

                <div class="rowf">
                    <div class="col-md-6f">
                        <h2 class="sub-titulo-sede-gov-co">Información sede principal</h2>
                        <h3>Dirección:</h3>
                        <p>Bogotá D.C. - Carrera 30 # 48-51</p>
                        <h3>Horarios de atención al ciudadano:</h3>
                        <p>Abierto al público de lunes a viernes de 9:00 a.m. a 4:00 p.m. jornada continua Sede Central y territorial Cundinamarca (Horario de atención temporal acatando las medidas y demás regulaciones de bioseguridad)</p>
                        <h3>Teléfono Conmutador:</h3>
                        <p><a class="btn" href="tel:6016531888">+57 601 653 18 88</a></p>
                        <h3>Correo de contacto:</h3>
                        <p><a class="btn" href="mailto:contactenos@igac.gov.co">contactenos@igac.gov.co</a></p>
                        <h3>Correo de notificaciones judiciales:</h3>
                        <p><a class="btn" href="mailto:judiciales@igac.gov.co">judiciales@igac.gov.co</a></p>
                        <p>NIT: 8999990049</p>
                        <p>©Copyright 2024 - Todos los derechos reservados Gobierno de Colombia</p>
                    </div>

                    <div class="col-md-6f">
                        <h3>Contáctenos en nuestras redes sociales</h3>
                        <div class="redes-sociales">
                            <p><a class="btn" href="https://www.facebook.com/IgacColombia" tabindex="-1" target="_blank" rel="noopener"><img alt="Visitar Facebook IGAC" class="icono-redes" src="../images/footer/facebook.svg">Facebook IGAC</a></p>
                            <p><a class="btn" href="https://twitter.com/igacColombia" tabindex="-1" target="_blank" rel="noopener"><img alt="Visitar Twitter IGAC" class="icono-redes" src="../images/footer/twitter.svg">Twitter IGAC</a></p>
                            <p><a class="btn" href="https://www.instagram.com/accounts/login/?next=/igacColombia/" tabindex="-1" target="_blank" rel="noopener"><img alt="Visitar Instagram IGAC" class="icono-redes" src="../images/footer/instagram.svg">Instagram IGAC</a></p>
                        </div>
                        <div class="footer-enlaces">
                            <a class="btn">Políticas</a>
                            <a class="btn">Mapa del sitio</a>
                            <a class="btn">Términos y condiciones</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="gov-co-footer-pie">
            <div class="gov-co-footer-auto containerf">
                <img alt="Logo marca de Colombia" class="gov-co-logo-pie-blanco" src="../images/footer/marca_colombia.png">
                <img alt="Logo de Gov Co" class="gov-co-logo-pie-mesa" src="../images/footer/header_govco.png">
                <a class="btn" href="https://www.gov.co" target="_blank" rel="noopener">Conoce GOV.CO aquí</a>
            </div>
        </div>`;
})();
