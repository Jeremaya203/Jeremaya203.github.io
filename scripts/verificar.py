#!/usr/bin/env python3
"""Compuerta de verificacion del frontend: un solo comando antes de mergear.

Este repo no tiene build, ni tests, ni linter de JS. Sin algo asi, "validado"
acaba significando "lo mire y me parecio bien", que es exactamente lo que no
sirve durante un refactor. Aqui viven las comprobaciones que SI se pueden
automatizar; la revision visual en navegador sigue siendo obligatoria y no la
reemplaza este script.

Uso:
    python scripts/verificar.py

Codigos de salida:
    0  todo lo comprobable paso
    1  alguna comprobacion FALLO
    2  todo lo ejecutado paso, pero algo quedo SALTADO (falta una herramienta).
       Se distingue a proposito: "no se pudo comprobar" no es "esta bien".
"""
from __future__ import annotations

import pathlib
import re
import shutil
import subprocess
import sys
import urllib.parse

RAIZ = pathlib.Path(__file__).resolve().parent.parent

# Librerias de terceros: su estilo y su sintaxis no son responsabilidad de este repo.
VENDOR = ("jquery", "shpwrite", "imagemapster", "connections", "select2", ".min.")

# Esquemas que no apuntan a un archivo del repo.
EXTERNOS = ("http://", "https://", "//", "data:", "mailto:", "tel:", "#", "javascript:")

OK, FALLO, SALTADO = "OK     ", "FALLO  ", "SALTADO"

# Deuda aceptada hoy, MEDIDA, no estimada. Bajarla es el objetivo; que suba es un fallo.
# Si baja, hay que actualizar estos numeros o la compuerta esconde la mejora.
#
# Las 26 `var` que quedan estan justificadas UNA A UNA: el conversor las rechazo por
# redeclaracion, por dependencia del hoisting, por colgar de un control de flujo sin llaves
# o por usarse fuera de su bloque. Convertirlas a la fuerza cambia el ambito y rompe en
# ejecucion, que es un precio absurdo por un numero mas bonito.
VAR_PERMITIDAS = 26
MUERTAS_PERMITIDAS = 8


def es_propio(ruta: pathlib.Path) -> bool:
    return not any(v in ruta.as_posix().lower() for v in VENDOR)


def htmls() -> list[pathlib.Path]:
    return [p for p in sorted(RAIZ.rglob("*.html")) if ".git" not in p.parts]


def comprobar_sintaxis_js() -> tuple[str, str]:
    """`node --check` sobre el JS propio. Es lo mas parecido a un compilador que hay."""
    if not shutil.which("node"):
        return SALTADO, "node no esta en el PATH"
    malos = []
    total = 0
    for p in sorted(RAIZ.rglob("*.js")):
        if ".git" in p.parts or not es_propio(p):
            continue
        total += 1
        r = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
        if r.returncode != 0:
            malos.append(f"{p.relative_to(RAIZ).as_posix()}: {r.stderr.strip().splitlines()[0]}")
    if malos:
        return FALLO, f"{len(malos)} de {total} archivos con error de sintaxis:\n      " + "\n      ".join(malos[:10])
    return OK, f"{total} archivos JS propios sin errores de sintaxis"


def comprobar_csp() -> tuple[str, str]:
    """La CSP de cada pagina sale de `_headers`; aqui solo se comprueba que este al dia."""
    script = RAIZ / "scripts" / "aplicar_csp.py"
    if not script.exists():
        return SALTADO, "falta scripts/aplicar_csp.py"
    r = subprocess.run(
        [sys.executable, str(script), "--check"], capture_output=True, text=True, cwd=RAIZ
    )
    salida = (r.stdout or r.stderr).strip().splitlines()
    resumen = salida[-1] if salida else "sin salida"
    return (OK if r.returncode == 0 else FALLO), resumen


def comprobar_inline() -> tuple[str, str]:
    """Ni un <style> ni un <script> con cuerpo: la CSP los bloquea en produccion.

    Rompen la pagina publicada aunque en local se vea bien, porque en local no se
    aplican las cabeceras. El atributo style= SI se permite (style-src-attr), asi que
    no se comprueba: lo necesitan librerias de terceros minificadas.
    """
    bloques, scripts = [], []
    for p in htmls():
        s = p.read_text(encoding="utf-8", errors="ignore")
        rel = p.relative_to(RAIZ).as_posix()
        if re.search(r"<style[\s>]", s, re.I):
            bloques.append(rel)
        for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, re.S | re.I):
            if m.group(1).strip():
                scripts.append(rel)
                break
    if bloques or scripts:
        detalle = []
        if bloques:
            detalle.append(f"<style> en: {', '.join(bloques[:5])}")
        if scripts:
            detalle.append(f"<script> con cuerpo en: {', '.join(scripts[:5])}")
        return FALLO, " | ".join(detalle)
    return OK, f"{len(htmls())} HTML sin <style> ni <script> embebido"


def comprobar_referencias() -> tuple[str, str]:
    """Todo src/href local apunta a un archivo que existe.

    Dos reglas que no son evidentes:
    - `%BASE%/...` lo sustituye config.js en tiempo de ejecucion por la raiz del sitio,
      asi que se resuelve contra la raiz del repo. Y se hace ANTES de urlunquote: `%BA`
      es un escape porcentual valido y unquote lo destroza.
    - Los fragmentos (HTML sin <head>: navbar, footer, los pasos de la ruta POT) se
      inyectan en otra pagina, asi que sus rutas relativas NO se resuelven desde su
      propia carpeta. Se omiten en vez de reportar falsos positivos.
    """
    patron = re.compile(r'(?:src|href)\s*=\s*"([^"]+)"')
    rotas = []
    total = 0
    for p in htmls():
        s = p.read_text(encoding="utf-8", errors="ignore")
        if not re.search(r"<head[\s>]", s, re.I):
            continue
        for ref in patron.findall(s):
            if ref.startswith(EXTERNOS):
                continue
            crudo = ref.split("?")[0].split("#")[0]
            if not crudo:
                continue
            total += 1
            base = RAIZ if crudo.startswith("%BASE%/") else p.parent
            destino = base / urllib.parse.unquote(crudo.replace("%BASE%/", ""))
            if not destino.exists():
                rotas.append(f"{p.relative_to(RAIZ).as_posix()} -> {ref}")
    if rotas:
        return FALLO, f"{len(rotas)} de {total} referencias rotas:\n      " + "\n      ".join(rotas[:10])
    return OK, f"{total} referencias locales resuelven a un archivo existente"


# El patron se ARMA en ejecucion: con los caracteres escritos aqui, este archivo se
# detectaria a si mismo y la comprobacion no podria dar cero nunca.
_RANGOS = ((0x1F000, 0x1FAFF), (0x2700, 0x27BF), (0x2B00, 0x2BFF))
_SUELTOS = (0x2705, 0x274C, 0x2714, 0x2716, 0x26A0)
EMOJI = re.compile(
    "[" + "".join(f"{chr(a)}-{chr(b)}" for a, b in _RANGOS)
        + "".join(chr(c) for c in _SUELTOS) + "]"
)

# Nucleo del OOT: lo que este equipo mantiene. `caracterizaciones/` y `colombia-ot/` son de
# otro desarrollador y codigo scrapeado; medirlos aqui solo generaria ruido que nadie puede
# arreglar sin pisar trabajo ajeno.
def _nucleo() -> list[pathlib.Path]:
    fuera = ("caracterizaciones", "colombia-ot", "cargue", "lib")
    return [p for p in sorted(RAIZ.rglob("*.js"))
            if es_propio(p) and not any(x in p.parts for x in fuera)]


def comprobar_emojis() -> tuple[str, str]:
    """C4 — un estado semantico es texto o una clase CSS, nunca un glifo.

    Con emoji, el veredicto depende de que el sistema del usuario tenga la fuente de color
    instalada; sin ella, "no viable" y "compatible" se ven igual: un cuadrito vacio.
    """
    encontrados = []
    for p in _nucleo():
        n = len(EMOJI.findall(p.read_text(encoding="utf-8", errors="ignore")))
        if n:
            encontrados.append(f"{p.relative_to(RAIZ).as_posix()}: {n}")
    if encontrados:
        return FALLO, f"{len(encontrados)} archivo(s) con emoji: " + ", ".join(encontrados[:4])
    return OK, f"{len(_nucleo())} archivos del nucleo sin emojis"


def comprobar_var() -> tuple[str, str]:
    """C5 — `var` prohibido en codigo nuevo.

    Las que quedan estan justificadas una a una (redeclaracion, dependencia del hoisting,
    uso fuera del bloque). Se cuentan para que no CREZCAN: convertirlas no es el objetivo,
    que no aparezcan nuevas si lo es.
    """
    patron = re.compile(r"^\s*var\s+[A-Za-z_$]", re.M)
    total = sum(len(patron.findall(p.read_text(encoding="utf-8", errors="ignore")))
                for p in _nucleo())
    if total > VAR_PERMITIDAS:
        return FALLO, f"{total} declaraciones `var` en el nucleo (linea base: {VAR_PERMITIDAS})"
    return OK, f"{total} `var` en el nucleo, ninguna nueva (base {VAR_PERMITIDAS})"


def comprobar_funciones_sin_usar() -> tuple[str, str]:
    """C2 — el codigo muerto se borra, no se comenta.

    Se busca en todo el nucleo MAS los HTML, porque una funcion puede invocarse solo desde
    un `data-oot-click`. Sin mirar el HTML, el detector marcaria como muertos los 31
    manejadores.
    """
    fuentes = {p: p.read_text(encoding="utf-8", errors="ignore") for p in _nucleo()}
    html = " ".join(p.read_text(encoding="utf-8", errors="ignore") for p in htmls())
    todo = " ".join(fuentes.values()) + html
    muertas = []
    for p, s in fuentes.items():
        for m in re.finditer(r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(", s, re.M):
            n = m.group(1)
            usos = (len(re.findall(r"(?<![\w.$])" + re.escape(n) + r"(?![\w$])", todo))
                    - len(re.findall(r"function\s+" + re.escape(n) + r"\s*\(", todo)))
            if usos == 0:
                muertas.append(f"{p.relative_to(RAIZ).as_posix()}:{n}")
    if len(muertas) > MUERTAS_PERMITIDAS:
        return FALLO, (f"{len(muertas)} funciones sin referencias (base {MUERTAS_PERMITIDAS}): "
                       + ", ".join(sorted(muertas)[:5]))
    return OK, f"{len(muertas)} funciones sin referencias (base {MUERTAS_PERMITIDAS})"


# Puntos de entrada de modulos ES. Se comprueban importandolos en Node: eso resuelve TODO
# el grafo y verifica que cada nombre importado exista de verdad en su modulo de origen.
ENTRADAS_MODULO = (
    "js/determinantes/index.js",
    "js/indicadores/index.js",
    "js/chat-normativo.js",
    "js/pagina-principal.js",
    "js/especificaciones.js",
)
# `config.js`, `oot.js`, `mobile-warning.js` y `shared-auth*.js` siguen siendo scripts
# CLASICOS a proposito: definen `window.OOT` y los globales que consume el resto (incluidos
# los sub-proyectos ajenos), y con `type="module"` dejarian de colgarse de `window`.


def comprobar_grafo_modulos() -> tuple[str, str]:
    """El grafo de imports resuelve y cada `import { X }` encuentra su `export`.

    Es la comprobacion de equivalencia de la particion en modulos ES. En un script
    clasico, mover una funcion y dejar atras su ayudante no daba error hasta que alguien
    pulsaba el boton; al importar el modulo, revienta aqui.

    Lo que NO cubre: identificadores indefinidos dentro de funciones que no llegan a
    ejecutarse al importar. Para eso sigue haciendo falta el navegador.
    """
    if not shutil.which("node"):
        return SALTADO, "node no esta en el PATH"
    script = RAIZ / "scripts" / "comprobar_modulos.mjs"
    if not script.exists():
        return SALTADO, "falta scripts/comprobar_modulos.mjs"
    faltan = [e for e in ENTRADAS_MODULO if not (RAIZ / e).exists()]
    if faltan:
        return FALLO, f"puntos de entrada inexistentes: {', '.join(faltan)}"
    r = subprocess.run(["node", str(script), *ENTRADAS_MODULO],
                       capture_output=True, text=True, cwd=RAIZ)
    if r.returncode != 0:
        malas = [ln.strip() for ln in r.stdout.splitlines() if "FALLO" in ln]
        return FALLO, "\n      ".join(malas) or r.stderr.strip()[:300]
    return OK, f"{len(ENTRADAS_MODULO)} grafos de modulos ES resuelven completos"


def comprobar_asignacion_a_importados() -> tuple[str, str]:
    """Ni `x = v` ni `++x` sobre un nombre importado de `estado.js`.

    El estado compartido de cada paquete vive en su `estado.js` y el resto lo importa.
    Un `import` es un enlace de SOLO LECTURA: escribirlo es un TypeError en ejecucion,
    que ni `node --check` ni la carga del grafo detectan — solo aparece al pulsar el
    control que lo dispara. Las asignaciones ya pasan por setter; los incrementos son
    el caso que se escapa a la vista porque no llevan `=`.
    """
    malos = []
    for entrada in ENTRADAS_MODULO:
        paquete = (RAIZ / entrada).parent
        estado = paquete / "estado.js"
        if not estado.exists():
            continue
        exportado = set(re.findall(r"^export let ([A-Za-z_$][\w$]*)",
                                   estado.read_text(encoding="utf-8"), re.M))
        if not exportado:
            continue
        alterna = "|".join(re.escape(n) for n in sorted(exportado))
        asigna = re.compile(rf"(?<![.\w$])({alterna})\s*(?:\+|-|\*|/|\|\||\?\?)?=(?!=)")
        incrementa = re.compile(rf"(?:\+\+|--)\s*({alterna})\b|\b({alterna})\s*(?:\+\+|--)")
        for p in sorted(paquete.glob("*.js")):
            if p.name == "estado.js":
                continue
            for i, ln in enumerate(p.read_text(encoding="utf-8").split("\n"), 1):
                if ln.lstrip().startswith("//"):
                    continue
                if asigna.search(ln) or incrementa.search(ln):
                    malos.append(f"{p.relative_to(RAIZ).as_posix()}:{i}: {ln.strip()[:70]}")
    if malos:
        return FALLO, (f"{len(malos)} escritura(s) sobre un enlace importado (usar el "
                       "setter de estado.js):\n      " + "\n      ".join(malos[:8]))
    return OK, "ninguna escritura directa sobre un enlace de modulo importado"


def comprobar_manejadores() -> tuple[str, str]:
    """Todo `data-oot-*` resuelve contra algo: el registro de oot.js o un global.

    En un script clasico una `function` de nivel superior queda colgada de `window` y el
    respaldo de oot.js la encuentra; por eso los modulos que siguen siendo clasicos
    (chat, pagina principal) no necesitan registro. En un modulo ES NO se cuelga nada de
    `window`: si el manejador no esta en el registro, el control queda mudo y no se
    imprime ningun error en consola.

    Asi se detecto que `_mobTab` y `_mobIndTab` (las barras moviles de determinantes e
    indicadores) se habrian quedado sin responder al pasar esos dos modulos a ES.
    """
    paquetes = {(RAIZ / e).parent for e in ENTRADAS_MODULO}
    usados: dict[str, set[str]] = {}
    registrados: set[str] = set()
    globales: set[str] = set()
    for p in _nucleo() + htmls():
        s = p.read_text(encoding="utf-8", errors="ignore")
        for ln in s.splitlines():
            if ln.lstrip().startswith(("//", "*")):
                continue          # el ejemplo del comentario de oot.js no es un uso
            for m in re.finditer(r'data-oot-(?:click|change|input|keydown)="([^"]+)"', ln):
                usados.setdefault(m.group(1), set()).add(p.relative_to(RAIZ).as_posix())
        registrados |= set(re.findall(r"OOT\.registrar\(\s*['\"]([^'\"]+)", s))
        # `mapa` es el nombre que tenian los registros antes de que hubiera un mapa
        # importado al que tapar; en los paquetes ES pasa a llamarse `manejadores`.
        for m in re.finditer(r"const (?:mapa|manejadores) = \{(.*?)\n  \};", s, re.S):
            registrados |= set(re.findall(r"^\s*([A-Za-z_$][\w$]*)\s*,\s*$", m.group(1), re.M))
        if p.parent not in paquetes and p.suffix == ".js":
            globales |= set(re.findall(r"^\s*(?:async )?function ([A-Za-z_$][\w$]*)", s, re.M))
            globales |= set(re.findall(r"^\s*window\.([A-Za-z_$][\w$]*)\s*=", s, re.M))
    # `OOT.algo` se resuelve contra el objeto OOT, no contra el registro ni window.
    huerfanos = sorted(n for n in usados
                       if n not in registrados and n not in globales and not n.startswith("OOT."))
    if huerfanos:
        detalle = [f"{n} (en {', '.join(sorted(usados[n])[:2])})" for n in huerfanos[:6]]
        return FALLO, f"{len(huerfanos)} manejador(es) sin resolver: " + "; ".join(detalle)
    en_modulo = sum(1 for n in usados if n in registrados)
    return OK, (f"{len(usados)} manejadores data-oot-* resuelven "
                f"({en_modulo} por registro, el resto por window desde scripts clasicos)")


def comprobar_firebase_unico() -> tuple[str, str]:
    """C3 — la configuracion de Firebase se declara en UN solo sitio.

    Estuvo copiada en cuatro archivos. Duplicarla no falla de forma visible:
    `initializeApp` solo crea la app [DEFAULT] la primera vez y el resto de llamadas se
    ignoran, asi que la pagina acaba hablando con el proyecto de quien llego primero y el
    archivo que nadie actualizo parece correcto.

    `caracterizaciones/` queda fuera: es de otro desarrollador y tiene su propio arranque
    de sesion, sin pasar por `config.js`. Se cuenta aparte, no se exige.
    """
    fuentes = [p for p in sorted(RAIZ.rglob("*.js"))
               if es_propio(p) and ".git" not in p.parts
               and "caracterizaciones" not in p.parts]
    declara, respaldo = [], []
    for p in fuentes:
        s = p.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"apiKey\s*:", s):
            rel = p.relative_to(RAIZ).as_posix()
            linea = s[:m.start()].count("\n") + 1
            inicio = s.rfind("\n", 0, m.start()) + 1
            if s[inicio:m.start()].lstrip().startswith(("//", "*")):
                continue          # ejemplo comentado, no una declaracion
            # `window.OOT_FIREBASE || {` justo antes del literal = respaldo declarado, no
            # una fuente de verdad paralela. Se exige que el `||` abra ESE objeto, no que
            # aparezca en cualquier parte: `window.OOT_FIREBASE = window.OOT_FIREBASE ||`
            # precede a la declaracion buena y no debe confundirse con un respaldo.
            ventana = s[max(0, m.start() - 200):m.start()]
            es_respaldo = re.search(r"OOT_FIREBASE\s*\|\|\s*\{\s*$", ventana)
            (respaldo if es_respaldo else declara).append(f"{rel}:{linea}")
    # La regla es un solo ARCHIVO, no un solo literal: `config.js` declara a proposito el
    # proyecto institucional y el de desarrollo, y elige por nombre de host. Lo que no
    # puede volver a pasar es que la configuracion viva en dos archivos que no se hablan.
    archivos = sorted({d.rsplit(":", 1)[0] for d in declara})
    if len(archivos) > 1:
        return FALLO, ("la configuracion de Firebase vuelve a estar en varios archivos: "
                       + ", ".join(declara))
    if not declara:
        return FALLO, "no se encuentra ninguna declaracion de la configuracion de Firebase"
    if archivos[0] != "config.js":
        return FALLO, f"la configuracion de Firebase salio de config.js: esta en {archivos[0]}"
    # Toda llamada a initializeApp va guardada. Hay paginas que cargan DOS arranques de
    # Firebase (`cargue/index.html` y `colombia-ot/pot/*` traen ademas `config.js`): la
    # segunda llamada sin guarda lanza `app/duplicate-app`, que en jQuery aborta el
    # `$(document).ready` entero — sin login y sin el resto del modulo.
    sin_guarda = []
    for p in fuentes:
        s = p.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"^(?!\s*(?://|\*)).*\bfirebase\.initializeApp\(", s, re.M):
            # La guarda puede ir en la misma linea o abrir un bloque justo encima:
            # `if (!firebase.apps.length) {` + la llamada debajo (asi esta en
            # shared-auth.js). Mirar solo la linea de la llamada da un falso positivo.
            fin = s.find("\n", m.start())
            contexto = s[max(0, s.rfind("\n", 0, m.start()) - 120):fin if fin != -1 else None]
            if "firebase.apps.length" not in contexto:
                sin_guarda.append(f"{p.relative_to(RAIZ).as_posix()}:"
                                  f"{s[:m.start()].count(chr(10)) + 1}")
    if sin_guarda:
        return FALLO, ("initializeApp sin guarda `!firebase.apps.length` en: "
                       + ", ".join(sin_guarda))
    fuera = len([p for p in RAIZ.rglob("caracterizaciones/**/*.js")
                 if "apiKey" in p.read_text(encoding="utf-8", errors="ignore")])
    resumen = (f"{len(declara)} entorno(s) en {archivos[0]}, {len(respaldo)} respaldo(s), "
               f"todo initializeApp guardado; {fuera} en caracterizaciones/, fuera de alcance")

    # Y a QUE proyecto apunta cada ambiente de verdad: se ejecuta `config.js` con el DOM
    # simulado en vez de leerlo a ojo. Un error en la tabla POR_HOST publicaria el sitio
    # institucional contra el proyecto de desarrollo sin que fallara nada visible.
    script = RAIZ / "scripts" / "comprobar_firebase.mjs"
    if not shutil.which("node"):
        return SALTADO, resumen + " — falta node para comprobar la resolucion por host"
    if not script.exists():
        return SALTADO, resumen + " — falta scripts/comprobar_firebase.mjs"
    r = subprocess.run(["node", str(script)], capture_output=True, text=True, cwd=RAIZ)
    if r.returncode != 0:
        malas = [ln.strip() for ln in r.stdout.splitlines() if "FALLO" in ln]
        return FALLO, "\n      ".join(malas) or r.stderr.strip()[:300]
    return OK, resumen + "; los 5 ambientes resuelven al proyecto que les toca"


def comprobar_bom_desplazado() -> tuple[str, str]:
    """Ningun U+FEFF fuera del byte 0. Es el fallo mas silencioso que ha tenido este repo.

    Un BOM al principio del archivo lo descarta el parser y no molesta. Uno en MEDIO no:
    en CSS es un token inesperado en el nivel superior, asi que el parser se lo traga y
    sigue consumiendo hasta la siguiente `{` — devorando de paso todo lo que haya entre
    medias. Eso fue exactamente lo que paso el 2026-09-02: se anadio un comentario de
    aviso al principio de tres hojas que empezaban con BOM, el BOM quedo en el byte ~470,
    y el parser se comio el `@import` de las fuentes MAS el bloque `:root` entero de
    `oot-complementario.css`. Con `--gradient-page` sin definir, `.oot-home` se quedo sin
    fondo y la portada aparecia con texto blanco sobre blanco de la mitad para abajo.

    No lo detecto NADA durante cinco dias: la hoja carga con 200, parsea 199 reglas, no
    hay error en consola, `node --check` no mira CSS y las referencias resuelven. Solo se
    ve abriendo la pagina y mirando hacia abajo.

    Los archivos con BOM en el byte 0 se listan a proposito: son los que repetirian el
    fallo si alguien les antepone una linea.
    """
    fuera = ("caracterizaciones", "colombia-ot", ".git")
    desplazados, con_bom_inicial = [], []
    for p in sorted(list(RAIZ.rglob("*.css")) + list(RAIZ.rglob("*.js"))
                    + list(RAIZ.rglob("*.html"))):
        if any(x in p.parts for x in fuera) or not es_propio(p):
            continue
        crudo = p.read_bytes()
        pos = crudo.find(b"\xef\xbb\xbf")
        if pos == 0:
            con_bom_inicial.append(p.relative_to(RAIZ).as_posix())
        elif pos > 0:
            desplazados.append(f"{p.relative_to(RAIZ).as_posix()}:byte {pos}")
    if desplazados:
        return FALLO, ("BOM (U+FEFF) fuera del byte 0 — se come lo que venga detras hasta "
                       "la siguiente llave:\n      " + "\n      ".join(desplazados))
    return OK, (f"ningun BOM desplazado; {len(con_bom_inicial)} archivo(s) empiezan con "
                f"BOM y NO se les debe anteponer texto: "
                + ", ".join(con_bom_inicial[:4])
                + (" ..." if len(con_bom_inicial) > 4 else ""))


def main() -> int:
    comprobaciones = [
        ("sintaxis JS", comprobar_sintaxis_js),
        ("BOM desplazado", comprobar_bom_desplazado),
        ("CSP al dia", comprobar_csp),
        ("sin inline", comprobar_inline),
        ("referencias", comprobar_referencias),
        ("sin emojis", comprobar_emojis),
        ("var acotadas", comprobar_var),
        ("sin codigo muerto", comprobar_funciones_sin_usar),
        ("grafo de modulos", comprobar_grafo_modulos),
        ("estado importado", comprobar_asignacion_a_importados),
        ("manejadores", comprobar_manejadores),
        ("firebase unico", comprobar_firebase_unico),
    ]
    estados = []
    print(f"Verificacion del frontend — {RAIZ}\n")
    for nombre, fn in comprobaciones:
        estado, detalle = fn()
        estados.append(estado)
        print(f"  [{estado}] {nombre}: {detalle}")

    print()
    if FALLO in estados:
        print("RESULTADO: FALLO — no mergear hasta corregirlo.")
        return 1
    if SALTADO in estados:
        print("RESULTADO: incompleto — algo no se pudo comprobar (no es lo mismo que estar bien).")
        return 2
    print("RESULTADO: OK — falta la revision visual en navegador, que este script NO cubre.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
