export const LAYERS_CONFIG = {
    RELIEVE: [
        {
            id: 'hipsometria',
            title: 'Hipsometría',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/6',
            outFields: ["rangoh", "porcentaje", "areat", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
            labelField: "rangoh",
            valueField: "porcentaje",
            isGeoforma: false,
            summaryField: 'hps'
        },
        {
            id: "pendientes",
            title: "Pendientes",
            url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/7",
            outFields: [
                "categoria",
                "rangop",
                "porcentaje",
                "areat",
                "mpcodigo",
                "mpnombre",
                "dpcodigo",
                "dpnombre"
            ],
            mapOutFields: ["categoria"],
            labelField: "categoria",
            valueField: "porcentaje",
            isRelieve: true,
            isPendientesPolar: true,
            summaryField: "ped"
        },
        {
            id: 'geoformas',
            title: 'Geoformas',
            outFields: ["paisaje", "trelieve", "porcentaje", "mpnombre", "dpnombre"],
            valueField: "porcentaje",
            isGeoforma: true,
            isGeoformaDualChart: true,
            hasScaleVariants: true,
            chartVariantKey: "geoformas_relieve",

            variants: [
                {
                    key: "geoformas_paisaje",
                    url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/8",
                    minScale: 22000000,
                    maxScale: 2000000
                },
                {
                    key: "geoformas_relieve",
                    url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/9",
                    minScale: 2000000,
                    maxScale: 1
                }
            ],

            geoAgg: {
                field1: "paisaje",
                field2: "trelieve",
                valueField: "porcentaje"
            },

            summaryField: 'gfr'
        },
        // {
        //     id: 'hipsometria_depto',
        //     title: 'Hipsometría (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/6',
        //     outFields: ["rangoh","areat","dpcodigo","dpnombre"],
        //     labelField: "rangoh",
        //     isDeptoAgg: true,
        //     deptoAgg: {
        //     groupField: "rangoh",
        //     numField: "areat"
        //     },
        //     summaryField: 'hps'
        // },
        // {
        //     id: 'bf3_geoformas',
        //     title: 'Geoformas (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/8',
        //     outFields: ["paisaje", "areat", "mparea", "mpnombre", "dpnombre", "dpcodigo", "mpcodigo"],
        //     labelField: "paisaje",
        //     isBF3: true,
        //     bf3: {
        //         numField: "areat",
        //         groupField: "paisaje"
        //     },
        //     summaryField: 'gfr' // si quieres mostrar algo, o déjalo como otro campo si aplica
        // },
        

    ],
    CLIMA: [
        {
            id: 'temperatura',
            title: 'Temperatura (°C)',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/12',
            outFields: ["rangot", "periodot", "porcentaje", "mpnombre", "dpnombre"],
            labelField: "rangot",
            valueField: "porcentaje",
            periodField: "periodot",
            isClima: true,
            climaType: 'temp',
            isStacked: true,
            summaryField: 'tmp'
        },
        {
            id: 'precipitacion',
            title: 'Precipitación (mm)',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/13',
            outFields: ["rangop", "periodop", "porcentaje", "mpnombre", "dpnombre"],
            labelField: "rangop",
            valueField: "porcentaje",
            periodField: "periodop",
            isClima: true,
            climaType: 'precip',
            isStacked: true,
            summaryField: 'pcp' // Cambio de prp a pcp
        },
        {
            id: 'climas',
            title: 'Climas',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/14',
            outFields: ["clima", "porcentaje", "mpnombre", "dpnombre"],
            labelField: "clima",
            valueField: "porcentaje",
            isClima: true,
            climaType: 'clima_tipo',
            summaryField: 'cli'// Cambio clm a cli
        },
        {
            id: 'cambio_temp',
            title: 'Cambio Temp. CC',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/15',
            outFields: ["rangotcc", "periodotcc", "porcentaje", "mpnombre", "dpnombre"],
            labelField: "rangotcc",
            valueField: "porcentaje",
            periodField: "periodotcc",
            isClima: true,
            climaType: 'temp_cc',
            isStacked: true,      
            summaryField: 'tcc'
        },
        {
            id: 'cambio_precip',
            title: 'Cambio Precip. CC',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/16',
            outFields: ["rangopcc", "periodopcc", "porcentaje", "mpnombre", "dpnombre"],
            labelField: "rangopcc",
            valueField: "porcentaje",
            periodField: "periodopcc",
            isClima: true,
            climaType: 'precip_cc',
            isStacked: true, 
            summaryField: 'pcc'
        },
        {
            id: 'riesgo_cc',
            title: 'Riesgo Cambio Climático',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/17',
            outFields: ["amenaza", "sensibilidad", "capadapta", "vulnerabilidad", "riesgocc", "mpcodigo", "dpcodigo", "mpnombre", "dpnombre"],
            labelField: "riesgocc",
            valueField: "riesgocc",
            isClima: true,
            climaType: 'riesgo_cc',
            summaryField: 'rcc',
            isRadar: true
        },

        // {
        //     id: 'temperatura_depto',
        //     title: 'Temperatura (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/12',
        //     outFields: ["rangot", "periodot", "porcentaje", "dpcodigo", "dpnombre"],
        //     labelField: "rangot",
        //     valueField: "porcentaje",
        //     periodField: "periodot",
        //     isClima: true,
        //     climaType: 'temp',
        //     isStacked: true,
        //     isDeptoClimaAgg: true,
        //     deptoClimaAgg: {
        //         periodField: "periodot",
        //         rangeField: "rangot",
        //         valueField: "porcentaje",
        //         statisticType: "sum" // sum(porcentaje) y luego normalizamos por mes
        //     }
        // },
        // {
        //     id: 'precipitacion_depto',
        //     title: 'Precipitación (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/13',
        //     outFields: ["rangop", "periodop", "porcentaje", "dpcodigo", "dpnombre"],
        //     labelField: "rangop",
        //     valueField: "porcentaje",
        //     periodField: "periodop",
        //     isClima: true,
        //     climaType: 'precip',
        //     isStacked: true,
        //     isDeptoClimaAgg: true,
        //     deptoClimaAgg: {
        //         periodField: "periodop",
        //         rangeField: "rangop",
        //         valueField: "porcentaje",
        //         statisticType: "sum"
        //     }
        // },
        
        // {
        //     id: 'cambio_temp',
        //     title: 'Cambio Temp. CC',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/15',
        //     outFields: ["rangotcc", "periodotcc", "porcentaje", "mpnombre", "dpnombre"],
        //     labelField: "rangotcc",
        //     valueField: "porcentaje",
        //     periodField: "periodotcc",
        //     isClima: true,
        //     climaType: 'temp_cc',
        //     isStacked: true,      
        //     summaryField: 'tcc'
        // },
        
        // {
        //     id: 'cambio_precip_depto',
        //     title: 'Cambio Precip. CC (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/16',
        //     outFields: ["rangopcc", "periodopcc", "porcentaje", "dpcodigo", "dpnombre"],
        //     labelField: "rangopcc",
        //     valueField: "porcentaje",
        //     periodField: "periodopcc",
        //     isClima: true,
        //     climaType: 'precip_cc',
        //     isStacked: true,
        //     isDeptoClimaAgg: true,
        //     deptoClimaAgg: {
        //         periodField: "periodopcc",
        //         rangeField: "rangopcc",
        //         valueField: "porcentaje",
        //         statisticType: "sum"
        //     }
        // },
        // {
        //     id: 'cambio_temp_depto',
        //     title: 'Cambio Temp. CC (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/15',
        //     outFields: ["rangotcc", "periodotcc", "porcentaje", "dpcodigo", "dpnombre"],
        //     labelField: "rangotcc",
        //     valueField: "porcentaje",
        //     periodField: "periodotcc",
        //     isClima: true,
        //     climaType: 'temp_cc',
        //     isStacked: true,
        //     isDeptoClimaAgg: true,
        //     deptoClimaAgg: {
        //         periodField: "periodotcc",
        //         rangeField: "rangotcc",
        //         valueField: "porcentaje",
        //         statisticType: "sum" 
        //     }
        // },
        
        // {
        //     id: 'riesgo_cc_depto',
        //     title: 'Riesgo CC (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/17',
        //     outFields: ["riesgocc", "mpcodigo", "dpcodigo", "dpnombre"],
        //     labelField: "riesgocc",
        //     isClima: true,
        //     climaType: 'riesgo_cc',
        //     isDeptoRiskCount: true   
        // },
        // {
        //     id: "climas_depto",
        //     title: "Climas (Departamental)",
        //     url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/14",
        //     outFields: ["clima", "areat", "dpcodigo", "dpnombre", "st_area(shape)"],
        //     labelField: "clima",
        //     isClima: true,
        //     climaType: "clima_tipo",
        //     isDeptoClimaTipoAgg: true,
        //     deptoClimaTipoAgg: {
        //         groupField: "clima",
        //         numField: "areat",
        //         denField: "st_area(shape)", // Shape_Area
        //         numAreaFactor: 1000000
        //     }
        // },
    ],
    HIDROGRAFIA: [
        {
            id: 'cuencas',
            title: 'Cuencas Hidrográficas',
            isHidro: true,
            hidroType: 'cuencas',
            outFields: ["szhid", "porcentaje", "mpnombre", "dpnombre", "areahidro", "zonahid"],
            variants: [
                { key: "cuencas_19", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/19", minScale: 0, maxScale: 4000000 },
                { key: "cuencas_20", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/20", minScale: 4000000,  maxScale: 2000000 },
                { key: "cuencas_21", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/21", minScale: 2000000,  maxScale: 1 }
            ],
            labelField: "szhid",
            valueField: "porcentaje",
            summaryField: "chg"
        },
        // {
        //     id: "cuencas_depto",
        //     title: "Cuencas Hidrográficas (Departamental)",
        //     isHidro: true,
        //     hidroType: "cuencas",

        //     variants: [
        //         { key: "cuencasD_19", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/19", minScale: 0,        maxScale: 4000000 },
        //         { key: "cuencasD_20", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/20", minScale: 4000000,  maxScale: 2000000 },
        //         { key: "cuencasD_21", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/21", minScale: 2000000,  maxScale: 1 }
        //     ],
        //     outFields: ["dpcodigo","dpnombre","areahidro","zonahid","szhid","areat","porcentaje"],
        //     isDeptoCuencasAgg: true,
        //     cuencasAgg: {
        //         groupByLayerId: {
        //         19: "areahidro",
        //         20: "zonahid",
        //         21: "szhid"
        //         },
        //         areaCandidates: ["areat", "shape_Area", "st_area(shape)", "st_area", "mparea"]
        //     }
        // },
        {
            id: 'escorrentia',
            title: 'Escorrentía',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/22',
            outFields: ["rangoesc", "porcentaje"],
            labelField: "rangoesc",
            valueField: "porcentaje",
            isHidro: true,
            hidroType: 'escorrentia',
            summaryField: 'esc'
        },
        // {
        //     id: "escorrentia_depto",
        //     title: "Escorrentía (Departamental)",
        //     url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/22",
        //     outFields: ["rangoesc", "areat", "dpcodigo", "dpnombre", "st_area(shape)"],
        //     labelField: "rangoesc",
        //     isHidro: true,
        //     hidroType: "escorrentia",

        //     isDeptoEscorrentiaAgg: true,
        //     deptoEscorrentiaAgg: {
        //         groupField: "rangoesc",
        //         numField: "areat",
        //         denField: "st_area(shape)",
        //         numAreaFactor: 1000000 // mismo caso que climas si areat viene en km²
        //     }
        // },
    ],
    ECOSISTEMAS: [
        {
            id: 'ecosistemas',
            title: 'Ecosistemas',
            isEcosistema: true,
            ecosistemaType: 'ecosistemas',
            outFields: ["condicion", "ecosgen", "porcentaje", "mpnombre", "dpnombre", "mpcodigo"],
            variants: [
            {
                key: "ecos_25",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/25",
                minScale: 22000000,  // 1:22.000.000
                maxScale: 1500000    // 1:1.500.000
            },
            {
                key: "ecos_26",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/26",
                minScale: 1500000,
                maxScale: 1
            }
            ],
            labelField: "ecosgen",
            valueField: "porcentaje",
            summaryField: 'eco'
        },
        {
            id: 'deforestacion',
            title: 'Deforestación y regeneración',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/24',
            outFields: ["cambiobosque", "periodobosque", "porcentaje"],
            labelField: "cambiobosque", // 14001, 14002
            periodField: "periodobosque",
            valueField: "porcentaje",
            isEcosistema: true,
            ecosistemaType: 'deforestacion',
            summaryField: 'dyr'
        },
        
        // {
        //     id: "ecosistemas_depto",
        //     title: "Ecosistemas (Condición - Departamental)",
        //     url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/25",
        //     outFields: ["condicion", "areat", "dpcodigo", "dpnombre"],
        //     labelField: "condicion",
        //     isEcosistema: true,
        //     ecosistemaType: "ecosistemas",
        //     isDeptoEcosCondAgg: true,
        //     ecosCondAgg: {
        //         groupField: "condicion",
        //         areaCandidates: ["areat", "shape_Area", "Shape_Area", "st_area(shape)", "st_area", "mparea"]
        //     }
        // },
        // {
        //     id: "bosque_depto",
        //     title: "Deforestación y regeneración (Departamental)",
        //     url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/24",
        //     outFields: ["cambiobosque", "periodobosque", "areat", "dpcodigo", "dpnombre", "st_area(shape)"],
        //     isEcosistema: true,
        //     ecosistemaType: "bosque",

        //     isDeptoBosqueSerieAgg: true,
        //     deptoBosqueSerieAgg: {
        //         seriesField: "cambiobosque",     // 14001 / 14002
        //         xField: "periodobosque",         // "1990-2000", ...
        //         numField: "areat",
        //         denField: "st_area(shape)",
        //         numAreaFactor: 1000000           // pon 1 si no necesitas conversión
        //     }
        // },                   

    ],
    SUELOS: [
        {
            id: "orden_suelo",
            title: "Orden del suelo",
            isSuelos: true,
            suelosType: "orden",
            summaryField: "svo",

            url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/28",

            outFields: [
                "ordsuelo",
                "fertilidad",
                "porcentaje",
                "mpnombre",
                "dpnombre"
            ],

            isBubbleOrdenSuelo: true,
            ordenAgg: {
                yField: "ordsuelo",
                xField: "fertilidad",
                valueField: "porcentaje"
            }
        },
        {
            id: 'vocacion',
            title: 'Suelo, vocación y oferta edáfica',
            isSuelos: true,
            suelosType: 'vocacion',
            summaryField: 'svo',
            variants: [
                { key: "vocacion_29", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/29", minScale: 22000000, maxScale: 2000000 },
                { key: "vocacion_30", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/30", minScale: 2000000,  maxScale: 1 }
            ],
            outFields: ["vocacion", "usopvoc", "porcentaje", "mpnombre", "dpnombre"],
            labelField: "usopvoc",
            valueField: "porcentaje",
            chartVariantKey: "vocacion_30"
        },
        // {
        //     id: "suelos_svo",
        //     title: "Suelo, vocación y oferta edáfica (Deartamental)",
        //     isSuelos: true,
        //     suelosType: "vocacion",
        //     summaryField: "svo",
        //     outFields: ["vocacion","usopvoc","porcentaje","mpnombre","dpnombre"],
        //     labelField: "usopvoc",
        //     valueField: "porcentaje",
        //     variants: [
        //         { key:"vocacion_29", url:"https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/29", minScale:22000000, maxScale:2000000 },
        //         { key:"vocacion_30", url:"https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/30", minScale:2000000,  maxScale:1 }
        //     ],
        //     chartVariantKey: "vocacion_30"   
        // },
        // {
        //     id: "vocacion_depto",
        //     title: "Vocación de uso del suelo (Departamental)",
        //     url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/29",
        //     outFields: ["vocacion", "areat", "dpcodigo", "dpnombre"],
        //     labelField: "vocacion",
        //     isSuelos: true,
        //     suelosType: "vocacion",
        //     isDeptoVocacionAgg: true,
        //     vocacionAgg: {
        //         groupField: "vocacion",
        //         areaCandidates: ["areat", "shape_Area", "st_area(shape)", "st_area", "mparea"] 
        //     }
        // },
        // {
        //     id: 'orden_suelo_depto',
        //     title: 'Orden del suelo (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/28',
        //     outFields: ["ordsuelo", "areat", "dpcodigo", "dpnombre"],
        //     labelField: "ordsuelo",
        //     isSuelos: true,
        //     suelosType: 'orden',
        //     isDeptoSoilAgg: true,
        //     soilAgg: {
        //         groupField: "ordsuelo",
        //         numField: "areat",
        //         denField: "areat" 
        //     }
        // },
        {
            id: 'conflictos',
            title: 'Conflictos de uso del suelo',
            isSuelos: true,
            suelosType: 'conflictos',
            summaryField: 'cus',
            variants: [
                { key: "conflictos_31", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/31", minScale: 22000000, maxScale: 2000000 },
                { key: "conflictos_32", url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/32", minScale: 2000000,  maxScale: 1 }
            ],
            outFields: ["tconflicto", "porcentaje", "mpnombre", "dpnombre"],
            labelField: "tconflicto",
            valueField: "porcentaje",
            chartVariantKey: "conflictos_32"
        },
        // {
        //     id: "conflictos_depto",
        //     title: "Conflictos de uso del suelo (Departamental)",
        //     url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/31",
        //     outFields: ["tconflicto", "areat", "dpcodigo", "dpnombre"],
        //     labelField: "tconflicto",
        //     isSuelos: true,
        //     suelosType: "conflictos",
        //     isDeptoConflictosAgg: true,
        //     conflictosAgg: {
        //         groupField: "tconflicto",
        //         numField: "areat"
        //     }
        // },
        
    ],
    FENOMENOS: [
        {
            id: 'inundaciones',
            title: 'Inundaciones',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/34',
            outFields: ["catsuscep", "porcentaje"],
            labelField: "catsuscep",
            valueField: "porcentaje",
            isFenomenos: true,
            fenomenosType: 'inundaciones',
            summaryField: 'inu'
        },
        // {
        //     id: 'inundaciones_depto',
        //     title: 'Inundaciones (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/34',
        //     outFields: ["catsuscep", "areat", "dpcodigo", "dpnombre"],
        //     labelField: "catsuscep",
        //     isFenomenos: true,
        //     fenomenosType: 'inundaciones',
        //     isDeptoFenAgg: true,
        //     deptoAgg: {
        //         groupField: "catsuscep",
        //         numField: "areat"
        //     },
        //     summaryField: 'inu'
        // },
        {
            id: 'remocion',
            title: 'Amenaza por remoción en masa',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/35',
            outFields: ["catame", "porcentaje"],
            labelField: "catame",
            valueField: "porcentaje",
            isFenomenos: true,
            fenomenosType: 'remocion',
            summaryField: 'rma' // cambio arm a rma
        },
        // {
        //     id: 'remocion_depto',
        //     title: 'Amenaza por remoción en masa (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/35',
        //     outFields: ["catame", "areat", "dpcodigo", "dpnombre"],
        //     labelField: "catame",
        //     isFenomenos: true,
        //     fenomenosType: 'remocion',
        //     isDeptoFenAgg: true,
        //     deptoAgg: {
        //         groupField: "catame",
        //         numField: "areat"
        //     },
        //     summaryField: 'rma'
        // },
        {
            id: 'degradacion',
            title: 'Degradación del suelo',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/36',
            outFields: ["clasedeg", "gradodeg", "porcentaje", "mpnombre", "dpnombre"],
            isFenomenos: true,
            fenomenosType: 'degradacion',
            isStackedDegradacion: true,
            degAgg: {
                classField: "clasedeg",
                gradeField: "gradodeg",
                valueField: "porcentaje"
            },
            summaryField: 'dgs'
        },
        // {
        //     id: 'degradacion_depto',
        //     title: 'Degradación del suelo (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/36',
        //     outFields: ["clasedeg", "gradodeg", "areat", "dpcodigo", "dpnombre"],
        //     isFenomenos: true,
        //     fenomenosType: 'degradacion',
        //     isDeptoDegStacked: true,
        //     degDeptoAgg: {
        //         classField: "clasedeg",
        //         gradeField: "gradodeg",
        //         areaField: "areat"
        //     },
        //     summaryField: 'dgs'
        // },
        {
            id: 'sismica',
            title: 'Intensidad sismica esperada',
            url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/37',
            outFields: ["intensidad", "porcentaje"],
            labelField: "intensidad",
            valueField: "porcentaje",
            isFenomenos: true,
            fenomenosType: 'sismica',
            summaryField: 'ise' //Cambio de sis a ise
        },
        // {
        //     id: 'sismica_depto',
        //     title: 'Intensidad sísmica esperada (Departamental)',
        //     url: 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/37',
        //     outFields: ["intensidad", "areat", "dpcodigo", "dpnombre"],
        //     labelField: "intensidad",
        //     isFenomenos: true,
        //     fenomenosType: 'sismica',
        //     isDeptoFenAgg: true,
        //     deptoAgg: {
        //         groupField: "intensidad",
        //         numField: "areat"
        //     },
        //     summaryField: 'ise'
        // }

        
    ]
};


export const DEPTO_ONLY_LAYER_IDS = new Set([
    "hipsometria_depto",
    "bf3_geoformas",
    "temperatura_depto",
    "precipitacion_depto",
    "cambio_precip_depto",
    "cambio_temp_depto",
    "riesgo_cc_depto",
    "inundaciones_depto",
    "degradacion_depto",
    "sismica_depto",
    "remocion_depto" ,
    "orden_suelo_depto",
    "conflictos_depto",
    "vocacion_depto",
    "cuencas_depto",
    "ecosistemas_depto",
    "suelos_svo",
    "climas_depto",
    "escorrentia_depto",
    "bosque_depto",
]);

export const DEPT_TO_MUNI_LAYER_ID = {
    hipsometria_depto: "hipsometria",
    bf3_geoformas: "geoformas",
    temperatura_depto: "temperatura",
    precipitacion_depto: "precipitacion",
    cambio_temp_depto: "cambio_temp",
    cambio_precip_depto: "cambio_precip",
    riesgo_cc_depto: "riesgo_cc",
    inundaciones_depto: "inundaciones",
    degradacion_depto: "degradacion",
    sismica_depto: "sismica" ,
    remocion_depto: "remocion" ,
    conflictos_depto: "conflictos",
    cuencas_depto: "cuencas",
    ecosistemas_depto: "ecosistemas",
    suelos_svo: "vocacion",
    climas_depto: "climas",
    escorrentia_depto: "escorrentia",
    bosque_depto: "bosque", 
            
};


// ===== Leyenda fija para Riesgo CC (Índice de riesgo CC) =====
export const LEYENDA_RIESGO_CC = [
    { label: "Sin Información", color: "#6b6b6b" },
    { label: "Muy bajo",        color: "#f3efe7" },
    { label: "Bajo",            color: "#f0d7c7" },
    { label: "Medio",           color: "#e6b9a0" },
    { label: "Alto",            color: "#d78e69" },
    { label: "Muy alto",        color: "#c35b3d" }
];


export const coloresCondicionEcos = {
    13001: { label: "Natural",                color: "rgba(204, 235, 197, 1)" },
    13002: { label: "Seminatural",            color: "rgba(68, 137, 112, 1)" },
    13003: { label: "Semitransformado",       color: "rgba(242, 221, 157, 1)" },
    13004: { label: "Transformado",           color: "rgba(255, 190, 190, 1)" },
    13005: { label: "Altamente transformado", color: "rgba(222, 203, 228, 1)" }
};


export const condicionLabelToCode = Object.entries(coloresCondicionEcos).reduce((acc, [code, obj]) => {
    acc[String(obj.label).trim().toLowerCase()] = String(code);
    return acc;
}, {});


export const coloresPendientes = {
    2001: { label: "Plana a ligeramente plana", color: "rgba(0, 97, 0, 1)" },
    2002: { label: "Ligeramente inclinada", color: "rgba(84, 145, 0, 1)" },
    2003: { label: "Moderadamente inclinada", color: "rgba(164, 196, 0, 1)" },
    2004: { label: "Fuertemente inclinada", color: "rgba(0, 255, 197, 1)" },
    2005: { label: "Moderadamente escarpada", color: "rgba(255, 186, 0, 1)" },
    2006: { label: "Escarpada", color: "rgba(255, 85, 0, 1)" },
    2007: { label: "Muy escarpada", color: "rgba(115, 38, 0, 1)" }
};

export const pendientesLabelToCode = Object.entries(coloresPendientes).reduce((acc, [code, obj]) => {
    acc[String(obj.label).trim().toLowerCase()] = String(code);
    return acc;
}, {});

    
