/**
 * ArcGISStatisticService.js — Consultas Estadísticas REST
 *
 * Realiza consultas con outStatistics a servicios ArcGIS
 * (SUM, COUNT, AVG, etc.) para gráficos y resúmenes.
 *
 * Responsabilidad:
 *   - queryStats(url, where, statisticType, field, groupBy):
 *     retorna resultados agrupados con estadísticas
 *
 * Dependencias:
 *   - Fetch API (nativo)
 */
export class ArcGISStatisticService {
    async queryStats(url, where, statisticType, onStatisticField, outFieldName, groupByFields) {
        const params = new URLSearchParams({
            where,
            outStatistics: JSON.stringify([{
                statisticType,
                onStatisticField,
                outStatisticFieldName: outFieldName
            }]),
            groupByFieldsForStatistics: groupByFields,
            f: 'json'
        });
        const res = await fetch(`${url}/query?${params.toString()}`);
        const data = await res.json();
        return data.features || [];
    }
}
