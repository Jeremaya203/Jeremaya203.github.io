#!/usr/bin/env python3
"""Comprueba los DOS documentos de diseno de `D:\\OOT\\Correcciones_Frontend`.

  CORRECIONES COLOMBIA OT 2.pdf    (2026-08-31)  7 paginas de capturas anotadas con el
                                   tamano y el color de cada rotulo de los tres modulos.
  LANDING CARACTERIZACIONES.docx   (2026-07-02)  la landing de Caracterizaciones:
                                   recursos, banner, tematicas, publico objetivo, footer.

Sin algo asi, "esta aplicado" acaba significando "recuerdo haberlo aplicado", y este
encargo ya perdio dos cosas por esa via: `.asunto-title` se retoco por un mapeo
equivocado, se corrigio anadiendo `#vp-asunto` y la regla mala se quedo puesta un mes; y
el .docx se daba por aplicado de memoria porque la primera version de este script solo
cubria el PDF.

Cada punto se comprueba buscando la regla concreta en el CSS o el texto en el HTML.
No sustituye la revision en navegador: comprueba que la regla ESTA, no que se VE bien.

Uso:
    python scripts/verificar_encargo.py

Codigos de salida:
    0  todo lo comprobable esta aplicado
    1  hay puntos comprobables sin aplicar
"""
from __future__ import annotations

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

APLICADO, PENDIENTE, DECISION = "APLICADO ", "PENDIENTE", "DECISION "

# (modulo, pagina del PDF, que pide, patron a encontrar en el CSS/HTML del repo)
PUNTOS: list[tuple[str, str, str, str]] = [
    ("Landing",  "p.1", "Texto introductorio nuevo",              r"es el espacio definitivo de partida"),
    ("Landing",  "p.1", "Titulo 'Colombia OT 2.0 en datos'",      r"Colombia OT 2\.0 en datos"),
    ("Landing",  "p.1", "Subtitulo del apartado de datos",        r"alcance de la plataforma a trav"),
    ("Consulta", "p.2", "Titulo 16px #fff",                       r"\.sidebar-logo-text\s*\{[^}]*16px[^}]*#fff"),
    ("Consulta", "p.2", "Scroll de la barra izquierda",           r"\.sidebar\s*\{ overflow-y: auto; min-height: 0"),
    ("Consulta", "p.2", "Barra de consulta mas baja",             r"\.input-textarea\s*\{ max-height"),
    ("Consulta", "p.3", "Historial 12px #c1dfff",                 r"\.sidebar-nav-title\s*\{[^}]*12px[^}]*#c1dfff"),
    ("Consulta", "p.3", "Datos 10px #ffffff80",                   r"\.faq-stat-label\s*\{[^}]*10px[^}]*#ffffff80"),
    ("Determ.",  "p.3", "Titulos Analisis 16px #fff",             r"#ie-determinantes-6\s*\{[^}]*16px[^}]*#fff"),
    ("Determ.",  "p.3", "Subtitulo Reglas 12px #c1dfff",          r"#ie-determinantes-20\s*\{[^}]*12px[^}]*#c1dfff"),
    ("Determ.",  "p.3", "Subtitulo Zona consulta 12px #c1dfff",   r"#upload-titulo\s*\{[^}]*12px[^}]*#c1dfff"),
    ("Determ.",  "p.4", "Fajas de exclusion 10px #7a9cc0",        r"\.rule-desc\s*\{[^}]*10px[^}]*#7a9cc0"),
    ("Determ.",  "p.4", "Zona dibujada 10px #7a9cc0",             r"#ie-determinantes-17\s*\{[^}]*10px[^}]*#7a9cc0"),
    ("Determ.",  "p.4", "Resultados del Analisis 15px #fff",      r"#ie-determinantes-49\s*\{[^}]*15px[^}]*#fff"),
    ("Determ.",  "p.4", "Determinantes y Mapa 12px #FFFFFF",      r"\.tab\s*\{[^}]*12px[^}]*#FFFFFF"),
    ("Determ.",  "p.4", "Municipio 10px #7a9cc0",                 r"#ie-determinantes-68\s*\{[^}]*10px[^}]*#7a9cc0"),
    ("Determ.",  "p.4", "Resultados 10px #c1dfff",                r"\.result-card-label\s*\{[^}]*10px[^}]*#c1dfff"),
    ("Determ.",  "p.5", "Nivel de la Determinante 12px #e0e8f2",  r"#ie-determinantes-70\s*\{[^}]*12px[^}]*#e0e8f2"),
    ("Indic.",   "p.5", "Titulo 16px #fff",                       r"#ie-indicadores-8\s*\{[^}]*16px[^}]*#fff"),
    ("Indic.",   "p.5", "Scroll de la barra izquierda",           r"#lista-indicadores\s*\{ min-height: 0"),
    ("Indic.",   "p.5", "Indicadores 12px #e0e8f2",               r"#ie-indicadores-16 \{[^}]*12px[^}]*#e0e8f2"),
    ("Indic.",   "p.5", "Departamento 12px #7a9cc0",              r"#ie-indicadores-17\s*\{[^}]*12px[^}]*#7a9cc0"),
    ("Indic.",   "p.6", "Departamento-Municipio 12px #27a880",    r"#scope-label-text\s*\{[^}]*12px[^}]*#27a880"),
    ("Indic.",   "p.6", "Como funciona? 12px #27a880",            r"#ie-indicadores-22\s*\{[^}]*12px[^}]*#27a880"),
    ("Indic.",   "p.6", "Seleccione un indicador 11px #7a9cc0",   r"#ie-indicadores-23\s*\{[^}]*11px[^}]*#7a9cc0"),
    ("Indic.",   "p.6", "Asentamientos Humanos 11px #7a9cc0",     r"#vp-asunto\s*\{[^}]*11px[^}]*#7a9cc0"),
    ("Indic.",   "p.6", "Discrepancia Urbano-Cat. 14px #e0e8f2",  r"#vp-nombre\s*\{[^}]*14px[^}]*#e0e8f2"),
    ("Indic.",   "p.6", "Porcentajes 12px #7a9cc0",               r"\.stat-label\s*\{[^}]*12px[^}]*#7a9cc0"),
    ("Indic.",   "p.7", "Subtitulos Resultados 12px #7a9cc0",     r"#ie-indicadores-65 \{[^}]*12px[^}]*#7a9cc0"),
]

# LANDING CARACTERIZACIONES.docx (2026-07-02). Se comprueban contra `caracterizaciones/`,
# que es codigo de otro desarrollador: aqui solo se mide si el punto del documento esta o
# no, nunca se reescribe su estilo.
PUNTOS_LANDING: list[tuple[str, str, str, str]] = [
    ("Landing", "Que son",   "Imagen del mapa = mapa_colombia.png", r'src="img/mapa_colombia\.png"'),
    ("Landing", "Tematicas", "Bubbles del mismo tamano (una sola medida)",
     r"\.tematicas__bubble \{[^}]*width: 195px; height: 260px;"),
    ("Landing", "Tematicas", "Texto fuera / icono hacia la punta",
     r"\.bubble__inner \{[^}]*column-reverse"),
    ("Landing", "Tematicas", "Diagrama a la izquierda, texto a la derecha",
     r"\.tematicas__bifocal"),
    ("Landing", "Tematicas", "Descripcion inicial = Ordenamiento Territorial",
     r"dataset\.topic === 'ordenamiento'"),
    ("Landing", "Tematicas", "La seleccionada crece", r"bubble--selected \{[^}]*scale\(1\.1\)"),
    ("Landing", "Tematicas", "Las no seleccionadas bajan de opacidad",
     r"not\(\.bubble--selected\) \{\s*opacity: \.38"),
    ("Landing", "Tematicas", "Fondos por tematica = 1..6.png",
     r"\.bubble--socioeconomicos\{ background: url\('\.\./img/6\.png'"),
    ("Landing", "Tematicas", "Iconos propios de cada tematica",
     r'src="img/pro_socieconomicos\.png"'),
    ("Landing", "Tematicas", "Boton 'Visita el visor' (asi en el mockup)",
     r">Visita el visor<"),
    ("Landing", "Tematicas", "Cada boton apunta a su visor", r"cardCta\.href\s*=\s*info\.url"),
    ("Landing", "Publico",   "Carrusel automatico", r"setInterval\(\(\) => show\(currentIndex \+ 1\)"),
    ("Landing", "Publico",   "Titulo y subtitulo centrados", r"\.publico-objetivo__tit"),
    ("Landing", "Estadist.", "Existe la seccion que sustituye a Contenidos",
     r'<section class="estadisticas" id="estadisticas">'),
    ("Landing", "Footer",    "Footer institucional compartido",
     r"characterizations-footer\.css"),
]

# Textos que el documento manda QUITAR. Se comprueban al reves: aplicado = ya no estan.
# En Determinantes el subtitulo se CONSERVA: el documento solo pide quitarlo en los otros
# dos modulos, y no hay forma de saber si el tercero es un olvido suyo o una decision.
ELIMINACIONES = [
    ("Consulta", "p.2", "Colombia OT 2.0 \u00b7 IGAC 2026", "Modulo_Chat_normativo.html", False),
    ("Determ.",  "p.4", "IGAC-Colombia",                    "Modulo_Determinantes.html",  True),
    ("Indic.",   "p.5", "Colombia OT 2.0 \u00b7 IGAC 2026", "Modulo_Indicadores.html",    False),
]

# Puntos que NO dependen del codigo sino de una respuesta del usuario o de un asset que
# nunca llego. No cuentan como fallo: se listan para que nadie los de por cerrados.
# Un punto del .docx donde el codigo dice lo CONTRARIO a proposito. No se toca sin decision:
# es codigo de otro desarrollador y el CSS que lo fija es POSTERIOR al documento.
DISCREPANCIAS = [
    ("Landing", "Que son", "El documento pide la imagen en el BORDE IZQUIERDO",
     "`css/index.css:521` la pega al borde DERECHO (`object-position: right center`) con un "
     "comentario que lo llama 'clave', y esa linea es del 2026-07-27, posterior al documento "
     "(2026-07-02). O el documento quedo sin aplicar, o se decidio lo contrario despues. "
     "Hace falta decir cual de las dos."),
]

BLOQUEADOS = [
    ("Landing", "p.1", "Apartado 'Estado planes POT' bajo Acerca del POT",
     "esa pagina no existe en el repo: decidir si es nueva, un wrapper de "
     "colombiaot.gov.co o algo ya existente con otro nombre"),
    ("Caracter.", "-", "Banner en bucle sin recortar",
     "falta recursos/banner.mp4"),
    ("Caracter.", "-", "Carrusel de Publico Objetivo (4 imagenes)",
     "faltan entes_t.png, plan_m.png, ges_c.png, otras.png"),
    ("Caracter.", "-", "Seccion de Estadisticas (8 cifras)",
     "faltan est_1..4.png y los ocho datos"),
    ("Caracter.", "-", "'Visitar plataforma' apunta al visor general",
     "en caracterizaciones/ no hay ningun visor general, solo los seis tematicos"),
    ("Micrositio", "-", "Login con los seis proveedores propios",
     "obliga a sustituir FirebaseUI por signInWithPopup en shared-auth-modal.js, "
     "config.js y maestra.js: es rehacer el login, no cambiar iconos"),
    ("Micrositio", "-", "Cartillas y Documentacion como micrositios",
     "los mockups son redisenos completos de pagina; falta decidir si entran"),
]


def fuentes() -> dict[str, str]:
    """Los CSS y HTML de la raiz: los tres modulos del PDF."""
    return {p.name: p.read_text(encoding="utf-8", errors="ignore")
            for p in list(RAIZ.glob("*.css")) + list(RAIZ.glob("*.html"))}


def fuentes_landing() -> dict[str, str]:
    """`caracterizaciones/`: la landing del .docx. Es codigo de otro desarrollador; aqui
    solo se mide si el punto del documento esta o no, nunca se reescribe su estilo."""
    base = RAIZ / "caracterizaciones"
    archivos = (list(base.glob("*.html")) + list(base.glob("css/*.css"))
                + list(base.glob("js/*.js")))
    return {p.relative_to(base).as_posix(): p.read_text(encoding="utf-8", errors="ignore")
            for p in archivos}


def _revisar(puntos, fuentes_, pendientes, etiqueta_ancho=40) -> None:
    for modulo, seccion, desc, patron in puntos:
        donde = next((n for n, s in fuentes_.items() if re.search(patron, s)), None)
        if not donde:
            pendientes.append(f"{modulo} {seccion}: {desc}")
        print(f"  [{APLICADO if donde else PENDIENTE}] {modulo:10} {seccion:9} "
              f"{desc:{etiqueta_ancho}} {donde or ''}")


def main() -> int:
    todo = fuentes()
    print(f"Encargos de diseno - {RAIZ}\n")
    pendientes: list[str] = []

    print("CORRECIONES COLOMBIA OT 2.pdf (2026-08-31)")
    _revisar(PUNTOS, todo, pendientes)

    print()
    for modulo, pagina, texto, archivo, conservado in ELIMINACIONES:
        sigue = texto in todo.get(archivo, "")
        if sigue and not conservado:
            pendientes.append(f"{modulo} {pagina}: quitar '{texto}'")
        estado = PENDIENTE if (sigue and not conservado) else APLICADO
        nota = "  (se conserva a proposito)" if sigue and conservado else ""
        print(f"  [{estado}] {modulo:10} {pagina:9} quitar '{texto}'{nota}")

    print("\nLANDING CARACTERIZACIONES.docx (2026-07-02)")
    _revisar(PUNTOS_LANDING, fuentes_landing(), pendientes, etiqueta_ancho=42)

    print("\nDiscrepancia - el codigo dice lo contrario y hace falta decidir cual manda:")
    for modulo, seccion, desc, motivo in DISCREPANCIAS:
        print(f"  [{DECISION}] {modulo:10} {seccion:9} {desc}")
        print(f"                          -> {motivo}")

    print("\nBloqueado - no es que se haya descartado, es que falta el insumo:")
    for modulo, pagina, desc, motivo in BLOQUEADOS:
        print(f"  [{DECISION}] {modulo:10} {pagina:9} {desc}")
        print(f"                          -> {motivo}")

    total = len(PUNTOS) + len(ELIMINACIONES) + len(PUNTOS_LANDING)
    print(f"\n{total - len(pendientes)} de {total} puntos comprobables aplicados; "
          f"{len(BLOQUEADOS)} bloqueados por insumo o decision y "
          f"{len(DISCREPANCIAS)} en discrepancia.")
    if pendientes:
        print("\nRESULTADO: FALLO - puntos comprobables sin aplicar:")
        for p in pendientes:
            print(f"  - {p}")
        return 1
    print("\nRESULTADO: OK - todo lo que depende del codigo esta aplicado.")
    print("Falta la revision en navegador: esto comprueba que la regla ESTA, no que se VE bien.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
