#!/usr/bin/env python3
"""Propaga la CSP de `_headers` a cada HTML como <meta http-equiv>.

Por que existe: el despliegue actual es GitHub Pages, que NO permite cabeceras HTTP
personalizadas. Sin esto, `_headers` no se aplica en ningun sitio y la pagina corre sin
CSP. La alternativa —escribir la politica a mano en cada HTML— crearia dos definiciones
que divergen al primer cambio; aqui `_headers` sigue siendo la unica fuente de verdad.

En <meta> el navegador IGNORA frame-ancestors, report-uri y sandbox (solo valen como
cabecera), asi que se retiran del meta para no dar una sensacion falsa de cobertura.
Cuando el despliegue pase a nginx/IIS, la cabecera y el meta se combinan por interseccion
y, al salir del mismo archivo, no pueden contradecirse.

Uso:
    python scripts/aplicar_csp.py            # aplica
    python scripts/aplicar_csp.py --check    # solo comprueba (devuelve 1 si falta algo)
"""
from __future__ import annotations

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
INICIO = "<!-- CSP:BEGIN generado por scripts/aplicar_csp.py — no editar a mano -->"
FIN = "<!-- CSP:END -->"
BLOQUE = re.compile(re.escape(INICIO) + r".*?" + re.escape(FIN) + r"\n?", re.S)
# Directivas sin efecto en <meta>: incluirlas solo confundiria a quien lea el HTML.
SOLO_CABECERA = ("frame-ancestors", "report-uri", "report-to", "sandbox")


def leer_politica() -> str:
    texto = (RAIZ / "_headers").read_text(encoding="utf-8")
    linea = next(
        (l for l in texto.splitlines() if l.strip().startswith("Content-Security-Policy:")),
        None,
    )
    if not linea:
        sys.exit("ERROR: no hay Content-Security-Policy en _headers")
    politica = linea.split(":", 1)[1].strip()
    directivas = [d.strip() for d in politica.split(";") if d.strip()]
    return "; ".join(d for d in directivas if d.split()[0] not in SOLO_CABECERA)


def main() -> int:
    solo_check = "--check" in sys.argv
    meta = f'{INICIO}\n<meta http-equiv="Content-Security-Policy" content="{leer_politica()}">\n{FIN}\n'

    cambiados, saltados, pendientes, ajenos = [], [], [], []
    for html in sorted(RAIZ.rglob("*.html")):
        if ".git" in html.parts:
            continue
        s = original = html.read_text(encoding="utf-8", errors="surrogateescape")
        s = BLOQUE.sub("", s)
        # Una pagina que ya trae SU PROPIA CSP no se toca. Dos <meta> no se suman: el
        # navegador aplica la INTERSECCION de ambas, asi que anadir la nuestra encima de
        # una politica ajena bloquea lo que esa politica permitia a proposito (el hash
        # sha256 de un script inline, 'wasm-unsafe-eval' de ArcGIS) y rompe la pagina.
        # Es el caso de caracterizaciones/, que tiene su propia CSP, mas estricta.
        if "Content-Security-Policy" in s:
            ajenos.append(html.relative_to(RAIZ).as_posix())
            continue
        m = re.search(r"<head[^>]*>\s*", s, re.I)
        if not m:
            # Fragmentos inyectados con innerHTML/$.get (Paso1.html, navbar.html…): no son
            # documentos, la CSP la aplica la pagina que los contiene.
            saltados.append(html.relative_to(RAIZ).as_posix())
            continue
        # Lo antes posible en el <head>: solo cubre lo que se declara despues de ella.
        s = s[: m.end()] + meta + s[m.end():]
        if s != original:
            (pendientes if solo_check else cambiados).append(html.relative_to(RAIZ).as_posix())
            if not solo_check:
                html.write_text(s, encoding="utf-8", errors="surrogateescape", newline="")

    if solo_check:
        for f in pendientes:
            print("desactualizado:", f)
        print(f"{len(pendientes)} HTML sin la CSP vigente; {len(saltados)} fragmentos omitidos; "
              f"{len(ajenos)} con politica propia")
        return 1 if pendientes else 0

    print(f"{len(cambiados)} HTML actualizados; {len(saltados)} fragmentos omitidos (sin <head>); "
          f"{len(ajenos)} respetados por tener CSP propia")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
