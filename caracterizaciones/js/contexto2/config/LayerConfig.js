export class LayerConfig {
    constructor() {
        this.CL_BASE = 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentecontextolegal/MapServer';
        this.DEPTO_ONLY_LAYER_IDS = new Set(['condicionantes_zomac_departamento']);
        this.DEPT_TO_MUNI_LAYER_ID = {};
        this.availableLayerIdsByMode = new Map();

        this.layers = {
            AMBIENTALES: [
                {
                    id: 'determinantes_areas_sinap',
                    mode: 'AMBIENTALES',
                    title: 'Áreas SINAP',
                    url: `${this.CL_BASE}/19`,
                    geometryType: 'polygon',
                    outFields: ['mpcodigo', 'dpcodigo', 'nomdet', 'subdet', 'tdeterm', 'confactadm', 'porcentaje', 'mpnombre', 'dpnombre', 'iddts'],
                    map: {
                        rendererType: 'unique-value',
                        field: 'subdet',
                        fieldType: 'integer',
                        labelField: 'nomdet',
                        colorDomain: 'sinap'
                    },
                    chart: {
                        type: 'bar',
                        renderer: 'HorizontalBarRenderer',
                        title: 'Áreas SINAP por subtipo de determinante',
                        titleBase: 'Áreas SINAP',
                        includeTerritoryInTitle: true,
                        showTitleOnlyWithData: true,
                        loadingMessage: 'Cargando información...',
                        noDataMessage: 'No hay información para la consulta seleccionada.',
                        categoryField: 'subdet',
                        categoryLabelField: 'nomdet',
                        valueField: 'porcentaje',
                        valueLabel: 'Porcentaje de determinante',
                        categoryLabel: 'Subtipo de determinante',
                        wrapCategoryLabels: true,
                        categoryLabelMaxLines: 2,
                        nationalMaxHeight: 620,
                        valueLabelPlacement: 'center-or-end',
                        keepVisibleWhenSelectionEmpty: true,
                        statistic: 'value'
                    },
                    legend: {
                        source: 'renderer',
                        field: 'subdet',
                        labelField: 'nomdet',
                        filterable: true
                    },
                    summary: {
                        enabled: true,
                        groupField: 'subdet',
                        groupColorDomain: 'sinap',
                        itemLabelField: 'nomdet',
                        relation: {
                            url: `${this.CL_BASE}/25`,
                            sourceKeyField: 'iddts',
                            targetKeyField: 'iddts',
                            targetKeyType: 'string',
                            outFields: ['iddts', 'tcldnorm', 'tclanalisis'],
                            batchSize: 80
                        },
                        normativeField: 'tcldnorm',
                        analysisField: 'tclanalisis',
                        title: 'Detalle por subtipo de determinante',
                        emptyNormativeText: 'No registra descripción normativa.',
                        emptyAnalysisText: 'No registra análisis temático.'
                    },
                    filter: {
                        fixedWhere: 'tdeterm = 1 AND confactadm = 1',
                        territoryField: 'mpcodigo',
                        departmentField: 'dpcodigo',
                        categoryField: 'subdet',
                        categoryFieldType: 'integer'
                    }
                },
                {
                    id: 'determinantes_areas_de_especial_importancia_ecosistemica',
                    mode: 'AMBIENTALES',
                    title: 'Áreas de Especial Importancia Ecosistémica',
                    url: `${this.CL_BASE}/19`,
                    geometryType: 'polygon',
                    outFields: ['mpcodigo', 'dpcodigo', 'nomdet', 'subdet', 'tdeterm', 'confactadm', 'porcentaje', 'mpnombre', 'dpnombre', 'iddts'],
                    map: {
                        rendererType: 'unique-value',
                        field: 'subdet',
                        fieldType: 'integer',
                        labelField: 'nomdet',
                        colorDomain: 'aeie'
                    },
                    chart: {
                        type: 'bar',
                        renderer: 'HorizontalBarRenderer',
                        title: 'Áreas de Especial Importancia Ecosistémica por subtipo de determinante',
                        titleBase: 'Áreas de Especial Importancia Ecosistémica',
                        includeTerritoryInTitle: true,
                        showTitleOnlyWithData: true,
                        loadingMessage: 'Cargando información...',
                        noDataMessage: 'No hay información para la consulta seleccionada.',
                        categoryField: 'subdet',
                        categoryLabelField: 'nomdet',
                        valueField: 'porcentaje',
                        valueLabel: 'Porcentaje de determinante',
                        categoryLabel: 'Subtipo de determinante',
                        wrapCategoryLabels: true,
                        categoryLabelMaxLines: 2,
                        nationalMaxHeight: 680,
                        valueLabelPlacement: 'center-or-end',
                        keepVisibleWhenSelectionEmpty: true,
                        statistic: 'value'
                    },
                    legend: {
                        source: 'renderer',
                        field: 'subdet',
                        labelField: 'nomdet',
                        filterable: true
                    },
                    summary: {
                        enabled: true,
                        groupField: 'subdet',
                        groupColorDomain: 'aeie',
                        itemLabelField: 'nomdet',
                        relation: {
                            url: `${this.CL_BASE}/25`,
                            sourceKeyField: 'iddts',
                            targetKeyField: 'iddts',
                            targetKeyType: 'string',
                            outFields: ['iddts', 'tcldnorm', 'tclanalisis'],
                            batchSize: 80
                        },
                        normativeField: 'tcldnorm',
                        analysisField: 'tclanalisis',
                        title: 'Detalle por subtipo de determinante',
                        emptyNormativeText: 'No registra descripción normativa.',
                        emptyAnalysisText: 'No registra análisis temático.'
                    },
                    filter: {
                        fixedWhere: 'tdeterm = 2',
                        territoryField: 'mpcodigo',
                        departmentField: 'dpcodigo',
                        categoryField: 'subdet',
                        categoryFieldType: 'integer'
                    }
                },
                this._ambientalBarConfig({
                    id: 'determinantes_estrategias_complementarias_conservacion',
                    title: 'Estrategias Complementarias de Conservación',
                    titleBase: 'Estrategias Complementarias de Conservación',
                    colorDomain: 'estrategiasComplementariasConservacion',
                    fixedWhere: 'tdeterm = 3 AND subdet IN (302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320)'
                }),
                this._ambientalBarConfig({
                    id: 'determinantes_derivadas_instrumentos_planificacion',
                    title: 'Derivadas de Instrumentos de Planificación',
                    titleBase: 'Derivadas de Instrumentos de Planificación',
                    colorDomain: 'derivadasInstrumentosPlanificacionAmbiental',
                    fixedWhere: 'tdeterm = 4'
                }),
                this._ambientalBarConfig({
                    id: 'determinantes_estructura_ecologica_principal',
                    title: 'Estructura Ecológica Principal',
                    titleBase: 'Estructura Ecológica Principal',
                    colorDomain: 'eepromEstructuraEcologicaPrincipal',
                    fixedWhere: 'tdeterm = 5'
                }),
                this._ambientalBarConfig({
                    id: 'determinantes_grs',
                    title: 'Gestión del Recurso Suelo',
                    titleBase: 'Gestión del Recurso Suelo',
                    colorDomain: 'gestionRecursoSuelo',
                    fixedWhere: 'tdeterm = 6'
                }),
                ...this._gestionRiesgoCambioClimaticoConfigs(),
                this._ambientalBarConfig({
                    id: 'determinantes_uso_biodiversidad_paisaje',
                    title: 'Uso y Biodiversidad del Paisaje',
                    titleBase: 'Uso y Biodiversidad del Paisaje',
                    colorDomain: 'usoBiodiversidadPaisaje',
                    fixedWhere: 'tdeterm = 8'
                }),
            ],

            SOBERANIA_ALIMENTARIA: [
                this._soberaniaBarConfig({
                    id: 'determinantes_derecho_a_la_alimentacion',
                    title: 'Derecho a la Alimentación',
                    titleBase: 'Derecho a la Alimentación',
                    fixedWhere: 'tdeterm = 9',
                    mapColorDomain: 'soberaniaAlimentariaSubdet',
                    mapField: 'subdet',
                    mapFieldType: 'integer',
                    chartColorDomain: 'soberaniaAlimentariaNacional',
                    chartCategoryField: 'determ',
                    chartCategoryLabelField: 'determ',
                    chartCategoryLabel: 'Tipo de determinante',
                    chartValueLabel: 'Cantidad de determinantes',
                    statistic: 'count',
                    valueFormat: 'integer',
                    summaryGroupField: 'subdet',
                    summaryColorDomain: 'soberaniaAlimentariaSubdet',
                    summaryTitle: 'Detalle por subtipo de determinante'
                }),
                this._soberaniaBarConfig({
                    id: 'determinantes_areas_proteccion_produccion_alimentos',
                    title: 'Áreas de Protección para la Producción de Alimentos',
                    titleBase: 'Áreas de Protección para la Producción de Alimentos',
                    fixedWhere: 'tdeterm = 10',
                    mapColorDomain: 'appa',
                    mapField: 'subdet',
                    mapFieldType: 'integer',
                    chartColorDomain: 'appa',
                    chartCategoryField: 'subdet',
                    chartCategoryLabelField: 'subdet',
                    chartCategoryLabel: 'Subtipo de determinante',
                    chartValueLabel: 'Cantidad de determinantes',
                    statistic: 'count',
                    valueFormat: 'integer',
                    summaryGroupField: 'subdet',
                    summaryColorDomain: 'appa',
                    summaryTitle: 'Detalle por subtipo de determinante'
                }),
                this._soberaniaBarConfig({
                    id: 'determinantes_zona_reserva_campesina',
                    title: 'Zona de Reserva Campesina',
                    titleBase: 'Zona de Reserva Campesina',
                    fixedWhere: 'tdeterm = 11',
                    mapColorDomain: 'zonasReservaCampesina',
                    mapField: 'subdet',
                    mapFieldType: 'integer',
                    chartColorDomain: 'zonasReservaCampesina',
                    chartCategoryField: 'subdet',
                    chartCategoryLabelField: 'subdet',
                    chartCategoryLabel: 'Subtipo de determinante',
                    chartValueLabel: 'Cantidad de determinantes',
                    statistic: 'count',
                    valueFormat: 'integer',
                    summaryGroupField: 'subdet',
                    summaryColorDomain: 'zonasReservaCampesina',
                    summaryTitle: 'Detalle por subtipo de determinante'
                })
            ],

            INFRAESTRUCTURA: [
                this._infraestructuraBarConfig({
                    id: 'infraestructura_reservas_red_vial_punto',
                    title: 'Reservas de la red vial nacional o regional',
                    titleBase: 'Reservas de la red vial nacional o regional',
                    groupId: 'reservas_red_vial',
                    groupTitle: 'Reservas de la red vial nacional o regional',
                    geometryLabel: 'Punto',
                    url: `${this.CL_BASE}/15`,
                    geometryType: 'point',
                    mapColorDomain: 'reservasRedVialPunto',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1301'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_reservas_red_vial_linea',
                    title: 'Reservas de la red vial nacional o regional',
                    titleBase: 'Reservas de la red vial nacional o regional',
                    groupId: 'reservas_red_vial',
                    groupTitle: 'Reservas de la red vial nacional o regional',
                    geometryLabel: 'Línea',
                    url: `${this.CL_BASE}/16`,
                    geometryType: 'polyline',
                    mapColorDomain: 'reservasRedVialLineas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1301'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_reservas_red_vial_poligono',
                    title: 'Reservas de la red vial nacional o regional',
                    titleBase: 'Reservas de la red vial nacional o regional',
                    groupId: 'reservas_red_vial',
                    groupTitle: 'Reservas de la red vial nacional o regional',
                    geometryLabel: 'Polígono',
                    url: `${this.CL_BASE}/17`,
                    geometryType: 'polygon',
                    mapColorDomain: 'reservasRedVialAreas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1301'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_puertos_aeropuertos_punto',
                    title: 'Puertos y Aeropuertos',
                    titleBase: 'Puertos y Aeropuertos',
                    groupId: 'puertos_aeropuertos',
                    groupTitle: 'Puertos y Aeropuertos',
                    geometryLabel: 'Punto',
                    url: `${this.CL_BASE}/15`,
                    geometryType: 'point',
                    mapColorDomain: 'puertosAeropuertosPunto',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1302',
                    categoryClassifier: 'puertosAeropuertos',
                    legendPreferMapItems: false,
                    selectionWhereByValue: {
                        Puertos: "nomdet NOT LIKE '%Aeropuerto%'",
                        Aeropuertos: "nomdet LIKE '%Aeropuerto%'"
                    }
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_puertos_aeropuertos_linea',
                    title: 'Puertos y Aeropuertos',
                    titleBase: 'Puertos y Aeropuertos',
                    groupId: 'puertos_aeropuertos',
                    groupTitle: 'Puertos y Aeropuertos',
                    geometryLabel: 'Línea',
                    url: `${this.CL_BASE}/16`,
                    geometryType: 'polyline',
                    mapColorDomain: 'puertosAeropuertosLineas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1302'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_puertos_aeropuertos_poligono',
                    title: 'Puertos y Aeropuertos',
                    titleBase: 'Puertos y Aeropuertos',
                    groupId: 'puertos_aeropuertos',
                    groupTitle: 'Puertos y Aeropuertos',
                    geometryLabel: 'Polígono',
                    url: `${this.CL_BASE}/17`,
                    geometryType: 'polygon',
                    mapColorDomain: 'puertosAeropuertosAreas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1302'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_red_ferrea_punto',
                    title: 'Red Férrea',
                    titleBase: 'Red Férrea',
                    groupId: 'red_ferrea',
                    groupTitle: 'Red Férrea',
                    geometryLabel: 'Punto',
                    url: `${this.CL_BASE}/15`,
                    geometryType: 'point',
                    mapColorDomain: 'redFerreaPunto',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1303'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_red_ferrea_linea',
                    title: 'Red Férrea',
                    titleBase: 'Red Férrea',
                    groupId: 'red_ferrea',
                    groupTitle: 'Red Férrea',
                    geometryLabel: 'Línea',
                    url: `${this.CL_BASE}/16`,
                    geometryType: 'polyline',
                    mapColorDomain: 'redFerreaLineas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1303'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_red_ferrea_poligono',
                    title: 'Red Férrea',
                    titleBase: 'Red Férrea',
                    groupId: 'red_ferrea',
                    groupTitle: 'Red Férrea',
                    geometryLabel: 'Polígono',
                    url: `${this.CL_BASE}/17`,
                    geometryType: 'polygon',
                    mapColorDomain: 'redFerreaAreas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1303'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_abastecimiento_saneamiento_punto',
                    title: 'Sistemas de abastecimiento y saneamiento de agua',
                    titleBase: 'Sistemas de abastecimiento y saneamiento de agua',
                    groupId: 'abastecimiento_saneamiento',
                    groupTitle: 'Sistemas de abastecimiento y saneamiento de agua',
                    geometryLabel: 'Punto',
                    url: `${this.CL_BASE}/15`,
                    geometryType: 'point',
                    mapColorDomain: 'abastecimientoSaneamientoAguaPunto',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1304'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_abastecimiento_saneamiento_linea',
                    title: 'Sistemas de abastecimiento y saneamiento de agua',
                    titleBase: 'Sistemas de abastecimiento y saneamiento de agua',
                    groupId: 'abastecimiento_saneamiento',
                    groupTitle: 'Sistemas de abastecimiento y saneamiento de agua',
                    geometryLabel: 'Línea',
                    url: `${this.CL_BASE}/16`,
                    geometryType: 'polyline',
                    mapColorDomain: 'abastecimientoSaneamientoAguaLineas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1304'
                }),
                this._infraestructuraBarConfig({
                    id: 'infraestructura_abastecimiento_saneamiento_poligono',
                    title: 'Sistemas de abastecimiento y saneamiento de agua',
                    titleBase: 'Sistemas de abastecimiento y saneamiento de agua',
                    groupId: 'abastecimiento_saneamiento',
                    groupTitle: 'Sistemas de abastecimiento y saneamiento de agua',
                    geometryLabel: 'Polígono',
                    url: `${this.CL_BASE}/17`,
                    geometryType: 'polygon',
                    mapColorDomain: 'abastecimientoSaneamientoAguaAreas',
                    fixedWhere: 'determ = 4 AND tdeterm = 13 AND subdet = 1304'
                }),
                ...this._infraestructuraAdditionalConfigs()
            ],

            AREAS_METROPOLITANAS_SUBURBANIZACION: [
                this._areasMetropolitanasBarConfig({
                    id: 'areas_metropolitanas_corredores_viales_suburbanos',
                    title: 'Corredores viales suburbanos',
                    titleBase: 'Corredores viales suburbanos',
                    groupId: 'corredores_viales_suburbanos',
                    groupTitle: 'Corredores viales suburbanos',
                    url: `${this.CL_BASE}/18`,
                    geometryType: 'polygon',
                    mapColorDomain: 'corredoresVialesSuburbanosMetropolitanos',
                    fixedWhere: 'determ = 5 AND tdeterm = 14 AND subdet = 1401'
                }),
                this._areasMetropolitanasBarConfig({
                    id: 'areas_metropolitanas_areas_suburbanas',
                    title: 'Áreas suburbanas',
                    titleBase: 'Áreas suburbanas',
                    groupId: 'areas_suburbanas',
                    groupTitle: 'Áreas suburbanas',
                    url: `${this.CL_BASE}/18`,
                    geometryType: 'polygon',
                    mapColorDomain: 'areasSuburbanasMetropolitanas',
                    fixedWhere: 'determ = 5 AND tdeterm = 14 AND subdet = 1402'
                }),
                this._areasMetropolitanasBarConfig({
                    id: 'areas_metropolitanas_disposiciones_pidm',
                    title: 'Disposiciones y directrices del PIDM',
                    titleBase: 'Disposiciones y directrices del PIDM',
                    groupId: 'disposiciones_pidm',
                    groupTitle: 'Disposiciones y directrices del PIDM',
                    url: `${this.CL_BASE}/18`,
                    geometryType: 'polygon',
                    mapColorDomain: 'disposicionesDirectricesPIDM',
                    fixedWhere: 'determ = 5 AND tdeterm = 15 AND subdet = 1501'
                })
            ],

            PROYECTOS_TURISTICOS_ESPECIALES: [
                this._proyectosTuristicosBarConfig({
                    id: 'proyectos_turisticos_red_pueblos_patrimonio',
                    title: 'Red de Pueblos Patrimonio',
                    titleBase: 'Red de Pueblos Patrimonio',
                    groupId: 'red_pueblos_patrimonio',
                    groupTitle: 'Red de Pueblos Patrimonio',
                    url: `${this.CL_BASE}/19`,
                    geometryType: 'polygon',
                    mapColorDomain: 'redPueblosPatrimonio',
                    fixedWhere: 'determ = 6 AND tdeterm = 16 AND subdet = 1603'
                }),
                this._proyectosTuristicosBarConfig({
                    id: 'proyectos_turisticos_areas_desarrollo_prioritario',
                    title: 'Áreas de Desarrollo Turístico Prioritario',
                    titleBase: 'Áreas de Desarrollo Turístico Prioritario',
                    groupId: 'areas_desarrollo_turistico_prioritario',
                    groupTitle: 'Áreas de Desarrollo Turístico Prioritario',
                    url: `${this.CL_BASE}/19`,
                    geometryType: 'polygon',
                    mapColorDomain: 'areasDesarrolloTuristicoPrioritario',
                    fixedWhere: 'determ = 6 AND tdeterm = 16 AND subdet = 1611'
                }),
                this._proyectosTuristicosBarConfig({
                    id: 'proyectos_turisticos_zonas_francas_turisticas',
                    title: 'Zonas Francas Turísticas',
                    titleBase: 'Zonas Francas Turísticas',
                    groupId: 'zonas_francas_turisticas',
                    groupTitle: 'Zonas Francas Turísticas',
                    url: `${this.CL_BASE}/19`,
                    geometryType: 'polygon',
                    mapColorDomain: 'zonasFrancasTuristicas',
                    fixedWhere: 'determ = 6 AND tdeterm = 16 AND subdet = 1612'
                })
            ],

            PATRIMONIALES: [
                this._patrimonialBarConfig({
                    id: 'patrimoniales_sitios_arqueologicos_punto',
                    title: 'Sitios arqueológicos',
                    titleBase: 'Sitios arqueológicos',
                    groupId: 'sitios_arqueologicos',
                    groupTitle: 'Sitios Arqueológicos',
                    geometryLabel: 'Punto',
                    url: `${this.CL_BASE}/12`,
                    geometryType: 'point',
                    mapColorDomain: 'sitiosArqueologicos',
                    fixedWhere: 'determ = 3 AND tdeterm = 12 AND subdet = 1201',
                    summaryDisplayMode: 'name-with-act-description',
                    summaryNormativeField: 'actadm',
                    summaryAnalysisField: 'descrip'
                }),
                this._patrimonialBarConfig({
                    id: 'patrimoniales_sitios_arqueologicos_poligono',
                    title: 'Sitios arqueológicos - Polígono',
                    titleBase: 'Sitios arqueológicos',
                    groupId: 'sitios_arqueologicos',
                    groupTitle: 'Sitios Arqueológicos',
                    geometryLabel: 'Polígono',
                    url: `${this.CL_BASE}/13`,
                    geometryType: 'polygon',
                    mapColorDomain: 'sitiosArqueologicos',
                    fixedWhere: 'determ = 3 AND tdeterm = 12 AND subdet = 1201',
                    summaryRelation: true
                }),
                this._patrimonialBarConfig({
                    id: 'patrimoniales_bienes_interes_cultural_punto',
                    title: 'Bienes de interés cultural - Punto',
                    titleBase: 'Bienes de interés cultural',
                    groupId: 'bienes_interes_cultural',
                    groupTitle: 'Bienes de Interés Cultural',
                    geometryLabel: 'Punto',
                    url: `${this.CL_BASE}/12`,
                    geometryType: 'point',
                    mapColorDomain: 'bienesInteresCultural',
                    fixedWhere: 'determ = 3 AND tdeterm = 12 AND subdet = 1202',
                    summaryDisplayMode: 'name-with-act-description',
                    summaryNormativeField: 'actadm',
                    summaryAnalysisField: 'descrip'
                }),
                this._patrimonialBarConfig({
                    id: 'patrimoniales_areas_arqueologicas_protegidas_punto',
                    title: 'Áreas Arqueológicas Protegidas',
                    titleBase: 'Áreas Arqueológicas Protegidas',
                    groupId: 'areas_arqueologicas_protegidas',
                    groupTitle: 'Áreas Arqueológicas Protegidas',
                    geometryLabel: 'Punto',
                    url: `${this.CL_BASE}/12`,
                    geometryType: 'point',
                    mapColorDomain: 'areasArqueologicasPunto',
                    fixedWhere: 'determ = 3 AND tdeterm = 12 AND subdet = 1203',
                    summaryDisplayMode: 'name-with-act-description',
                    summaryNormativeField: 'actadm',
                    summaryAnalysisField: 'descrip'
                }),
                this._patrimonialBarConfig({
                    id: 'patrimoniales_bienes_interes_cultural_poligono',
                    title: 'Bienes de interés cultural - Polígono',
                    titleBase: 'Bienes de interés cultural',
                    groupId: 'bienes_interes_cultural',
                    groupTitle: 'Bienes de Interés Cultural',
                    geometryLabel: 'Polígono',
                    url: `${this.CL_BASE}/13`,
                    geometryType: 'polygon',
                    mapColorDomain: 'areasBienesInteresCultural',
                    fixedWhere: 'determ = 3 AND tdeterm = 12 AND subdet = 1202',
                    summaryRelation: true
                }),
                this._patrimonialBarConfig({
                    id: 'patrimoniales_areas_arqueologicas_protegidas_poligono',
                    title: 'Áreas Arqueológicas Protegidas',
                    titleBase: 'Áreas Arqueológicas Protegidas',
                    groupId: 'areas_arqueologicas_protegidas',
                    groupTitle: 'Áreas Arqueológicas Protegidas',
                    geometryLabel: 'Polígono',
                    url: `${this.CL_BASE}/13`,
                    geometryType: 'polygon',
                    mapColorDomain: 'areasArqueologicas',
                    fixedWhere: 'determ = 3 AND tdeterm = 12 AND subdet = 1203',
                    summaryRelation: true
                })
            ],

            DETERMINANTES: [
                this._factoresDeterminantesConfig({
                    id: 'factores_determinantes_punto',
                    geometryLabel: 'Punto',
                    geometryType: 'point',
                    mapColorDomain: 'factoresDeterminantesPunto',
                    chartColorDomain: 'factoresDeterminantesPunto',
                    mapSources: this._factoresDeterminantesMapSources(),
                    legendGroupByGeometry: true,
                    sources: [
                        { url: `${this.CL_BASE}/12`, title: 'Factores Determinantes CL_DPP', geometryType: 'point', map: { rendererType: 'service', field: 'determ', labelField: 'nomdet' } },
                        { url: `${this.CL_BASE}/15`, title: 'Factores Determinantes CL_DPT', geometryType: 'point', map: { rendererType: 'unique-value', field: 'subdet', fieldType: 'integer', labelField: 'nomdet', colorDomain: 'infraestructuraPuntosNacional' } }
                    ]
                }),
                this._factoresDeterminantesConfig({
                    id: 'factores_determinantes_linea',
                    geometryLabel: 'Línea',
                    geometryType: 'polyline',
                    mapField: 'determ',
                    mapColorDomain: 'factoresDeterminantesLinea',
                    chartColorDomain: 'factoresDeterminantesLinea',
                    mapSources: this._factoresDeterminantesMapSources(),
                    legendGroupByGeometry: true,
                    sources: [
                        { url: `${this.CL_BASE}/16`, title: 'Factores Determinantes CL_DPL', geometryType: 'polyline' }
                    ]
                }),
                this._factoresDeterminantesConfig({
                    id: 'factores_determinantes_poligono',
                    geometryLabel: 'Polígono',
                    geometryType: 'polygon',
                    mapField: 'determ',
                    mapColorDomain: 'factoresDeterminantesPoligono',
                    chartColorDomain: 'factoresDeterminantesPoligono',
                    mapSources: this._factoresDeterminantesMapSources(),
                    legendGroupByGeometry: true,
                    sources: [
                        { url: `${this.CL_BASE}/19`, title: 'Factores Determinantes CL_DTS', geometryType: 'polygon' }
                    ]
                })
            ],


            CONDICIONANTES: [
                this._factoresCondicionantesConfig({
                    id: 'condicionantes_factores_condicionantes',
                    title: 'Factores Condicionantes',
                    condicionanteGroup: 'factores_condicionantes'
                }),
                this._territoriosColectivosConfig({
                    id: 'condicionantes_territorios_colectivos_resguardos',
                    title: 'Resguardos indígenas',
                    condicionanteGroup: 'territorios_colectivos',
                    subconValue: 101,
                    fixedWhere: 'tcondi = 1 AND subcon = 101'
                }),
                this._territoriosColectivosConfig({
                    id: 'condicionantes_territorios_colectivos_consejos',
                    title: 'Consejos comunitarios de las comunidades negras',
                    condicionanteGroup: 'territorios_colectivos',
                    subconValue: 102,
                    fixedWhere: 'tcondi = 1 AND subcon = 102'
                }),
                this._recursosNoRenovablesConfig({
                    id: 'condicionantes_recursos_no_renovables_titulos_mineros',
                    title: 'Títulos mineros activos',
                    condicionanteGroup: 'recursos_no_renovables',
                    subconValue: 201,
                    fixedWhere: 'tcondi = 2 AND subcon = 201'
                }),
                this._recursosNoRenovablesConfig({
                    id: 'condicionantes_recursos_no_renovables_bloques_petroleros',
                    title: 'Bloques de explotación y exploración petrolera',
                    condicionanteGroup: 'recursos_no_renovables',
                    subconValue: 202,
                    fixedWhere: 'tcondi = 2 AND subcon = 202'
                }),
                this._acuerdoFinalPazConfig({
                    id: 'condicionantes_acuerdo_final_paz',
                    title: 'Acuerdo Final de Paz',
                    condicionanteGroup: 'acuerdo_final_paz',
                    fixedWhere: 'tcondi = 3'
                }),
                this._zomacTerritoryConfig({
                    id: 'condicionantes_zomac_departamento',
                    title: 'Zonas más Afectadas por el Conflicto Armado',
                    condicionanteGroup: 'zomac',
                    url: `${this.CL_BASE}/1`,
                    codeField: 'dpcodigo',
                    nameField: 'dpnombre',
                    territoryField: 'dpcodigo',
                    departmentField: 'dpcodigo',
                    chartCategoryLabel: 'Departamento'
                }),
                this._zomacTerritoryConfig({
                    id: 'condicionantes_zomac_municipio',
                    title: 'Zonas más Afectadas por el Conflicto Armado',
                    condicionanteGroup: 'zomac',
                    url: `${this.CL_BASE}/2`,
                    codeField: 'mpcodigo',
                    nameField: 'mpnombre',
                    territoryField: 'mpcodigo',
                    departmentField: 'dpcodigo',
                    chartCategoryLabel: 'Municipio'
                })
            ],
        };
    }

    _gestionRiesgoCambioClimaticoConfigs() {
        const groupId = 'gestion_riesgo_cambio_climatico';
        const groupTitle = 'Gestión del Riesgo y Cambio Climático';
        const summaryConfig = this._ambientalBarConfig({
            id: 'determinantes_gestion_riesgo_cambio_climatico_resumen',
            title: groupTitle,
            titleBase: groupTitle,
            groupId,
            groupTitle,
            availability: { requiresData: true, field: 'tdeterm' },
            colorDomain: 'gestionRiesgoCambioClimatico',
            fixedWhere: 'tdeterm = 7',
            categoryField: 'subdet',
            categoryFieldType: 'integer',
            categoryLabel: 'Subtipo de determinante',
            chartCategoryOrder: [706, 705, 704, 703, 702, 701],
            summaryDisplayMode: 'names-only',
            summaryRelation: false,
            hideGeometryTab: true
        });
        const definitions = [
            {
                id: 'determinantes_gestion_riesgo_movimientos_masa',
                title: 'Movimientos en Masa',
                colorDomain: 'gestionRiesgoMovimientosMasa',
                code: 701
            },
            {
                id: 'determinantes_gestion_riesgo_inundacion',
                title: 'Inundación',
                colorDomain: 'gestionRiesgoInundacion',
                code: 702
            },
            {
                id: 'determinantes_gestion_riesgo_incendios',
                title: 'Incendios',
                colorDomain: 'gestionRiesgoIncendios',
                code: 703
            },
            {
                id: 'determinantes_gestion_riesgo_avenida_torrencial',
                title: 'Avenida Torrencial',
                colorDomain: 'gestionRiesgoAvenidaTorrencial',
                code: 704
            },
            {
                id: 'determinantes_gestion_riesgo_erosion_costera',
                title: 'Erosión Costera',
                colorDomain: 'gestionRiesgoErosionCostera',
                code: 705
            },
            {
                id: 'determinantes_gestion_riesgo_ascenso_nivel_mar',
                title: 'Ascenso Nivel del Mar',
                colorDomain: 'gestionRiesgoAscensoNivelMar',
                code: 706
            }
        ];

        return [
            summaryConfig,
            ...definitions.map(definition => this._ambientalBarConfig({
                id: definition.id,
                title: definition.title,
                titleBase: `${groupTitle} - ${definition.title}`,
                groupId,
                groupTitle,
                geometryLabel: definition.title,
                availability: { requiresData: true, field: 'subdet' },
                colorDomain: definition.colorDomain,
                fixedWhere: `tdeterm = 7 AND subdet = ${definition.code}`,
                categoryField: 'descrip',
                categoryFieldType: 'string',
                categoryLabel: 'Descripción'
            }))
        ];
    }

    _ambientalBarConfig(options) {
        const categoryField = options.categoryField || 'subdet';
        const categoryFieldType = options.categoryFieldType || 'integer';
        const categoryLabel = options.categoryLabel || 'Subtipo de determinante';

        return {
            id: options.id,
            mode: 'AMBIENTALES',
            title: options.title,
            groupId: options.groupId,
            groupTitle: options.groupTitle,
            geometryLabel: options.geometryLabel,
            hideGeometryTab: !!options.hideGeometryTab,
            url: `${this.CL_BASE}/19`,
            geometryType: 'polygon',
            outFields: ['mpcodigo', 'dpcodigo', 'nomdet', 'subdet', 'tdeterm', 'confactadm', 'porcentaje', 'mpnombre', 'dpnombre', 'iddts', 'descrip'],
            availability: options.availability,
            map: {
                rendererType: 'unique-value',
                field: categoryField,
                fieldType: categoryFieldType,
                labelField: 'nomdet',
                colorDomain: options.colorDomain
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: `${options.title} por ${categoryLabel.toLowerCase()}`,
                titleBase: options.titleBase || options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField,
                categoryLabelField: categoryField,
                categoryOrder: options.chartCategoryOrder,
                valueField: 'porcentaje',
                valueLabel: 'Porcentaje de determinante',
                categoryLabel,
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 2,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'value'
            },
            legend: {
                source: 'renderer',
                field: categoryField,
                labelField: categoryField,
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: categoryField,
                groupColorDomain: options.colorDomain,
                itemLabelField: 'nomdet',
                displayMode: options.summaryDisplayMode,
                ...(options.summaryRelation === false ? {} : {
                    relation: {
                        url: `${this.CL_BASE}/25`,
                        sourceKeyField: 'iddts',
                        targetKeyField: 'iddts',
                        targetKeyType: 'string',
                        outFields: ['iddts', 'tcldnorm', 'tclanalisis'],
                        batchSize: 80
                    }
                }),
                ...(options.summaryRelation === false ? {} : {
                    normativeField: 'tcldnorm',
                    analysisField: 'tclanalisis'
                }),
                title: `Detalle por ${categoryLabel.toLowerCase()}`,
                emptyNormativeText: 'No registra descripción normativa.',
                emptyAnalysisText: 'No registra análisis temático.'
            },
            filter: {
                fixedWhere: options.fixedWhere,
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField,
                categoryFieldType
            }
        };
    }

    _factoresDeterminantesConfig(options) {
        const sources = options.sources || [];
        return {
            id: options.id,
            mode: 'DETERMINANTES',
            title: 'Factores Determinantes',
            titleBase: 'Factores Determinantes',
            groupId: 'factores_determinantes',
            groupTitle: 'Factores Determinantes',
            geometryLabel: options.geometryLabel,
            url: sources[0]?.url || `${this.CL_BASE}/19`,
            sources,
            mapSources: options.mapSources || null,
            geometryType: options.geometryType,
            outFields: ['mpcodigo', 'dpcodigo', 'mpnombre', 'dpnombre', 'determ', 'nomdet'],
            map: {
                rendererType: 'unique-value',
                field: options.mapField || 'determ',
                fieldType: 'integer',
                labelField: 'nomdet',
                colorDomain: options.mapColorDomain || 'factoresDeterminantes'
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                dataStrategy: 'grouped-counts',
                title: `Factores Determinantes}`,
                titleBase: `Factores Determinantes `,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField: 'determ',
                categoryLabelField: 'determ',
                colorDomain: options.chartColorDomain || options.mapColorDomain || 'factoresDeterminantes',
                selectionField: 'determ',
                valueLabel: 'Cantidad de determinantes',
                valueFormat: 'integer',
                categoryLabel: 'Tipo de determinante',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 2,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'count'
            },
            legend: {
                source: 'renderer',
                field: 'determ',
                labelField: 'determ',
                groupByGeometry: !!options.legendGroupByGeometry,
                preferMapItems: !!options.legendGroupByGeometry,
                filterByAvailableValues: !!options.legendGroupByGeometry,
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: 'determ',
                groupColorDomain: options.chartColorDomain || options.mapColorDomain || 'factoresDeterminantes',
                itemLabelField: 'nomdet',
                distinct: true,
                displayMode: 'names-only',
                title: 'Detalle por tipo de determinante'
            },
            filter: {
                fixedWhere: 'determ IN (1,2,3,4,5,6)',
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField: 'determ',
                categoryFieldType: 'integer'
            }
        };
    }

    _factoresDeterminantesMapSources() {
        return [
            {
                url: `${this.CL_BASE}/19`,
                title: 'Factores Determinantes - Polígono',
                geometryType: 'polygon',
                geometryLabel: 'Polígono',
                map: {
                    rendererType: 'unique-value',
                    field: 'determ',
                    fieldType: 'integer',
                    labelField: 'nomdet',
                    colorDomain: 'factoresDeterminantesPoligono'
                }
            },
            {
                url: `${this.CL_BASE}/16`,
                title: 'Factores Determinantes - Línea',
                geometryType: 'polyline',
                geometryLabel: 'Línea',
                map: {
                    rendererType: 'unique-value',
                    field: 'determ',
                    fieldType: 'integer',
                    labelField: 'nomdet',
                    colorDomain: 'factoresDeterminantesLinea'
                }
            },
            {
                url: `${this.CL_BASE}/12`,
                title: 'Factores Determinantes - Punto',
                geometryType: 'point',
                geometryLabel: 'Punto',
                map: {
                    rendererType: 'unique-value',
                    field: 'determ',
                    fieldType: 'integer',
                    labelField: 'nomdet',
                    colorDomain: 'factoresDeterminantesPunto'
                }
            },
            {
                url: `${this.CL_BASE}/15`,
                title: 'Factores Determinantes - Punto infraestructura',
                geometryType: 'point',
                geometryLabel: 'Punto',
                map: {
                    rendererType: 'unique-value',
                    field: 'determ',
                    fieldType: 'integer',
                    labelField: 'nomdet',
                    colorDomain: 'factoresDeterminantesPunto'
                }
            }
        ];
    }

    _factoresCondicionantesConfig(options) {
        return {
            id: options.id,
            mode: 'CONDICIONANTES',
            condicionanteGroup: options.condicionanteGroup,
            title: options.title,
            titleBase: options.title,
            hideSubtabs: false,
            url: `${this.CL_BASE}/24`,
            geometryType: 'polygon',
            outFields: ['mpcodigo', 'dpcodigo', 'mpnombre', 'dpnombre', 'tcondi', 'subcon', 'nomcon'],
            map: {
                rendererType: 'unique-value',
                field: 'tcondi',
                fieldType: 'integer',
                labelField: 'nomcon',
                colorDomain: 'factoresCondicionantesMunicipal'
            },
            popup: {
                titleField: 'nomcon',
                fields: [
                    { field: 'nomcon', label: 'Nombre del condicionante' },
                    { field: 'tcondi', label: 'Tipo de condicionante' }
                ]
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: 'Factores Condicionantes por tipo de condicionante',
                titleBase: options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField: 'tcondi',
                categoryLabelField: 'tcondi',
                colorDomain: 'factoresCondicionantesMunicipal',
                selectionField: 'tcondi',
                valueLabel: 'Cantidad de condicionantes',
                valueFormat: 'integer',
                categoryLabel: 'Tipo de condicionante',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 2,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'count'
            },
            legend: {
                source: 'renderer',
                field: 'tcondi',
                labelField: 'tcondi',
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: 'tcondi',
                groupColorDomain: 'factoresCondicionantesMunicipal',
                itemLabelField: 'nomcon',
                displayMode: 'names-only',
                title: 'Detalle por tipo de condicionante'
            },
            filter: {
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField: 'tcondi',
                categoryFieldType: 'integer'
            }
        };
    }

    _territoriosColectivosConfig(options) {
        return {
            id: options.id,
            mode: 'CONDICIONANTES',
            condicionanteGroup: options.condicionanteGroup,
            title: options.title,
            titleBase: options.title,
            url: `${this.CL_BASE}/24`,
            geometryType: 'polygon',
            outFields: ['mpcodigo', 'dpcodigo', 'mpnombre', 'dpnombre', 'tcondi', 'subcon', 'nomcon', 'actadm', 'porcentaje'],
            map: {
                rendererType: 'unique-value',
                field: 'subcon',
                fieldType: 'integer',
                labelField: 'nomcon',
                colorDomain: 'territoriosColectivosMunicipal'
            },
            popup: {
                titleField: 'nomcon',
                fields: [
                    { field: 'nomcon', label: 'Nombre del condicionante' },
                    { field: 'actadm', label: 'Acto administrativo' },
                    { field: 'porcentaje', label: 'Porcentaje' }
                ]
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: `${options.title} por porcentaje`,
                titleBase: options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField: 'nomcon',
                categoryLabelField: 'nomcon',
                colorValueField: 'subcon',
                colorDomain: 'territoriosColectivosMunicipal',
                selectionField: 'nomcon',
                selectionFieldType: 'string',
                valueField: 'porcentaje',
                valueLabel: 'Porcentaje',
                categoryLabel: 'Nombre del condicionante',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 0,
                categoryLabelMaxLength: 24,
                useHtmlDenseLabels: true,
                thinBars: true,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'sum'
            },
            legend: {
                source: 'chart',
                field: 'nomcon',
                labelField: 'nomcon',
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: 'nomcon',
                groupLabelField: 'nomcon',
                groupColorDomain: 'territoriosColectivosMunicipal',
                itemLabelField: 'nomcon',
                normativeField: 'actadm',
                displayMode: 'name-with-act',
                hideItemName: true,
                emptyNormativeText: 'No registra acto administrativo.',
                title: 'Detalle de condicionantes'
            },
            filter: {
                fixedWhere: options.fixedWhere,
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField: 'nomcon',
                categoryFieldType: 'string'
            }
        };
    }

    _recursosNoRenovablesConfig(options) {
        return {
            id: options.id,
            mode: 'CONDICIONANTES',
            condicionanteGroup: options.condicionanteGroup,
            title: options.title,
            titleBase: options.title,
            url: `${this.CL_BASE}/24`,
            geometryType: 'polygon',
            outFields: ['mpcodigo', 'dpcodigo', 'mpnombre', 'dpnombre', 'tcondi', 'subcon', 'nomcon', 'descrip', 'porcentaje'],
            map: {
                rendererType: 'unique-value',
                field: 'subcon',
                fieldType: 'integer',
                labelField: 'nomcon',
                colorDomain: 'explotacionRecursosNoRenovablesMunicipal'
            },
            popup: {
                titleField: 'nomcon',
                fields: [
                    { field: 'nomcon', label: 'Nombre del condicionante' },
                    { field: 'descrip', label: 'Descripción' },
                    { field: 'porcentaje', label: 'Porcentaje' }
                ]
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: `${options.title} por porcentaje`,
                titleBase: options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField: 'nomcon',
                categoryLabelField: 'nomcon',
                colorValueField: 'subcon',
                colorDomain: 'explotacionRecursosNoRenovablesMunicipal',
                selectionField: 'nomcon',
                selectionFieldType: 'string',
                valueField: 'porcentaje',
                valueLabel: 'Porcentaje',
                categoryLabel: 'Nombre del condicionante',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 0,
                categoryLabelMaxLength: 24,
                useHtmlDenseLabels: true,
                thinBars: true,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'sum'
            },
            legend: {
                source: 'chart',
                field: 'nomcon',
                labelField: 'nomcon',
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: 'nomcon',
                groupLabelField: 'nomcon',
                groupColorDomain: 'explotacionRecursosNoRenovablesMunicipal',
                itemLabelField: 'nomcon',
                normativeField: 'descrip',
                displayMode: 'name-with-description',
                hideItemName: true,
                emptyNormativeText: 'No registra descripción.',
                title: 'Detalle de condicionantes'
            },
            filter: {
                fixedWhere: options.fixedWhere,
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField: 'nomcon',
                categoryFieldType: 'string'
            }
        };
    }

    _acuerdoFinalPazConfig(options) {
        return {
            id: options.id,
            mode: 'CONDICIONANTES',
            condicionanteGroup: options.condicionanteGroup,
            title: options.title,
            titleBase: options.title,
            hideSubtabs: true,
            url: `${this.CL_BASE}/24`,
            geometryType: 'polygon',
            outFields: ['mpcodigo', 'dpcodigo', 'mpnombre', 'dpnombre', 'tcondi', 'subcon', 'nomcon', 'actadm', 'idcts', 'porcentaje'],
            map: {
                rendererType: 'unique-value',
                field: 'subcon',
                fieldType: 'integer',
                labelField: 'nomcon',
                colorDomain: 'acuerdoFinalPazMunicipal'
            },
            popup: {
                titleField: 'nomcon',
                fields: [
                    { field: 'nomcon', label: 'Nombre del condicionante' },
                    { field: 'actadm', label: 'Acto administrativo' },
                    { field: 'subcon', label: 'Subtipo de condicionante' },
                    { field: 'porcentaje', label: 'Porcentaje' }
                ]
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: `${options.title} por subtipo de condicionante`,
                titleBase: options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField: 'subcon',
                categoryLabelField: 'subcon',
                colorDomain: 'acuerdoFinalPazMunicipal',
                selectionField: 'subcon',
                selectionFieldType: 'integer',
                valueField: 'porcentaje',
                valueLabel: 'Porcentaje',
                categoryLabel: 'Subtipo de condicionante',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 2,
                categoryLabelMaxLength: 36,
                thinBars: true,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'sum'
            },
            legend: {
                source: 'chart',
                field: 'subcon',
                labelField: 'subcon',
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: 'subcon',
                groupLabelField: 'subcon',
                groupColorDomain: 'acuerdoFinalPazMunicipal',
                itemLabelField: 'nomcon',
                relation: {
                    url: `${this.CL_BASE}/26`,
                    sourceKeyField: 'idcts',
                    targetKeyField: 'idcts',
                    targetKeyType: 'string',
                    outFields: ['idcts', 'tclanalisis'],
                    batchSize: 80
                },
                normativeField: 'actadm',
                analysisField: 'tclanalisis',
                displayMode: 'name-with-act-analysis',
                emptyNormativeText: 'No registra acto administrativo.',
                emptyAnalysisText: 'No registra análisis temático.',
                title: 'Detalle de condicionantes'
            },
            filter: {
                fixedWhere: options.fixedWhere,
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField: 'subcon',
                categoryFieldType: 'integer'
            }
        };
    }

    _zomacTerritoryConfig(options) {
        return {
            id: options.id,
            mode: 'CONDICIONANTES',
            condicionanteGroup: options.condicionanteGroup,
            title: options.title,
            titleBase: options.title,
            hideSubtabs: true,
            summaryOnly: true,
            url: options.url,
            geometryType: 'polygon',
            outFields: ['dpcodigo', 'dpnombre', 'mpcodigo', 'mpnombre'],
            map: {
                rendererType: 'simple',
                field: options.codeField,
                fieldType: 'string',
                labelField: options.nameField,
                fillColor: 'rgba(197, 90, 17, 0)',
                outlineColor: '#7f3a0b',
                outlineWidth: 1
            },
            popup: {
                titleField: options.nameField,
                fields: [
                    { field: options.nameField, label: options.chartCategoryLabel },
                    { field: options.codeField, label: 'Código' }
                ]
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: `${options.title} por porcentaje`,
                titleBase: options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField: 'nomcon',
                categoryLabelField: 'nomcon',
                fixedColor: '#92D050',
                selectionField: 'nomcon',
                selectionFieldType: 'string',
                valueField: 'porcentaje',
                valueLabel: 'Porcentaje',
                categoryLabel: 'Nombre del condicionante',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 0,
                categoryLabelMaxLength: 24,
                useHtmlDenseLabels: true,
                thinBars: true,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'sum'
            },
            legend: {
                source: 'chart',
                field: 'nomcon',
                labelField: 'nomcon',
                filterable: true
            },
            summary: {
                enabled: true,
                dataUrl: `${this.CL_BASE}/24`,
                fixedWhere: 'tcondi = 3',
                groupField: 'nomcon',
                groupLabelField: 'nomcon',
                itemLabelField: 'nomcon',
                relation: {
                    url: `${this.CL_BASE}/26`,
                    sourceKeyField: 'idcts',
                    targetKeyField: 'idcts',
                    targetKeyType: 'string',
                    outFields: ['idcts', 'tclanalisis'],
                    batchSize: 80
                },
                analysisField: 'tclanalisis',
                displayMode: 'name-with-analysis',
                hideItemName: true,
                emptyAnalysisText: 'No registra análisis temático.',
                title: 'Detalle de condicionantes'
            },
            filter: {
                fixedWhere: options.fixedWhere,
                territoryField: options.territoryField,
                departmentField: options.departmentField,
                categoryField: options.codeField,
                categoryFieldType: 'string'
            }
        };
    }

    _soberaniaBarConfig(options) {
        const mapField = options.mapField || 'subdet';
        const mapFieldType = options.mapFieldType || 'integer';
        const chartCategoryField = options.chartCategoryField || mapField;
        const chartCategoryLabelField = options.chartCategoryLabelField || chartCategoryField;
        const summaryGroupField = options.summaryGroupField || mapField;

        return {
            id: options.id,
            mode: 'SOBERANIA_ALIMENTARIA',
            title: options.title,
            url: `${this.CL_BASE}/10`,
            geometryType: 'polygon',
            outFields: ['mpcodigo', 'dpcodigo', 'mpnombre', 'dpnombre', 'determ', 'tdeterm', 'subdet', 'nomdet', 'porcentaje', 'iddts'],
            map: {
                rendererType: 'unique-value',
                field: mapField,
                fieldType: mapFieldType,
                labelField: 'nomdet',
                colorDomain: options.mapColorDomain
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: options.title,
                titleBase: options.titleBase || options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No hay información para la consulta seleccionada.',
                categoryField: chartCategoryField,
                categoryLabelField: chartCategoryLabelField,
                colorDomain: options.chartColorDomain || options.mapColorDomain,
                selectionField: chartCategoryField,
                valueField: 'porcentaje',
                valueLabel: options.chartValueLabel || 'Cantidad',
                valueFormat: options.valueFormat || 'integer',
                categoryLabel: options.chartCategoryLabel || 'Categoría',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 2,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: options.statistic || 'count'
            },
            legend: {
                source: 'renderer',
                field: mapField,
                labelField: mapField,
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: summaryGroupField,
                groupColorDomain: options.summaryColorDomain || options.mapColorDomain,
                itemLabelField: 'nomdet',
                displayMode: options.summaryDisplayMode,
                relation: {
                    url: `${this.CL_BASE}/25`,
                    sourceKeyField: 'iddts',
                    targetKeyField: 'iddts',
                    targetKeyType: 'string',
                    outFields: ['iddts', 'tcldnorm', 'tclanalisis'],
                    batchSize: 80
                },
                normativeField: 'tcldnorm',
                analysisField: 'tclanalisis',
                title: options.summaryTitle || 'Detalle por subtipo de determinante',
                emptyNormativeText: 'No registra descripción normativa.',
                emptyAnalysisText: 'No registra análisis temático.'
            },
            filter: {
                fixedWhere: options.fixedWhere,
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField: chartCategoryField,
                categoryFieldType: chartCategoryField === mapField ? mapFieldType : 'integer'
            }
        };
    }

    _proyectosTuristicosBarConfig(options) {
        return this._groupedBarConfig({ ...options, mode: 'PROYECTOS_TURISTICOS_ESPECIALES' });
    }

    _areasMetropolitanasBarConfig(options) {
        return this._groupedBarConfig({ ...options, mode: 'AREAS_METROPOLITANAS_SUBURBANIZACION' });
    }

    _infraestructuraBarConfig(options) {
        return this._groupedBarConfig({ ...options, mode: 'INFRAESTRUCTURA' });
    }

    _infraestructuraAdditionalConfigs() {
        const pointUrl = `${this.CL_BASE}/15`;
        const lineUrl = `${this.CL_BASE}/16`;
        const polygonUrl = `${this.CL_BASE}/17`;
        const definitions = [
            {
                code: 1305,
                id: 'suministro_energia',
                title: 'Suministro de energía',
                pointDomain: 'suministroEnergiaPunto',
                lineDomain: 'suministroEnergiaLineas',
                polygonDomain: 'suministroEnergiaAreas'
            },
            {
                code: 1306,
                id: 'disposicion_residuos_solidos',
                title: 'Disposición de residuos sólidos',
                pointDomain: 'disposicionResiduosSolidosPunto',
                lineDomain: 'disposicionResiduosSolidosLineas',
                polygonDomain: 'disposicionResiduosSolidos'
            },
            {
                code: 1307,
                id: 'equipamientos_alto_impacto_ambiental',
                title: 'Equipamientos Colectivos de Alto Impacto Ambiental',
                pointDomain: 'equipamientosAltoImpactoAmbientalPunto',
                lineDomain: 'equipamientosAltoImpactoAmbientalLineas',
                polygonDomain: 'equipamientosAltoImpactoAmbiental'
            },
            {
                code: 1308,
                id: 'gasoducto',
                title: 'Gasoducto',
                pointDomain: 'gasoductoPunto',
                lineDomain: 'gasoductoLineas',
                polygonDomain: 'gasoductoAreas'
            },
            {
                code: 1309,
                id: 'poliducto',
                title: 'Poliducto',
                pointDomain: 'poliductoPunto',
                lineDomain: 'poliductoLineas',
                polygonDomain: 'poliductoAreas'
            },
            {
                code: 1310,
                id: 'transporte_hidrocarburos',
                title: 'Transporte de Hidrocarburos',
                pointDomain: 'transporteHidrocarburosPunto',
                lineDomain: 'transporteHidrocarburosLineas',
                polygonDomain: 'transporteHidrocarburosAreas'
            },
            {
                code: 1311,
                id: 'telecomunicaciones',
                title: 'Telecomunicaciones',
                pointDomain: 'telecomunicacionesPunto',
                lineDomain: 'telecomunicacionesLineas',
                polygonDomain: 'telecomunicacionesAreas'
            }
        ];

        return definitions.flatMap(definition => ([
            definition.pointDomain ? this._infraestructuraBarConfig({
                id: `infraestructura_${definition.id}_punto`,
                title: definition.title,
                titleBase: definition.title,
                groupId: definition.id,
                groupTitle: definition.title,
                geometryLabel: 'Punto',
                url: pointUrl,
                geometryType: 'point',
                mapColorDomain: definition.pointDomain,
                fixedWhere: `determ = 4 AND tdeterm = 13 AND subdet = ${definition.code}`,
                summaryDisplayMode: 'name-with-act-description',
                summaryNormativeField: 'actadm',
                summaryAnalysisField: 'descrip'
            }) : null,
            definition.lineDomain ? this._infraestructuraBarConfig({
                id: `infraestructura_${definition.id}_linea`,
                title: definition.title,
                titleBase: definition.title,
                groupId: definition.id,
                groupTitle: definition.title,
                geometryLabel: 'Línea',
                url: lineUrl,
                geometryType: 'polyline',
                mapColorDomain: definition.lineDomain,
                fixedWhere: `determ = 4 AND tdeterm = 13 AND subdet = ${definition.code}`
            }) : null,
            definition.polygonDomain ? this._infraestructuraBarConfig({
                id: `infraestructura_${definition.id}_poligono`,
                title: definition.title,
                titleBase: definition.title,
                groupId: definition.id,
                groupTitle: definition.title,
                geometryLabel: 'Polígono',
                url: polygonUrl,
                geometryType: 'polygon',
                mapColorDomain: definition.polygonDomain,
                fixedWhere: `determ = 4 AND tdeterm = 13 AND subdet = ${definition.code}`,
                summaryRelation: true
            }) : null
        ].filter(Boolean)));
    }

    _patrimonialBarConfig(options) {
        return this._groupedBarConfig({ ...options, mode: 'PATRIMONIALES' });
    }

    _groupedBarConfig(options) {
        const mapField = options.mapField || 'subdet';
        const mapFieldType = options.mapFieldType || 'integer';
        const mapColorDomain = options.mapColorDomain || options.colorDomain;
        const chartColorDomain = options.chartColorDomain || mapColorDomain;
        const summaryRelationSourceField = options.summaryRelationSourceField || 'iddts';
        const summaryNormativeField = options.summaryNormativeField || (options.summaryRelation ? 'tcldnorm' : null);
        const summaryAnalysisField = options.summaryAnalysisField || (options.summaryRelation ? 'tclanalisis' : null);

        return {
            id: options.id,
            mode: options.mode || 'PATRIMONIALES',
            title: options.title,
            groupId: options.groupId,
            groupTitle: options.groupTitle,
            geometryLabel: options.geometryLabel,
            url: options.url,
            geometryType: options.geometryType,
            outFields: ['mpcodigo', 'dpcodigo', 'mpnombre', 'dpnombre', 'determ', 'tdeterm', 'subdet', 'nomdet'],
            availability: {
                requiresData: true
            },
            map: {
                rendererType: 'unique-value',
                field: mapField,
                fieldType: mapFieldType,
                labelField: 'nomdet',
                colorDomain: mapColorDomain
            },
            chart: {
                type: 'bar',
                renderer: 'HorizontalBarRenderer',
                title: options.title,
                titleBase: options.titleBase || options.title,
                includeTerritoryInTitle: true,
                showTitleOnlyWithData: true,
                loadingMessage: 'Cargando información...',
                noDataMessage: 'No se encuentran determinantes correspondientes al municipio consultado.',
                categoryField: mapField,
                categoryLabelField: mapField,
                categoryClassifier: options.categoryClassifier,
                colorDomain: chartColorDomain,
                selectionField: mapField,
                valueLabel: 'Cantidad de determinantes',
                valueFormat: 'integer',
                categoryLabel: 'Tipo de determinante',
                wrapCategoryLabels: true,
                categoryLabelMaxLines: 2,
                valueLabelPlacement: 'center-or-end',
                keepVisibleWhenSelectionEmpty: true,
                statistic: 'count'
            },
            legend: {
                source: 'renderer',
                field: mapField,
                labelField: mapField,
                preferMapItems: options.legendPreferMapItems ?? true,
                filterable: true
            },
            summary: {
                enabled: true,
                groupField: mapField,
                groupLabelField: mapField,
                groupClassifier: options.categoryClassifier,
                groupColorDomain: mapColorDomain,
                itemLabelField: 'nomdet',
                displayMode: options.summaryDisplayMode ?? (options.summaryRelation ? undefined : 'names-only'),
                ...(options.summaryRelation ? {
                    relation: {
                        url: `${this.CL_BASE}/25`,
                        sourceKeyField: summaryRelationSourceField,
                        targetKeyField: 'iddts',
                        targetKeyType: 'string',
                        outFields: ['iddts', 'tcldnorm', 'tclanalisis'],
                        batchSize: 80
                    },
                    normativeField: summaryNormativeField,
                    analysisField: summaryAnalysisField,
                    emptyNormativeText: 'No registra descripción normativa.',
                    emptyAnalysisText: 'No registra análisis temático.'
                } : {}),
                ...(!options.summaryRelation && (summaryNormativeField || summaryAnalysisField) ? {
                    normativeField: summaryNormativeField,
                    analysisField: summaryAnalysisField,
                    emptyNormativeText: 'No registra acto administrativo.',
                    emptyAnalysisText: 'No registra descripción.'
                } : {}),
                title: 'Detalle por tipo de determinante'
            },
            filter: {
                fixedWhere: options.fixedWhere,
                territoryField: 'mpcodigo',
                departmentField: 'dpcodigo',
                categoryField: mapField,
                categoryFieldType: mapFieldType,
                categoryClassifier: options.categoryClassifier,
                selectionWhereByValue: options.selectionWhereByValue
            }
        };
    }

    getLayerUrl() {
        return `${this.CL_BASE}/19`;
    }

    getList(mode, filtroNivel, condicionantesGroup = null) {
        let list = this.layers[mode] || [];
        if (mode === 'CONDICIONANTES') {
            list = condicionantesGroup
                ? list.filter(layer => layer.condicionanteGroup === condicionantesGroup)
                : [];
            if (condicionantesGroup === 'zomac' && !filtroNivel) return [];
        }
        const availableIds = this.availableLayerIdsByMode.get(mode);
        if (availableIds) {
            list = list.filter(layer => availableIds.has(layer.id));
        }
        if (filtroNivel === 'DEPTO') {
            const deptoOnly = list.filter(l => this.DEPTO_ONLY_LAYER_IDS.has(l.id));
            return deptoOnly.length ? deptoOnly : list.filter(l => !this.DEPTO_ONLY_LAYER_IDS.has(l.id));
        }
        if (filtroNivel === 'MUNI') {
            return list.filter(l => !this.DEPTO_ONLY_LAYER_IDS.has(l.id));
        }
        return list.filter(l => !this.DEPTO_ONLY_LAYER_IDS.has(l.id));
    }

    getRawList(mode) {
        return this.layers[mode] || [];
    }

    setAvailableLayerIds(mode, ids) {
        if (!mode) return;
        this.availableLayerIdsByMode.set(mode, new Set(ids || []));
    }

    clearAvailableLayerIds(mode) {
        if (!mode) return;
        this.availableLayerIdsByMode.delete(mode);
    }

    getEmptyMessage(mode) {
        if (mode === 'PATRIMONIALES' || mode === 'INFRAESTRUCTURA' || mode === 'AREAS_METROPOLITANAS_SUBURBANIZACION' || mode === 'PROYECTOS_TURISTICOS_ESPECIALES') {
            return 'No se encuentran determinantes correspondientes al municipio consultado.';
        }
        return 'No hay información para la consulta seleccionada.';
    }

    getActive(state) {
        const list = this.getList(
            state.get('currentMode'),
            state.get('filtroNivel'),
            state.get('condicionantesGroup')
        );
        return (list && list[state.get('currentSubLayerIndex')]) || null;
    }
}
