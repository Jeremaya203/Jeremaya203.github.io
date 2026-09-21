/* Módulo de administración: carga de los insumos de un municipio.
 *
 * Es el "módulo de administración desde el cual el usuario autorizado podrá
 * cargar los insumos" de la HU. Vive aparte del flujo de consulta porque es
 * otra responsabilidad y porque, el día que el backend exija autenticación,
 * esta es la pieza que hay que poner detrás de ella.
 *
 * ADVERTENCIA: hoy el backend NO exige autenticación. Lo que esta pantalla
 * ponga delante es una barrera de interfaz, no un control de acceso.
 */

import { mensaje, ocupar, pedir } from "./utilidades.js";

const el = (id) => document.getElementById(id);

/**
 * Engancha la carga de insumos.
 *
 * @param {object} opciones
 * @param {() => Promise<void>} opciones.alCargar  Se llama tras una carga
 *        correcta, para que el flujo refresque la lista de municipios.
 */
export function iniciarAdmin({ alCargar }) {
  const zona = el("zonaSoltar");
  const entradaArchivo = el("archivoInsumos");

  entradaArchivo.addEventListener("change", () => {
    const archivo = entradaArchivo.files?.[0];
    el("nombreArchivo").textContent = archivo ? archivo.name : "Seleccione un archivo";
    zona.classList.toggle("cargado", Boolean(archivo));
  });

  for (const evento of ["dragenter", "dragover"]) {
    zona.addEventListener(evento, (e) => {
      e.preventDefault();
      zona.classList.add("encima");
    });
  }
  for (const evento of ["dragleave", "drop"]) {
    zona.addEventListener(evento, (e) => {
      e.preventDefault();
      zona.classList.remove("encima");
    });
  }
  zona.addEventListener("drop", (e) => {
    const archivo = e.dataTransfer?.files?.[0];
    if (!archivo) return;
    entradaArchivo.files = e.dataTransfer.files;
    entradaArchivo.dispatchEvent(new Event("change"));
  });

  el("btnCargar").addEventListener("click", async () => {
    const archivo = entradaArchivo.files?.[0];
    if (!archivo) {
      mensaje(el("estadoCarga"), "Seleccione un archivo .zip.", "error");
      return;
    }
    const liberar = ocupar(el("btnCargar"));
    mensaje(el("estadoCarga"), "Subiendo y validando la estructura…");
    const formulario = new FormData();
    formulario.append("archivo", archivo);
    try {
      const datos = await (
        await pedir("/api/uso-suelo/admin/insumos", { method: "POST", body: formulario })
      ).json();
      mensaje(
        el("estadoCarga"),
        `${datos.archivos} archivos extraídos. Municipios detectados: ` +
          `${datos.municipios_detectados.join(", ")}.`,
        "ok",
      );
      await alCargar();
    } catch (error) {
      mensaje(el("estadoCarga"), error.message, "error");
    } finally {
      liberar();
    }
  });
}
