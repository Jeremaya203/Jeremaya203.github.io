import { coloresPendientes } from "../../config.js?v=pendientes-imageserver-20260716";
import { queryGroupSum } from "../chartUtils.js";

export function pendientesPolarHandler() {
    return {
        when: (ctx) =>
            ctx.config?.id === "pendientes" &&
            ctx.config?.isPendientesPolar === true,

        run: async (ctx) => {
            try {
                if (ctx.filtroNivel !== "MUNI" || !ctx.municipioActual) {
                    ctx.setChartMessage?.(
                        "Seleccione un municipio para ver el gráfico de pendientes.",
                        "Resumen disponible solo al seleccionar un municipio."
                    );
                    return;
                }

                ctx.setChartMessage?.(
                    "Cargando información de pendientes...",
                    "Cargando información..."
                );

                const rows = await queryGroupSum({
                    url: ctx.config.url,
                    where: ctx.whereBase || "1=1",
                    groupBy: "categoria",
                    field: "porcentaje",
                    outName: "sum_pct",
                    statisticType: "sum",
                    arcRestQuery: ctx.arcRestQuery
                });

                if (!rows?.length) {
                    ctx.setChartMessage?.(
                        "Sin datos de pendientes para la consulta seleccionada.",
                        "No hay información disponible para el municipio seleccionado."
                    );
                    return;
                }

                const desiredOrder = ["2001", "2002", "2003", "2004", "2005", "2006", "2007"];
                const items = rows
                    .map(row => {
                        const code = String(row.categoria ?? "").trim();
                        const value = Number(row.sum_pct) || 0;
                        const info = coloresPendientes[code] || coloresPendientes[Number(code)];

                        return {
                            code,
                            label: info?.label || code,
                            color: info?.color || "#999",
                            value: Number(value.toFixed(2))
                        };
                    })
                    .filter(item => item.code && item.value > 0)
                    .sort((a, b) => desiredOrder.indexOf(a.code) - desiredOrder.indexOf(b.code));

                const labels = items.map(item => item.label);
                const values = items.map(item => item.value);
                const colors = items.map(item => item.color);

                ctx.setTitle("Distribución de las categorías de pendiente");
                ctx.crearGrafica(labels, values, colors, "polarArea", false);

            } catch (e) {
                console.error("PENDIENTES_POLAR error:", e);
                ctx.destroyChart();
            }
        }
    };
}
