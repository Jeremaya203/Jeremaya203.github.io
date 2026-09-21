/* Utilidades compartidas por los módulos del visor.
 *
 * Están aquí para que exista UNA sola implementación de cada una. En el
 * frontend del Observatorio llegó a haber siete copias divergentes de
 * escapeHtml y una de ellas dejaba pasar las comillas; no se repite el patrón.
 */

/** Escapa texto antes de insertarlo en el DOM. */
export function escapar(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Escribe un texto de estado con su color: neutro, "ok" o "error". */
export function mensaje(nodo, texto, clase = "") {
  nodo.className = `estado ${clase}`.trim();
  nodo.textContent = texto;
}

/** Formato de área en español de Colombia, un decimal. */
export const formatoArea = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/* La base de la API la publica config.js: en GitHub Pages el sitio es estatico
   y /api/* sale de otro origen (tunel o dominio institucional), asi que NO se
   puede usar una ruta relativa. */
const API = window.OOT_API_BASE ?? "";

/**
 * Llama a la API y convierte cualquier error en una excepción con el texto que
 * el backend haya dado, que es el que vale la pena enseñar al usuario.
 */
export async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${API}${ruta}`, opciones);
  if (!respuesta.ok) {
    let detalle = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      detalle = cuerpo.detalle ?? cuerpo.detail ?? detalle;
      if (Array.isArray(detalle)) detalle = detalle.map((d) => d.msg ?? d).join("; ");
    } catch {
      // Respuesta sin JSON (por ejemplo un 502 del proxy): se conserva el
      // código, que es la única información que llegó.
    }
    throw new Error(detalle);
  }
  return respuesta;
}

/**
 * Marca un botón como ocupado y devuelve la función que lo libera.
 *
 * Una consulta puede tardar varios segundos: sin esta señal el usuario vuelve
 * a pulsar creyendo que no pasó nada.
 */
export function ocupar(boton, icono = "progress_activity") {
  const original = boton.innerHTML;
  boton.disabled = true;
  boton.classList.add("trabajando");
  boton.innerHTML = `<span class="material-symbols-outlined">${icono}</span>Procesando…`;
  return () => {
    boton.classList.remove("trabajando");
    boton.innerHTML = original;
    boton.disabled = false;
  };
}
