/* Consulta de Uso del Suelo — flujo de la consulta.
 *
 * Orquesta los tres pasos que describe la HU: elegir municipio, localizar el
 * predio y generar el reporte. El mapa está en mapa.js; el shell institucional
 * lo inyecta OOT.loadShell() de config.js, igual que en los demás módulos.
 *
 * Los módulos ES son strict mode por defecto; no se usa var en ningún punto y
 * no hay código en línea en el HTML, que es lo que la CSP no permite.
 */

import {
  VACIO,
  bboxDeColeccion,
  dibujarCapa,
  dibujarSeleccion,
  encuadrar,
  iniciarMapa,
  volverAlInicio,
} from "./mapa.js";
import { iniciarAdmin } from "./admin.js";
import { escapar, formatoArea, mensaje, ocupar, pedir } from "./utilidades.js";

const el = (id) => document.getElementById(id);

const estado = {
  catalogo: [],
  municipio: null,
  numeroPredial: null,
  cargandoCapa: false,
  reporteGenerado: false,
};

/** Texto flotante sobre el mapa: instruccion, estado o error. */
function pista(texto, icono = "info") {
  el("pista").innerHTML =
    `<span class="material-symbols-outlined">${escapar(icono)}</span>${escapar(texto)}`;
}

/* ──────────────────────────────────────────────────────────────
   Progreso: pasos del panel izquierdo y guía del panel derecho
   ────────────────────────────────────────────────────────────── */

function marcarProgreso() {
  const hechos = {
    municipio: Boolean(estado.municipio),
    predio: Boolean(estado.numeroPredial),
    reporte: estado.reporteGenerado,
  };
  document.querySelectorAll(".paso-guia").forEach((nodo) => {
    const hecho = hechos[nodo.dataset.guia];
    nodo.classList.toggle("hecho", hecho);
    nodo.querySelector(".material-symbols-outlined").textContent = hecho
      ? "check_circle"
      : "radio_button_unchecked";
  });
  document.querySelector('[data-paso="1"]')?.classList.toggle("resuelto", hechos.municipio);
  document.querySelector('[data-paso="2"]')?.classList.toggle("resuelto", hechos.predio);
}

/* ──────────────────────────────────────────────────────────────
   Municipios
   ────────────────────────────────────────────────────────────── */

async function cargarMunicipios() {
  const selector = el("selMunicipio");
  try {
    const datos = await (await pedir("/api/uso-suelo/municipios")).json();
    estado.catalogo = datos.municipios;
    selector.replaceChildren();
    if (datos.municipios.length === 0) {
      selector.append(new Option("Sin insumos cargados", ""));
      mensaje(el("estadoMunicipio"), "No hay municipios disponibles.", "error");
      return;
    }
    selector.append(new Option("Seleccione un municipio…", ""));
    for (const municipio of datos.municipios) {
      const texto = `${municipio.nombre} — ${municipio.departamento}`;
      selector.append(
        new Option(municipio.apto ? texto : `${texto} (no apto)`, municipio.id),
      );
    }
  } catch (error) {
    selector.replaceChildren(new Option("Error al consultar", ""));
    mensaje(el("estadoMunicipio"), error.message, "error");
  }
}

el("selMunicipio").addEventListener("change", async (evento) => {
  const id = evento.target.value;
  estado.municipio = null;
  estado.numeroPredial = null;
  limpiarFicha();
  el("coincidencias").replaceChildren();
  dibujarCapa(VACIO);
  dibujarSeleccion(null);
  el("convenciones").hidden = true;
  marcarProgreso();

  if (!id) {
    mostrarHallazgos(null);
    mensaje(el("estadoMunicipio"), "");
    pista("Seleccione un municipio para ver la cartografía predial.", "arrow_upward");
    volverAlInicio();
    return;
  }

  const municipio = estado.catalogo.find((m) => m.id === id);
  mostrarHallazgos(municipio);
  if (!municipio.apto) {
    mensaje(el("estadoMunicipio"), "Los insumos de este municipio no habilitan la consulta.", "error");
    pista("Insumos no aptos: revise la validación de estructura.", "error");
    return;
  }
  estado.municipio = municipio;
  marcarProgreso();
  await cargarCapaPredial(id);
});

function mostrarHallazgos(municipio) {
  const contenedor = el("listaHallazgos");
  const contador = el("contadorHallazgos");
  contenedor.replaceChildren();
  if (!municipio) {
    contador.hidden = true;
    return;
  }
  if (municipio.hallazgos.length === 0) {
    contenedor.insertAdjacentHTML(
      "beforeend",
      '<div class="hallazgo hallazgo--ok"><span class="material-symbols-outlined">check_circle</span>' +
        "Sin observaciones: la estructura cumple el modelo LADM-COL POT.</div>",
    );
    contador.hidden = true;
    return;
  }
  const iconos = { error: "error", aviso: "warning" };
  for (const hallazgo of municipio.hallazgos) {
    contenedor.insertAdjacentHTML(
      "beforeend",
      `<div class="hallazgo hallazgo--${escapar(hallazgo.nivel)}">` +
        `<span class="material-symbols-outlined">${iconos[hallazgo.nivel] ?? "info"}</span>` +
        `${escapar(hallazgo.mensaje)}</div>`,
    );
  }
  contador.hidden = false;
  contador.textContent = String(municipio.hallazgos.length);
}

async function cargarCapaPredial(id) {
  estado.cargandoCapa = true;
  mensaje(el("estadoMunicipio"), "Cargando cartografía predial…");
  pista("Cargando cartografía predial…", "progress_activity");
  try {
    const datos = await (
      await pedir(`/api/uso-suelo/municipios/${encodeURIComponent(id)}/capa-predial`)
    ).json();
    dibujarCapa(datos);
    const caja = bboxDeColeccion(datos);
    if (caja) encuadrar(caja, 40);
    el("convenciones").hidden = false;
    mensaje(
      el("estadoMunicipio"),
      `${datos.features.length.toLocaleString("es-CO")} predios cargados.`,
      "ok",
    );
    pista("Haga clic sobre un predio o búsquelo por su número predial.", "touch_app");
  } catch (error) {
    mensaje(el("estadoMunicipio"), error.message, "error");
    pista("No se pudo cargar la cartografía predial.", "error");
  } finally {
    estado.cargandoCapa = false;
  }
}

/* ──────────────────────────────────────────────────────────────
   Localización del predio
   ────────────────────────────────────────────────────────────── */

el("btnBuscar").addEventListener("click", buscar);
el("txtPredial").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") buscar();
});

async function buscar() {
  const contenedor = el("coincidencias");
  contenedor.replaceChildren();
  if (!estado.municipio) {
    mensaje(el("estadoMunicipio"), "Seleccione primero un municipio.", "error");
    return;
  }
  const consulta = el("txtPredial").value.replace(/\D/g, "");
  if (!consulta) {
    mensaje(el("estadoMunicipio"), "Escriba al menos un dígito del número predial.", "error");
    return;
  }

  const liberar = ocupar(el("btnBuscar"));
  try {
    const ruta =
      `/api/uso-suelo/municipios/${encodeURIComponent(estado.municipio.id)}` +
      `/predios?q=${encodeURIComponent(consulta)}`;
    const datos = await (await pedir(ruta)).json();
    if (datos.total === 0) {
      mensaje(el("estadoMunicipio"), "Sin coincidencias para ese número predial.", "error");
      return;
    }
    mensaje(
      el("estadoMunicipio"),
      datos.truncado
        ? `${datos.total} coincidencias mostradas; afine la búsqueda para ver el resto.`
        : `${datos.total} ${datos.total === 1 ? "coincidencia" : "coincidencias"}.`,
      "ok",
    );
    for (const predio of datos.predios) {
      const fila = document.createElement("button");
      fila.type = "button";
      fila.className = "coincidencia";
      fila.innerHTML =
        `${escapar(predio.numero_predial)}<small>${escapar(predio.direccion)}</small>`;
      fila.addEventListener("click", () =>
        localizar({ municipio: estado.municipio.id, numero_predial: predio.numero_predial }),
      );
      contenedor.append(fila);
    }
  } catch (error) {
    mensaje(el("estadoMunicipio"), error.message, "error");
  } finally {
    liberar();
  }
}

async function localizar(cuerpo, desdeMapa = false) {
  try {
    const datos = await (
      await pedir("/api/uso-suelo/predio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      })
    ).json();
    estado.numeroPredial = datos.numero_predial;
    estado.reporteGenerado = false;
    dibujarSeleccion(datos.geometria);
    encuadrar(datos.bbox, 90);
    pintarFicha(datos);
    el("btnReporte").disabled = false;
    mensaje(el("estadoReporte"), "");
    pista(`Predio ${datos.numero_predial} listo para consultar.`, "check_circle");
    marcarProgreso();
  } catch (error) {
    if (desdeMapa) {
      pista(error.message, "error");
      clearTimeout(localizar.temporizador);
      localizar.temporizador = setTimeout(
        () => pista("Haga clic sobre un predio o búsquelo por su número predial.", "touch_app"),
        4000,
      );
      return;
    }
    mensaje(el("estadoReporte"), error.message, "error");
  }
}

function claseClasificacion(clasificacion) {
  const texto = clasificacion.toLowerCase();
  if (texto.includes("rural")) return "etiqueta-pill--rural";
  if (texto.includes("urban") || texto.includes("expansion")) return "etiqueta-pill--urbano";
  return "";
}

function pintarFicha(predio) {
  const area = predio.area_terreno_m2;
  const filas = [
    ["Dirección", escapar(predio.direccion)],
    [
      "Área de terreno",
      area == null ? "No disponible" : `${formatoArea.format(area)} m²`,
    ],
    ["Municipio", escapar(predio.municipio)],
    [
      "Clasificación del suelo",
      `<span class="etiqueta-pill ${claseClasificacion(predio.clasificacion_suelo)}">` +
        `${escapar(predio.clasificacion_suelo)}</span>`,
    ],
  ];

  el("fichaPredio").innerHTML =
    '<div class="ficha-bloque">' +
    '<div class="ficha-destacado">' +
    '<div class="ficha-destacado-etiqueta">Número predial</div>' +
    `<div class="ficha-destacado-valor">${escapar(predio.numero_predial)}</div>` +
    "</div></div>" +
    '<div class="ficha-bloque">' +
    '<div class="ficha-bloque-titulo">Identificación</div>' +
    '<dl class="ficha-dl">' +
    filas
      .map(([clave, valor]) => `<div class="ficha-fila"><dt>${clave}</dt><dd>${valor}</dd></div>`)
      .join("") +
    "</dl></div>" +
    '<p class="ayuda"><span class="material-symbols-outlined">lock</span>' +
    "La distribución de usos, las áreas y el régimen normativo no se muestran " +
    "aquí: son el contenido del reporte descargable.</p>" +
    contenidoDelReporte();

  el("fichaPredio").hidden = false;
  el("vacio").hidden = true;
}

/* La HU prohíbe presentar los resultados del análisis en la interfaz. Esto no
   los presenta: enumera las secciones que traerá el PDF, de modo que el usuario
   sepa qué va a recibir antes de esperar a que se genere. */
const SECCIONES_REPORTE = [
  ["description", "Información general del predio"],
  ["map", "Localización cartográfica"],
  ["pie_chart", "Distribución por zonificación"],
  ["gavel", "Régimen normativo de usos"],
  ["warning", "Restricciones y afectaciones"],
];

function contenidoDelReporte() {
  return (
    '<div class="ficha-bloque">' +
    '<div class="ficha-bloque-titulo">El reporte incluirá</div>' +
    '<ul class="lista-secciones">' +
    SECCIONES_REPORTE.map(
      ([icono, titulo]) =>
        `<li><span class="material-symbols-outlined">${icono}</span>${escapar(titulo)}</li>`,
    ).join("") +
    "</ul></div>"
  );
}

function limpiarFicha() {
  el("fichaPredio").hidden = true;
  el("fichaPredio").innerHTML = "";
  el("vacio").hidden = false;
  el("btnReporte").disabled = true;
}

/* ──────────────────────────────────────────────────────────────
   Reporte
   ────────────────────────────────────────────────────────────── */

el("btnReporte").addEventListener("click", async () => {
  if (!estado.numeroPredial || !estado.municipio) return;
  const boton = el("btnReporte");
  const liberar = ocupar(boton);
  mensaje(el("estadoReporte"), "Ejecutando el análisis espacial y armando el PDF…");
  try {
    const respuesta = await pedir("/api/uso-suelo/reporte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        municipio: estado.municipio.id,
        numero_predial: estado.numeroPredial,
        incluir_contexto_legal: el("chkContexto").checked,
      }),
    });
    const blob = await respuesta.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `reporte_uso_suelo_${estado.numeroPredial}.pdf`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);

    // Entre origenes el navegador solo deja leer las cabeceras que el backend
    // liste en Access-Control-Expose-Headers. Si esta no llega, el codigo sigue
    // impreso dentro del PDF: se omite la frase en vez de dejarla a medias.
    const codigo = respuesta.headers.get("X-Codigo-Verificacion");
    estado.reporteGenerado = true;
    marcarProgreso();
    mensaje(
      el("estadoReporte"),
      codigo
        ? `Reporte descargado. Código de verificación ${codigo}.`
        : "Reporte descargado. El código de verificación está en la portada del PDF.",
      "ok",
    );
    if (codigo) {
      el("fichaPredio").querySelector(".ayuda")?.insertAdjacentHTML(
        "afterend",
        `<p class="estado ok">Último reporte: ${escapar(codigo)}</p>`,
      );
    }
  } catch (error) {
    mensaje(el("estadoReporte"), error.message, "error");
  } finally {
    liberar();
  }
});

/* ──────────────────────────────────────────────────────────────
   Arranque
   ────────────────────────────────────────────────────────────── */

async function arrancar() {
  await window.OOT.loadShell();
  iniciarMapa({
    alElegirPredio: (numeroPredial) =>
      localizar({ municipio: estado.municipio.id, numero_predial: numeroPredial }),
    alElegirPunto: (lon, lat) => {
      if (!estado.municipio) return;
      localizar({ municipio: estado.municipio.id, lon, lat }, true);
    },
  });
  marcarProgreso();
  try {
    const salud = await (await pedir("/api/health")).json();
    const insignia = document.getElementById("badge-conexion");
    if (insignia) {
      insignia.textContent = `Servicio activo · v${salud.version}`;
      insignia.className = "oot-api-badge oot-api-ok";
    }
  } catch {
    const insignia = document.getElementById("badge-conexion");
    if (insignia) {
      insignia.textContent = "Servicio no disponible";
      insignia.className = "oot-api-badge oot-api-error";
    }
  }
  iniciarAdmin({ alCargar: cargarMunicipios });
  await cargarMunicipios();
}

arrancar();
