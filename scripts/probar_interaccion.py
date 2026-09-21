#!/usr/bin/env python3
"""Pulsa los controles reales de cada pagina en un navegador y recoge lo que falla.

Por que existe: `scripts/verificar.py` comprueba que el codigo CARGA. Esto comprueba que
RESPONDE. La diferencia importa desde que los modulos son ES: un identificador indefinido
dentro de un manejador no da error al importar el modulo — solo cuando alguien pulsa el
boton. Ni `node --check` ni el grafo de imports lo ven.

Ya cazo dos fallos de esa familia antes de existir (`_mobTab` fuera del registro y
`++_fetchToken` sobre un enlace importado); esto los habria detectado solo.

Como funciona: arranca Chrome sin ventana, se conecta por el protocolo de DevTools,
DESACTIVA la barrera de sesion (le pone `window.__ootAuthGuardStarted = true` antes de que
corra `config.js`, que es la primera guarda del propio guardian) y pulsa uno a uno todos
los `[data-oot-click]` de cada pagina, recogiendo excepciones y avisos de consola.

Lo que NO cubre: que se VEA bien. Solo dice que nada revienta al pulsar.

Uso:
    python -m http.server 5500          # en otra consola, desde la raiz del repo
    python scripts/probar_interaccion.py
    python scripts/probar_interaccion.py --base http://localhost:5500 --puerto 9223

Codigos de salida:
    0  ningun control fallo
    1  hubo excepciones o manejadores sin resolver
    2  no se pudo ejecutar (falta Chrome, o el servidor no responde)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

# Controles que NO se pulsan y por que. Sin esta lista la prueba abre dialogos de archivo,
# lanza analisis de minutos contra el backend o gasta cupo del LLM.
NO_PULSAR = {
    "ejecutarAnalisis":              "lanza el analisis completo contra el backend",
    "enviarPregunta":                "gasta cupo del LLM",
    "exportarChat":                  "descarga un archivo",
    "descargarReporte":              "descarga un archivo",
    "descargarDeterminantesGeoJSON": "descarga un archivo",
    "descargarDeterminantesSHP":     "descarga un archivo",
    "_ootTriggerFile":               "abre el dialogo de archivos del sistema",
    "finalizarDibujo":               "necesita vertices dibujados antes",
}

PAGINAS = [
    "index.html",
    "Modulo_Determinantes.html",
    "Modulo_Indicadores.html",
    "Modulo_Chat_normativo.html",
    "Modulo_Especificaciones.html",
]

# `window.__ootAuthGuardStarted` es la PRIMERA guarda del guardian de `config.js`:
# ponerlo antes hace que se salga sin bloquear. No se toca ningun archivo del repo.
SIN_BARRERA = "window.__ootAuthGuardStarted = true;"


def navegador() -> str | None:
    for ruta in (
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ):
        if pathlib.Path(ruta).exists():
            return ruta
    return shutil.which("chrome") or shutil.which("chromium") or shutil.which("msedge")


class Sesion:
    """Cliente minimo del protocolo de DevTools sobre una sola pestana."""

    def __init__(self, ws):
        self.ws = ws
        self.n = 0
        self.eventos: list[dict] = []

    async def pedir(self, metodo: str, **params):
        self.n += 1
        await self.ws.send(json.dumps({"id": self.n, "method": metodo, "params": params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") == self.n:
                if "error" in msg:
                    raise RuntimeError(f"{metodo}: {msg['error']}")
                return msg.get("result", {})
            if "method" in msg:
                self.eventos.append(msg)

    async def drenar(self, segundos: float):
        """Deja correr la pagina y guarda los eventos que lleguen."""
        try:
            fin = asyncio.get_event_loop().time() + segundos
            while True:
                queda = fin - asyncio.get_event_loop().time()
                if queda <= 0:
                    return
                msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=queda))
                if "method" in msg:
                    self.eventos.append(msg)
        except asyncio.TimeoutError:
            return

    async def evaluar(self, expresion: str):
        r = await self.pedir("Runtime.evaluate", expression=expresion,
                             returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            texto = r["exceptionDetails"].get("exception", {}).get("description", "?")
            raise RuntimeError(texto.split("\n")[0])
        return r.get("result", {}).get("value")

    def problemas(self) -> list[str]:
        """Excepciones y avisos de consola desde la ultima llamada."""
        out = []
        for ev in self.eventos:
            m = ev["method"]
            p = ev.get("params", {})
            if m == "Runtime.exceptionThrown":
                d = p.get("exceptionDetails", {})
                desc = (d.get("exception", {}).get("description")
                        or d.get("text") or "excepcion sin descripcion")
                out.append("EXCEPCION: " + desc.split("\n")[0])
            elif m == "Runtime.consoleAPICalled" and p.get("type") in ("error", "warning"):
                partes = [str(a.get("value", a.get("description", "")))
                          for a in p.get("args", [])]
                txt = " ".join(x for x in partes if x)
                # El aviso propio de oot.js cuando un data-oot-* no resuelve: es un boton
                # mudo, que es justo lo que esta prueba busca.
                if "handler no encontrado" in txt:
                    out.append("MANEJADOR MUDO: " + txt)
                elif p.get("type") == "error":
                    out.append("CONSOLA: " + txt[:160])
        self.eventos.clear()
        return out


async def revisar(base: str, puerto: int, paginas: list[str]) -> int:
    import websockets

    chrome = navegador()
    if not chrome:
        print("  no se encontro Chrome ni Edge")
        return 2
    perfil = tempfile.mkdtemp(prefix="oot_cdp_")
    proc = subprocess.Popen(
        [chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
         f"--remote-debugging-port={puerto}", f"--user-data-dir={perfil}",
         "--no-first-run", "--window-size=1440,900", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        url_ws = None
        for _ in range(50):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{puerto}/json/list", timeout=1) as r:
                    for t in json.load(r):
                        if t.get("type") == "page":
                            url_ws = t["webSocketDebuggerUrl"]
                            break
                if url_ws:
                    break
            except (urllib.error.URLError, OSError, json.JSONDecodeError):
                pass
            await asyncio.sleep(0.2)
        if not url_ws:
            print("  el navegador no expuso ninguna pestana")
            return 2

        fallos: list[str] = []
        async with websockets.connect(url_ws, max_size=None) as ws:
            s = Sesion(ws)
            await s.pedir("Runtime.enable")
            await s.pedir("Page.enable")
            await s.pedir("Page.addScriptToEvaluateOnNewDocument", source=SIN_BARRERA)

            for pagina in paginas:
                await s.pedir("Page.navigate", url=f"{base}/{pagina}")
                await s.drenar(4.0)
                s.eventos.clear()          # ruido de carga (404 de terceros, avisos)
                try:
                    nombres = await s.evaluar(
                        "Array.from(document.querySelectorAll('[data-oot-click]'))"
                        ".map(e => e.getAttribute('data-oot-click'))")
                except RuntimeError as e:
                    fallos.append(f"{pagina}: no se pudo inspeccionar la pagina: {e}")
                    continue
                nombres = nombres or []
                unicos = sorted(set(nombres))
                pulsados, saltados = 0, 0
                for nombre in unicos:
                    if nombre in NO_PULSAR:
                        saltados += 1
                        continue
                    try:
                        await s.evaluar(
                            "(() => { const e = document.querySelector("
                            f"'[data-oot-click=\"{nombre}\"]'); if (!e) return 'sin elemento';"
                            " e.click(); return 'ok'; })()")
                    except RuntimeError as e:
                        fallos.append(f"{pagina} / {nombre}: {e}")
                    pulsados += 1
                    await s.drenar(0.35)
                    for p in s.problemas():
                        fallos.append(f"{pagina} / {nombre}: {p}")
                print(f"  {pagina:32} {len(unicos):2} controles · "
                      f"{pulsados} pulsados · {saltados} saltados a proposito")
        print()
        if fallos:
            print(f"RESULTADO: FALLO — {len(fallos)} problema(s) al pulsar:")
            for f in fallos[:25]:
                print("  - " + f)
            return 1
        print("RESULTADO: OK — ningun control lanza excepcion ni queda mudo.")
        print("NO comprueba que se vea bien: solo que nada revienta al pulsar.")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(perfil, ignore_errors=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:5500",
                    help="raiz donde se sirve el frontend")
    ap.add_argument("--puerto", type=int, default=9223, help="puerto de depuracion")
    ap.add_argument("--paginas", help="lista separada por comas; por defecto, las del nucleo")
    a = ap.parse_args()
    paginas = a.paginas.split(",") if a.paginas else PAGINAS
    try:
        urllib.request.urlopen(f"{a.base}/{paginas[0]}", timeout=5)
    except Exception as e:
        print(f"  el servidor no responde en {a.base}: {e}")
        print("  arranca `python -m http.server 5500` desde la raiz del repo")
        return 2
    print(f"Prueba de interaccion — {a.base}\n")
    return asyncio.run(revisar(a.base.rstrip("/"), a.puerto, paginas))


if __name__ == "__main__":
    sys.exit(main())
