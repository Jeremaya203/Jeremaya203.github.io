// determinantes.config.js

const DETERMINANTES = {

    // ==========================================================
    // CORPORACIONES
    // ==========================================================
    corporaciones: {
        serviceId: 7,
        serviceName: "CL_CAR",

        renderer: {
            type: "service",          // La simbología se obtiene del servicio
            field: "carnombre",
            alias: "CARNombre"
        }
    },

    // ==========================================================
    // DETERMINANTES AMBIENTALES
    // ==========================================================
    ambientales: {

        // -------------------------
        // Vista Nacional
        // Escala 1:2.000.000 - 1:20.000.000
        // -------------------------
        nacional: {

            serviceId: 8,
            serviceName: "CL_DTS",

            minScale: 2000000,
            maxScale: 20000000,

            query: "Determ = 1 AND SHAPE_Area > 10000000000",

            renderer: {
                type: "unique-value",
                field: "determ",
                alias: "Determinante"
            },

            colors: {

                "1": {
                    value: "1",
                    label: "Ambientales",
                    fillColor: "#d5e0ce",
                    outlineColor: "#acb7a5",
                    outlineWidth: 0.5
                }

            }

        },

        // -------------------------
        // Vista Municipal
        // Escala 1 - 1:2.000.000
        // -------------------------
        municipal: {

            serviceId: 19,
            serviceName: "CL_DTS",

            minScale: 1,
            maxScale: 2000000,

            filterFields: {
                municipalityName: "mpnombre",
                municipalityCode: "mpcodigo"
            },

            renderer: {
                type: "unique-value",
                field: "determ",
                alias: "Determinante"
            },

            colors: {

                "1": {
                    value: "1",
                    label: "Ambientales",
                    fillColor: "#d5e0ce",
                    outlineColor: "#acb7a5",
                    outlineWidth: 0.5
                }

            }

        }

    },

    // ==========================================================
    // FIGURAS NO CONTINENTALES
    // ==========================================================
    figurasNoContinentales: {

        serviceId: 9,
        serviceName: "CL_NOC",

        renderer: {
            type: "service"
        }

    },

    factoresDeterminantes: {
        serviceId: null,
        serviceName: "CL",
        query: "determ IN (1,2,3,4,5,6)",
        renderer: {
            type: "unique-value",
            field: "determ",
            alias: "Tipo de determinante"
        },
        colors: {
            "1": {
                value: "1",
                label: "Ambientales",
                fillColor: "#70ad47",
                outlineColor: "#4f7f31",
                outlineWidth: 0.7
            },
            "2": {
                value: "2",
                label: "Soberanía Alimentaria",
                fillColor: "#ffc000",
                outlineColor: "#bf9000",
                outlineWidth: 0.7
            },
            "3": {
                value: "3",
                label: "Patrimoniales",
                fillColor: "#7030a0",
                outlineColor: "#4f2270",
                outlineWidth: 0.7
            },
            "4": {
                value: "4",
                label: "Infraestructura",
                fillColor: "#a6a6a6",
                outlineColor: "#737373",
                outlineWidth: 0.7
            },
            "5": {
                value: "5",
                label: "Áreas Metropolitanas y Suburbanización",
                fillColor: "#ed4de0",
                outlineColor: "#a936a0",
                outlineWidth: 0.7
            },
            "6": {
                value: "6",
                label: "Proyectos Turísticos Especiales",
                fillColor: "#4472c4",
                outlineColor: "#2f5597",
                outlineWidth: 0.7
            }
        }
    },

    sinap: {
    serviceId: 19,
    serviceName: "CL_DTS",

    query: "TDeterm = 1",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "101": {
            value: "101",
            label: "Parque Nacional Natural",
            fillColor: "#627232",
            outlineColor: "#38a800",
            outlineWidth: 0.8
        },
        "102": {
            value: "102",
            label: "Reservas Forestales Protectoras Nacionales",
            fillColor: "#e5fcbd",
            outlineColor: "#aaff00",
            outlineWidth: 0.7
        },
        "103": {
            value: "103",
            label: "Parques Naturales Regionales",
            fillColor: "#c7cefc",
            outlineColor: "#8400a8",
            outlineWidth: 0.7
        },
        "104": {
            value: "104",
            label: "Distritos Nacionales de Manejo Integrado",
            fillColor: "#ffc6ba",
            outlineColor: "#ff4a75",
            outlineWidth: 0.7
        },
        "105": {
            value: "105",
            label: "Distritos de Conservación de Suelos",
            fillColor: "#f4c56e",
            outlineColor: "#a87000",
            outlineWidth: 0.7
        },
        "106": {
            value: "106",
            label: "Áreas de Recreación",
            fillColor: "#722859",
            outlineColor: "#df73ff",
            outlineWidth: 0.7
        },
        "107": {
            value: "107",
            label: "Reservas naturales de la sociedad civil RNSC",
            fillColor: "#446589",
            outlineColor: "#00a9e6",
            outlineWidth: 0.7
        },
        "108": {
            value: "108",
            label: "Distritos Regionales de Manejo Integrado",
            fillColor: "#a8a800",
            outlineColor: "#e6e600",
            outlineWidth: 0.7
        },
        "109": {
            value: "109",
            label: "Área Natural Única",
            fillColor: "#fccfd8",
            outlineColor: "#ff73df",
            outlineWidth: 0.7
        },
        "110": {
            value: "110",
            label: "Reserva Natural",
            fillColor: "#ffffd3",
            outlineColor: "#f5f57a",
            outlineWidth: 0.7
        },
        "111": {
            value: "111",
            label: "Reservas Forestales Protectoras Regionales",
            fillColor: "#e2cf6c",
            outlineColor: "#f57a7a",
            outlineWidth: 0.7
        },
        "112": {
            value: "112",
            label: "Santuario de Fauna",
            fillColor: "#e7c4fc",
            outlineColor: "#c500ff",
            outlineWidth: 0.7
        },
        "113": {
            value: "113",
            label: "Santuario de Fauna y Flora",
            fillColor: "#fcd6ba",
            outlineColor: "#ffaa00",
            outlineWidth: 0.7
        },
        "114": {
            value: "114",
            label: "Santuario de Flora",
            fillColor: "#a87000",
            outlineColor: "#734c00",
            outlineWidth: 0.7
        },
        "115": {
            value: "115",
            label: "Vía Parque",
            fillColor: "#d79e9e",
            outlineColor: "#f57a8c",
            outlineWidth: 0.7
        }
    }
},

// Áreas de especial importancia ecosistémica (AEIE) y ecosistemas estratégicos.

aeie: {
    serviceId: 19,
    serviceName: "CL_DTS",

    query: "TDeterm = 2",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "201": {
            value: "201",
            label: "Páramos",
            fillColor: "#99d879",
            outlineColor: "#76b259",
            outlineWidth: 0.5,
            hatch: {
                separation: 3,
                angle: 45,
                lineWidth: 0.8
            }
        },
        "202": {
            value: "202",
            label: "Nacimientos de agua",
            fillColor: "#82c5d8",
            outlineColor: "#73b2ff",
            outlineWidth: 0.7
        },
        "203": {
            value: "203",
            label: "Zonas de recarga de acuíferos",
            fillColor: "#c4edef",
            outlineColor: "#a4eada",
            outlineWidth: 0.7
        },
        "204": {
            value: "204",
            label: "Rondas hídricas",
            fillColor: "#9fc18d",
            outlineColor: "#4c7300",
            outlineWidth: 0.7
        },
        "205": {
            value: "205",
            label: "Humedales",
            fillColor: "#d6c5dd",
            outlineColor: "#d0a2e8",
            outlineWidth: 0.7
        },
        "206": {
            value: "206",
            label: "Pantanos",
            fillColor: "#a58a54",
            outlineColor: "#732600",
            outlineWidth: 0.7
        },
        "207": {
            value: "207",
            label: "Lagos",
            fillColor: "#96a2e0",
            outlineColor: "#3a4d72",
            outlineWidth: 0.23
        },
        "208": {
            value: "208",
            label: "Lagunas",
            fillColor: "#cca3b7",
            outlineColor: "#e600a9",
            outlineWidth: 0.7
        },
        "209": {
            value: "209",
            label: "Ciénagas",
            fillColor: "#314c84",
            outlineColor: "#4375a8",
            outlineWidth: 0.7
        },
        "210": {
            value: "210",
            label: "Manglares",
            fillColor: "#e5bfae",
            outlineColor: "#ffa77f",
            outlineWidth: 0.7
        },
        "211": {
            value: "211",
            label: "Bosque seco tropical",
            fillColor: "#4c7300",
            outlineColor: "#70a800",
            outlineWidth: 0.7
        },
        "212": {
            value: "212",
            label: "Bosque seco tropical potencial",
            fillColor: "#747f5f",
            outlineColor: "#b4d79e",
            outlineWidth: 0.7
        },
        "213": {
            value: "213",
            label: "Bosques naturales",
            fillColor: "#7fa396",
            outlineColor: "#009584",
            outlineWidth: 0.7
        },
        "214": {
            value: "214",
            label: "Áreas forestales protectoras / de protección",
            fillColor: "#abc671",
            outlineColor: "#aaff00",
            outlineWidth: 0.7
        },
        "216": {
            value: "216",
            label: "Playas arenosas",
            fillColor: "#fcccdd",
            outlineColor: "#ff7f7f",
            outlineWidth: 0.7
        },
        "217": {
            value: "217",
            label: "Zonas secas",
            fillColor: "#ffebaf",
            outlineColor: "#ffd37f",
            outlineWidth: 0.7
        },
        "218": {
            value: "218",
            label: "Praderas de pastos marinos",
            fillColor: "#e9ffba",
            outlineColor: "#d1ff73",
            outlineWidth: 0.7
        },
        "219": {
            value: "219",
            label: "Corales",
            fillColor: "#beffe8",
            outlineColor: "#99ccc0",
            outlineWidth: 0.2
        },
        "220": {
            value: "220",
            label: "Sabanas",
            fillColor: "#e5e590",
            outlineColor: "#e6e600",
            outlineWidth: 0.7
        },
        "221": {
            value: "221",
            label: "Matorrales xerofíticos y desiertos",
            fillColor: "#ffffcc",
            outlineColor: "#e6e600",
            outlineWidth: 0.7
        },
        "222": {
            value: "222",
            label: "Áreas de Restauración de Bosques Naturales",
            fillColor: "#bcb3d1",
            outlineColor: "#c29ed7",
            outlineWidth: 0.7
        },
        "223": {
            value: "223",
            label: "Áreas para la conservación y protección ambiental",
            fillColor: "#d7d79e",
            outlineColor: "#d7d785",
            outlineWidth: 0.7
        },
        "226": {
            value: "226",
            label: "Parque Natural Municipal",
            fillColor: "#d7c29e",
            outlineColor: "#cdaa66",
            outlineWidth: 0.7
        },
        "227": {
            value: "227",
            label: "Selvas",
            fillColor: "#e1f4b7",
            outlineColor: "#abcd66",
            outlineWidth: 0.7
        }
    }
},

// Estrategias complementarias de conservación.

reservaForestalLey2da1959: {
    serviceId: 19,
    serviceName: "CL_DTS",

    query: "TDeterm = 3 AND SubDet = 301",

    renderer: {
        type: "unique-value",
        field: "Descrip",
        alias: "Subtipo de Descripción"
    },

    colors: {
        "Tipo A": {
            value: "Tipo A",
            label: "Tipo A",
            fillColor: "#004529",
            outlineColor: "#2d5645",
            outlineWidth: 0.7
        },
        "Tipo B": {
            value: "Tipo B",
            label: "Tipo B",
            fillColor: "#379e54",
            outlineColor: "#379e54",
            outlineWidth: 0.7
        },
        "Tipo C": {
            value: "Tipo C",
            label: "Tipo C",
            fillColor: "#bbe395",
            outlineColor: "#bbe395",
            outlineWidth: 0.7
        },
        "Áreas con Previa Decisión de Ordenamiento": {
            value: "Áreas con Previa Decisión de Ordenamiento",
            label: "Áreas con Previa Decisión de Ordenamiento",
            fillColor: "#ffffe5",
            outlineColor: "#ffffe5",
            outlineWidth: 0.7
        }
    }
},

estrategiasComplementariasConservacion: {
    serviceId: 19,
    serviceName: "CL_DTS",

    query: "TDeterm = 3 AND SubDet = 320",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "302": {
            value: "302",
            label: "Humedales Ramsar",
            fillColor: "#70c8e5",
            outlineColor: "#00a9e6",
            outlineWidth: 0.5
        },
        "303": {
            value: "303",
            label: "Áreas REAA - RUNAP",
            fillColor: "#ddace5",
            outlineColor: "#e600a9",
            outlineWidth: 0.4
        },
        "304": {
            value: "304",
            label: "Áreas de importancia para la conservación del recurso hídrico (AIERH)",
            fillColor: "#b091c1",
            outlineColor: "#b293c1",
            outlineWidth: 0.7,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 1
            }
        },
        "305": {
            value: "305",
            label: "Área importante para la conservación de las aves y la biodiversidad (AICA)",
            fillColor: "#4fa593",
            outlineColor: "#4fa593",
            outlineWidth: 1.0,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 1
            }
        },
        "306": {
            value: "306",
            label: "Áreas Potenciales (Áreas Potenciales Protegidas)",
            fillColor: "#f2d8c1",
            outlineColor: "#e69800",
            outlineWidth: 0.7
        },
        "307": {
            value: "307",
            label: "Áreas Potenciales (Áreas Potenciales Protegidas Prioritarias)",
            fillColor: "#ffcc60",
            outlineColor: "#e64c00",
            outlineWidth: 0.7
        },
        "308": {
            value: "308",
            label: "Áreas amortiguadoras",
            fillColor: "#afd7d8",
            outlineColor: "#73dfff",
            outlineWidth: 0.7
        },
        "309": {
            value: "309",
            label: "Reserva de biósfera",
            fillColor: "#a5c95c",
            outlineColor: "#a4ca5c",
            outlineWidth: 0.7,
            hatch: {
                type: "tiny-dashes",
                separation: 3,
                angle: 45,
                lineWidth: 1
            }
        },
        "310": {
            value: "310",
            label: "Reservas naturales de la sociedad civil No registradas en el RUNAP",
            fillColor: "#edafb9",
            outlineColor: "#ff7f7f",
            outlineWidth: 0.7
        },
        "311": {
            value: "311",
            label: "Áreas Forestales de Producción",
            fillColor: "#d6d69e",
            outlineColor: "#d7d79e",
            outlineWidth: 0.7,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 1
            }
        },
        "312": {
            value: "312",
            label: "Tierras Forestales de Producción",
            fillColor: "#ddc79f",
            outlineColor: "#d6bc8f",
            outlineWidth: 0.7
        },
        "313": {
            value: "313",
            label: "Reserva Forestal Especial",
            fillColor: "#c7afd6",
            outlineColor: "#c29ed7",
            outlineWidth: 0.7
        },
        "314": {
            value: "314",
            label: "Área de Manejo Especial",
            fillColor: "#dff0df",
            outlineColor: "#baefba",
            outlineWidth: 0.5
        },
        "315": {
            value: "315",
            label: "Reserva de Recursos Naturales",
            fillColor: "#a7ceb3",
            outlineColor: "#759961",
            outlineWidth: 0.7
        },
        "316": {
            value: "316",
            label: "Áreas del Sistema Departamental de Áreas Protegidas SIDAP",
            fillColor: "#bed5e0",
            outlineColor: "#bed5e0",
            outlineWidth: 0.7,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 1
            }
        },
        "317": {
            value: "317",
            label: "Áreas Priorizadas por Biodiversidad",
            fillColor: "#bf8383",
            outlineColor: "#bf8383",
            outlineWidth: 0.7
        },
        "318": {
            value: "318",
            label: "Plan de Manejo de Especies",
            fillColor: "#d6d6d6",
            outlineColor: "#d7c29e",
            outlineWidth: 0.35
        },
        "319": {
            value: "319",
            label: "Corredores de Fauna",
            fillColor: "#d6d68b",
            outlineColor: "#d7d78b",
            outlineWidth: 0.5,
            hatch: {
                type: "tiny-dashes",
                separation: 2,
                angle: 45,
                lineWidth: 1.2
            }
        },
        "320": {
            value: "320",
            label: "Conectores ecosistémicos",
            fillColor: "#73874b",
            outlineColor: "#75894d",
            outlineWidth: 0.7,
            hatch: {
                type: "dashes",
                separation: 4,
                angle: 45,
                lineWidth: 1
            }
        }
    }
},

// Derivadas de instrumentos de planificación

pomca: {
    serviceId: 19,
    serviceName: "CL_DTS",
    query: "tdeterm = 4 AND subdet IN (401, 402)",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "401": {
            value: "401",
            label: "Protección y conservación ambiental",
            fillColor: "#9bb26e",
            outlineColor: "#abcd66",
            outlineWidth: 0.7,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 0.4
            }
        },
        "402": {
            value: "402",
            label: "Uso múltiple",
            fillColor: "#965d9e",
            outlineColor: "#aa66cd",
            outlineWidth: 0.5,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 0.4
            }
        }
    }
},

derivadasInstrumentosPlanificacion: {
    serviceId: 19,
    serviceName: "CL_DTS",
    query: "tdeterm = 4 AND subdet NOT IN (401, 402)",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "403": {
            value: "403",
            label: "POMIUAC (Protección y conservación ambiental)",
            fillColor: "#cfb3fc",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.5,
            hatch: {
                type: "tiny-dashes",
                separation: 2,
                angle: 45,
                lineWidth: 0.8
            }
        },
        "404": {
            value: "404",
            label: "POMIUAC (Uso múltiple)",
            fillColor: "#e2bbae",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.5,
            hatch: {
                type: "tiny-dashes",
                separation: 2,
                angle: 45,
                lineWidth: 0.5
            }
        },
        "405": {
            value: "405",
            label: "PGOF/POF (Forestal protector)",
            fillColor: "#3b7a1c",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "406": {
            value: "406",
            label: "PGOF/POF (Forestal productor)",
            fillColor: "#b6e557",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "407": {
            value: "407",
            label: "PGOF/POF (Forestal productor-protector)",
            fillColor: "#e5bb72",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "408": {
            value: "408",
            label: "PGOF/POF (Uso Forestal)",
            fillColor: "#fff17a",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "409": {
            value: "409",
            label: "PGOF/POF (Uso Agroforestal)",
            fillColor: "#a56e00",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "410": {
            value: "410",
            label: "PGOF/POF (Uso Silvopastoril)",
            fillColor: "#c4c499",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "411": {
            value: "411",
            label: "POMCH (Zona de aptitud ambiental)",
            fillColor: "#a1c9bd",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "412": {
            value: "412",
            label: "POMCH (Zona de aptitud ambiental y minería)",
            fillColor: "#d8d56c",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "413": {
            value: "413",
            label: "POMCH (Zona de desarrollo económico restringido)",
            fillColor: "#899a7b",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "414": {
            value: "414",
            label: "Plan de Ordenación del Recurso Hidrico PORH",
            fillColor: "#4e8ad8",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "415": {
            value: "415",
            label: "PORH (Categoria I)",
            fillColor: "#b8bcfc",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "416": {
            value: "416",
            label: "PORH (Categoria II)",
            fillColor: "#fcd6d1",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "417": {
            value: "417",
            label: "PORH (Categoria III)",
            fillColor: "#ccfcda",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "418": {
            value: "418",
            label: "PORH (Categoria IV)",
            fillColor: "#f4f486",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "419": {
            value: "419",
            label: "Plan de Manejo Ambiental PMAM",
            fillColor: "#5995a5",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "420": {
            value: "420",
            label: "Plan de Gestión Ambiental Regional PGAR (Áreas Prioritarias para la Conservación)",
            fillColor: "#ccd5fc",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "421": {
            value: "421",
            label: "Plan de Gestión Ambiental Regional PGAR (Áreas para la Producción Agrícola y Ganadera y de Explotación de Recursos Naturales)",
            fillColor: "#cccc66",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "422": {
            value: "422",
            label: "Plan de Gestión Ambiental Regional PGAR (Áreas de Protección Legal)",
            fillColor: "#37a500",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "423": {
            value: "423",
            label: "Plan de Gestión Ambiental Regional PGAR (Áreas de Reglamentación Especial)",
            fillColor: "#d6a566",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "424": {
            value: "424",
            label: "Reglamentación de Corrientes",
            fillColor: "#c898ce",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "425": {
            value: "425",
            label: "Plan de Manejo del Sistema de Humedales",
            fillColor: "#abcc66",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "426": {
            value: "426",
            label: "Zonificación Ecológica de Humedales",
            fillColor: "#fcbdd3",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "427": {
            value: "427",
            label: "Plan de Ordenamiento Ecoturistico (POE)",
            fillColor: "#cca24f",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "428": {
            value: "428",
            label: "Plan de Manejo Ambiental Acuífero (PMAA)",
            fillColor: "#b6b0e5",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "429": {
            value: "429",
            label: "Zonificación Ambiental y Ordenamiento Territorial de Reserva Forestal",
            fillColor: "#76cca9",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "430": {
            value: "430",
            label: "Plan Integral de Manejo",
            fillColor: "#878712",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        }
    }
},

// Derivadas de la estructura ecológica principal (EEP)
eepromEstructuraEcologicaPrincipal: {
    serviceId: 19,
    serviceName: "CL_DTS",

    query: "tdeterm = 5",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "501": {
            value: "501",
            label: "Áreas núcleo",
            fillColor: "#6699cd",
            outlineColor: "#556d87",
            outlineWidth: 0.7
        },
        "502": {
            value: "502",
            label: "Áreas para la conectividad",
            fillColor: "#aa66cd",
            outlineColor: "#c29ed7",
            outlineWidth: 0.7
        },
        "503": {
            value: "503",
            label: "Áreas para el uso sostenible",
            fillColor: "#70a800",
            outlineColor: "#98e600",
            outlineWidth: 0.7
        },
        "504": {
            value: "504",
            label: "Estructura Ecológica Principal",
            fillColor: "#fcccea",
            outlineColor: "#ff73df",
            outlineWidth: 0.7
        }
    }
},
// Gestión del recurso suelo
gestionRecursoSuelo: {
    serviceId: 19,
    serviceName: "CL_DTS",

    query: "tdeterm = 6",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "601": {
            value: "601",
            label: "Erosión",
            fillColor: "#ffd789",
            outlineColor: "#ffd684",
            outlineWidth: 0.5,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 1
            }
        },
        "602": {
            value: "602",
            label: "Salinización",
            fillColor: "#448970",
            outlineColor: "#448970",
            outlineWidth: 0.7,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 0.5
            }
        },
        "603": {
            value: "603",
            label: "Desertificación",
            fillColor: "#dd9f9f",
            outlineColor: "#cd6666",
            outlineWidth: 0.5,
            hatch: {
                type: "simple-stroke",
                separation: 3,
                angle: 45,
                lineWidth: 1
            }
        }
    }
},

// Gestión del riesgo y Cambio Climático

movimientosMasa: {
    serviceId: 19,
    serviceName: "CL_DTS",
    query: "TDeterm = 7 AND SubDet = 701",

    renderer: {
        type: "unique-value",
        field: "Descrip",
        alias: "Descripcion"
    },

    colors: {
        "Amenaza muy alta": {
            value: "Amenaza muy alta",
            label: "Amenaza muy alta",
            fillColor: "#592d00",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza alta": {
            value: "Amenaza alta",
            label: "Amenaza alta",
            fillColor: "#85521f",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza media": {
            value: "Amenaza media",
            label: "Amenaza media",
            fillColor: "#b0773e",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza baja": {
            value: "Amenaza baja",
            label: "Amenaza baja",
            fillColor: "#d9a877",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza muy baja": {
            value: "Amenaza muy baja",
            label: "Amenaza muy baja",
            fillColor: "#fff3e6",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        }
    }
},

inundacion: {
    serviceId: 19,
    serviceName: "CL_DTS",
    query: "TDeterm = 7 AND SubDet = 702",

    renderer: {
        type: "unique-value",
        field: "Descrip",
        alias: "Descripcion"
    },

    colors: {
        "Amenaza muy alta": {
            value: "Amenaza muy alta",
            label: "Amenaza muy alta",
            fillColor: "#002672",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza alta": {
            value: "Amenaza alta",
            label: "Amenaza alta",
            fillColor: "#002672",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza media": {
            value: "Amenaza media",
            label: "Amenaza media",
            fillColor: "#004ba8",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza baja": {
            value: "Amenaza baja",
            label: "Amenaza baja",
            fillColor: "#006eff",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza muy baja": {
            value: "Amenaza muy baja",
            label: "Amenaza muy baja",
            fillColor: "#bfe8ff",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        }
    }
},

incendios: {
    serviceId: 19,
    serviceName: "CL_DTS",
    query: "TDeterm = 7 AND SubDet = 703",

    renderer: {
        type: "unique-value",
        field: "Descrip",
        alias: "Descripcion"
    },

    colors: {
        "Amenaza muy alta": {
            value: "Amenaza muy alta",
            label: "Amenaza muy alta",
            fillColor: "#4d4700",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza alta": {
            value: "Amenaza alta",
            label: "Amenaza alta",
            fillColor: "#827700",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza media": {
            value: "Amenaza media",
            label: "Amenaza media",
            fillColor: "#b6a700",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza baja": {
            value: "Amenaza baja",
            label: "Amenaza baja",
            fillColor: "#e3d540",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        },
        "Amenaza muy baja": {
            value: "Amenaza muy baja",
            label: "Amenaza muy baja",
            fillColor: "#ffffff",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        }
    }
},

avenidaTorrencial: {
    serviceId: 19,
    serviceName: "CL_DTS",
    query: "TDeterm = 7 AND SubDet = 704",

    renderer: {
        type: "unique-value",
        field: "Descrip",
        alias: "Descripcion"
    },

    colors: {
        "Amenaza muy alta": {
            value: "Amenaza muy alta",
            label: "Amenaza muy alta",
            fillColor: "#404873",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza alta": {
            value: "Amenaza alta",
            label: "Amenaza alta",
            fillColor: "#57629f",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza media": {
            value: "Amenaza media",
            label: "Amenaza media",
            fillColor: "#6f7bca",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza baja": {
            value: "Amenaza baja",
            label: "Amenaza baja",
            fillColor: "#9ea8ec",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        },
        "Amenaza muy baja": {
            value: "Amenaza muy baja",
            label: "Amenaza muy baja",
            fillColor: "#ffffff",
            outlineColor: "#6e6e6e",
            outlineWidth: 0
        }
    }
},

usoBiodiversidadPaisaje: {
    serviceId: 19,
    serviceName: "CL_DTS",

    query: "TDeterm = 8",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "801": {
            value: "801",
            label: "Áreas Naturales Remanentes",
            fillColor: "#89cd66",
            outlineColor: "#5c8944",
            outlineWidth: 0.7,
            hatch: {
                type: "tiny-dashes",
                separation: 3,
                angle: 180,
                lineWidth: 1
            }
        }
    }
},

soberaniaAlimentariaNacional: {
    serviceId: 10,
    serviceName: "CL_DTS",

    minScale: 2000000,
    maxScale: 20000000,

    query: "determ = 2",

    renderer: {
        type: "unique-value",
        field: "determ",
        alias: "Determinante"
    },

    colors: {
        "2": {
            value: "2",
            label: "Soberanía Alimentaria",
            fillColor: "#f4e1be",
            outlineColor: "#ffd987",
            outlineWidth: 0.5
        }
    }
},

appa: {
    serviceId: 19,
    serviceName: "CL_DTS",

    minScale: 1,
    maxScale: 1500000,

    query: "tdeterm = 10",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "1001": {
            value: "1001",
            label: "APPA",
            fillColor: "#e5ca99",
            outlineColor: "#ffdfa0",
            outlineWidth: 0.7
        }
    }
},

zonasReservaCampesina: {
    serviceId: 19,
    serviceName: "CL_DTS",

    minScale: 1,
    maxScale: 1500000,

    query: "TDeterm = 11",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "1101": {
            value: "1101",
            label: "Zona de reserva campesina",
            fillColor: "#9ccec2",
            outlineColor: "#91b7ad",
            outlineWidth: 0.7
        },
        "1102": {
            value: "1102",
            label: "Zonificación del PDS",
            fillColor: "#cc8a8a",
            outlineColor: "#cd6666",
            outlineWidth: 0.7
        }
    }
},

patrimonialesPuntosNacional: {
    serviceId: 12,
    serviceName: "CL_DPP",

    minScale: 2000000,
    maxScale: 20000000,

    query: "determ = 3",

    renderer: {
        type: "unique-value",
        field: "determ",
        alias: "Determinante"
    },

    geometryType: "point",

    colors: {
        "3": {
            value: "3",
            label: "Patrimoniales",
            fillColor: "#d8c76e",
            outlineColor: "#bfab4a",
            outlineWidth: 0.7,
            symbol: {
                type: "icon",
                name: "museum",
                size: 10
            }
        }
    }
},

patrimonialesPoligonosNacional: {
    serviceId: 13,
    serviceName: "CL_DTS",

    minScale: 2000000,
    maxScale: 20000000,

    query: "determ = 3",

    renderer: {
        type: "unique-value",
        field: "determ",
        alias: "Determinante"
    },

    geometryType: "polygon",

    colors: {
        "3": {
            value: "3",
            label: "Patrimoniales",
            fillColor: "#daca6f",
            outlineColor: "#daca6f",
            outlineWidth: 0
        }
    }
},

sitiosArqueologicos: {
    serviceId: 19,
    serviceName: "CL_DPP",

    minScale: 1,
    maxScale: 2000000,

    query: "tdeterm = 12 AND subdet = 1201",

    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de determinante"
    },

    geometryType: "point",

    colors: {
        "1201": {
            value: "1201",
            label: "Sitios arqueológicos",
            fillColor: "#DBCB74",
            outlineColor: "#cd8966",
            outlineWidth: 0.5,
            iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAXCAYAAAAGAx/kAAAACXBIWXMAAA7EAAAOxAGVKw4bAAABJElEQVQ4je2UQU7DMBBF/9jBPUO7rhCsAxKLHgH1GtmYcAauUNiUYwBHyKKiyZqo6jo9AyDbaIyJFKhEWrxg0b+wFGXmZTzK/wkiKeGjLvRoX8DJ5K5pQWIgLuFovg9otcyz4/PZvQfFUMKHfbVPpOSGgOFO3YSKe1sQ37Mu9BmULHvDiCFm2tnRF+zl+SqTEA9cJIzL3oUb+WcABnZ6ZKkxgh75Y8bZm9MA6YC+a3wxq+pCb6DCAG+uGk9um9XyuoH7OXXcZcdQEoWCA+h/LHu9yFP+sxHkFKXrRT60v4G40SBEiUNqBZUS1BayVazw77wExLwudNXxmocED/W9CnGtkiWbnWGfMSKR0hb/9IERhyIQOdg4KutC+4DaVVvz6C8jfQApVm5JgS+xnwAAAABJRU5ErkJggg==",
            symbol: {
                type: "icon",
                name: "house",
                width: 13,
                height: 17
            }
        }
    }
},

bienesInteresCultural: {
    serviceId: 19,
    serviceName: "CL_DPP",

    minScale: 1,
    maxScale: 2000000,

    query: "tdeterm = 12 AND subdet = 1202",

    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de determinante"
    },

    geometryType: "point",

    colors: {
        "1202": {
            value: "1202",
            label: "Bienes de interés cultural",
            fillColor: "#a55c38",
            outlineColor: "#a84818",
            outlineWidth: 0.5,
            iconUrl: "./img/patrimoniales/sitios_arqueologicos_house.svg",
            symbol: {
                type: "icon",
                name: "house",
                size: 18.5
            }
        }
    }
},

areasBienesInteresCultural: {
    serviceId: 19,
    serviceName: "CL_DTS",

    minScale: 1,
    maxScale: 2000000,

    query: "tdeterm = 12 AND subdet = 1202",

    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de determinante"
    },

    geometryType: "polygon",

    colors: {
        "1202": {
            value: "1202",
            label: "Áreas de Bienes de interés cultural",
            fillColor: "#ffedb7",
            outlineColor: "#ead69a",
            outlineWidth: 0.5
        }
    }
},

areasArqueologicas: {
    serviceId: 19,
    serviceName: "CL_DTS",

    minScale: 1,
    maxScale: 2000000,

    query: "tdeterm = 12 AND subdet = 1203",

    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de determinante"
    },

    geometryType: "polygon",

    colors: {
        "1203": {
            value: "1203",
            label: "Áreas arqueológicas protegidas",
            fillColor: "#a55c38",
            outlineColor: "#cd8966",
            outlineWidth: 0.5
        }
    }
},

areasArqueologicasPunto: {
    serviceId: 12,
    serviceName: "CL_DPP",

    minScale: 1,
    maxScale: 2000000,

    query: "tdeterm = 12 AND subdet = 1203",

    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de determinante"
    },

    geometryType: "point",

    colors: {
        "1203": {
            value: "1203",
            label: "Áreas arqueológicas protegidas",
            fillColor: "#a55c38",
            outlineColor: "#cd8966",
            outlineWidth: 0.7,
            symbol: {
                type: "point",
                size: 10
            }
        }
    }
},

infraestructuraPuntosNacional: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 2000000,
    maxScale: 20000000,
    query: "determ = 4",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1302": {
            value: "1302",
            label: "Puertos",
            fillColor: "#f5927a",
            outlineColor: "#f5927a",
            outlineWidth: 0,
            symbol: { type: "point", size: 5 }
        }
    }
},

suministroEnergiaPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1305",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1305": {
            value: "1305",
            label: "Suministro de energía (Líneas de transmisión - Subestaciones - Represas)",
            fillColor: "#38a800",
            outlineColor: "#4c7300",
            outlineWidth: 0.7,
            symbol: { type: "point", size: 8 }
        }
    }
},

disposicionResiduosSolidosPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1306",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1306": {
            value: "1306",
            label: "Disposición de residuos sólidos (Rellenos sanitarios)",
            fillColor: "#898944",
            outlineColor: "#737300",
            outlineWidth: 0.7,
            symbol: { type: "point", size: 8 }
        }
    }
},

equipamientosAltoImpactoAmbientalPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1307",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1307": {
            value: "1307",
            label: "Equipamientos Colectivos de Alto Impacto Ambiental",
            fillColor: "#002673",
            outlineColor: "#004c73",
            outlineWidth: 0.7,
            symbol: { type: "point", size: 8 }
        }
    }
},

gasoductoPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1308",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1308": {
            value: "1308",
            label: "Gasoducto",
            fillColor: "#4e4e6c",
            outlineColor: "#4e4e4e",
            outlineWidth: 0.7,
            symbol: { type: "point", size: 8 }
        }
    }
},

poliductoPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1309",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1309": {
            value: "1309",
            label: "Poliducto",
            fillColor: "#ffc654",
            outlineColor: "#ffc654",
            outlineWidth: 0.7,
            symbol: { type: "point", size: 8 }
        }
    }
},

transporteHidrocarburosPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1310",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1310": {
            value: "1310",
            label: "Oleoductos - Combustoleoductos",
            fillColor: "#734c00",
            outlineColor: "#734c00",
            outlineWidth: 1,
            symbol: { type: "point", size: 8 }
        }
    }
},

telecomunicacionesPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1311",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1311": {
            value: "1311",
            label: "Telecomunicaciones",
            fillColor: "#66cdab",
            outlineColor: "#00a884",
            outlineWidth: 0.7,
            symbol: { type: "point", size: 8 }
        }
    }
},

infraestructuraLineasNacional: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 2000000,
    maxScale: 20000000,
    query: "tdeterm = 13",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "Determ",
        alias: "Determinante"
    },
    colors: {
        "4": {
            value: "4",
            label: "Infraestructura",
            lineColor: "#f4907a",
            lineWidth: 1,
            lineStyle: "solid"
        }
    }
},

infraestructuraPoligonosNacional: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 2000000,
    maxScale: 20000000,
    query: "tdeterm = 13",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "Determ",
        alias: "Determinante"
    },
    colors: {
        "4": {
            value: "4",
            label: "Infraestructura",
            fillColor: "#9f5a5a",
            outlineColor: "#9f5a5a",
            outlineWidth: 0.5
        }
    }
},

reservasRedVialPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "tdeterm = 13 AND subdet = 1301",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1301": {
            value: "1301",
            label: "Reservas de la red vial nacional o regional",
            fillColor: "#e64c00",
            outlineColor: "#e64c00",
            outlineWidth: 0,
            symbol: { type: "point", size: 8 }
        }
    }
},

reservasRedVialLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "tdeterm = 13 AND subdet = 1301",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1301": {
            value: "1301",
            label: "Reservas de la red vial nacional o regional",
            lineColor: "#e64c00",
            lineWidth: 1,
            lineStyle: "solid"
        }
    }
},

reservasRedVialAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1301",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1301": {
            value: "1301",
            label: "Reservas de la red vial nacional o regional",
            fillColor: "#e56b29",
            outlineColor: "#ffaa00",
            outlineWidth: 0.7
        }
    }
},

puertos: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1302 AND NomDet NOT LIKE '%Aeropuerto%'",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1302": {
            value: "1302",
            label: "Puertos",
            fillColor: "#f4907a",
            outlineColor: "#894e4e",
            outlineWidth: 0,
            symbol: {
                type: "icon",
                name: "motorboat",
                size: 25
            }
        }
    }
},

aeropuertos: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1302 AND NomDet LIKE '%Aeropuerto%'",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1302": {
            value: "1302",
            label: "Aeropuertos",
            fillColor: null,
            outlineColor: null,
            outlineWidth: 0,
            symbol: {
                type: "icon",
                name: "airplane-small-passenger",
                size: 30
            }
        }
    }
},

puertosAeropuertosPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "tdeterm = 13 AND subdet = 1302",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "subdet",
        valueExpression: "IIF(Find('AEROPUERTO', Upper(DefaultValue($feature.nomdet, ''))) > -1, 'Aeropuertos', 'Puertos')",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "Puertos": {
            value: "Puertos",
            label: "Puertos",
            fillColor: "#f4907a",
            outlineColor: "#894e4e",
            outlineWidth: 0,
            iconUrl: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Ccircle%20cx%3D%2732%27%20cy%3D%2732%27%20r%3D%2729%27%20fill%3D%27%23f4907a%27/%3E%3Cpath%20d%3D%27M15%2035h34l-5%2010H22l-7-10Zm7-12h8v9h-8v-9Zm11-6h8v15h-8V17Zm-18%2029c5%203%209%203%2014%200%205%203%209%203%2014%200%202%202%204%203%206%203v5c-3%200-6-1-9-3-5%203-10%203-15%200-4%203-9%203-14%200v-5c1%200%203-1%204-1Z%27%20fill%3D%27%23ffffff%27/%3E%3C/svg%3E",
            symbol: { type: "icon", size: 25, width: 25, height: 25 }
        },
        "Aeropuertos": {
            value: "Aeropuertos",
            label: "Aeropuertos",
            fillColor: "#894e4e",
            outlineColor: "#894e4e",
            outlineWidth: 0,
            iconUrl: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Cpath%20d%3D%27M31%205c3%200%205%202%205%205v17l19%2011v6L36%2038v13l8%205v5l-11-3-11%203v-5l8-5V38L11%2044v-6l20-11V10c0-3%202-5%205-5Z%27%20fill%3D%27%23894e4e%27/%3E%3C/svg%3E",
            symbol: { type: "icon", size: 30, width: 30, height: 30 }
        }
    }
},

puertosAeropuertosLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1302",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1302": {
            value: "1302",
            label: "Puertos y aeropuertos",
            lineColor: "#384286",
            lineWidth: 1
        }
    }
},

puertosAeropuertosAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1302",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1302": {
            value: "1302",
            label: "Áreas de los puertos y aeropuertos",
            fillColor: "#384286",
            outlineColor: "#384286",
            outlineWidth: 0.2
        }
    }
},

redFerreaPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "tdeterm = 13 AND subdet = 1303",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1303": {
            value: "1303",
            label: "Red Férrea",
            fillColor: "#8400a8",
            outlineColor: "#4c0073",
            outlineWidth: 0,
            symbol: { type: "point", size: 8 }
        }
    }
},

redFerreaLineas: {
    serviceId: 17,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1303",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1303": {
            value: "1303",
            label: "Red Férrea",
            lineColor: "#4c0073",
            outlineColor: "#4c0073",
            outlineWidth: 0.8,
            lineWidth: 1
        }
    }
},

redFerreaAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1303",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1303": {
            value: "1303",
            label: "Red Férrea",
            fillColor: "#8400a8",
            outlineColor: "#aa66cd",
            outlineWidth: 0.7
        }
    }
},

abastecimientoSaneamientoAguaPunto: {
    serviceId: 15,
    serviceName: "CL_DPP",
    minScale: 1,
    maxScale: 2000000,
    query: "tdeterm = 13 AND subdet = 1304",
    geometryType: "point",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1304": {
            value: "1304",
            label: "Sistemas de abastecimiento y saneamiento de agua",
            fillColor: "#002673",
            outlineColor: "#004da8",
            outlineWidth: 0,
            symbol: { type: "point", size: 8 }
        }
    }
},

abastecimientoSaneamientoAguaLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "tdeterm = 13 AND subdet = 1304",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1304": {
            value: "1304",
            label: "Sistemas de abastecimiento y saneamiento de agua",
            lineColor: "#002673",
            lineWidth: 1,
            lineStyle: "solid"
        }
    }
},

abastecimientoSaneamientoAguaAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1304",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1304": {
            value: "1304",
            label: "Sistemas de abastecimiento y saneamiento de agua (Plantas de Tratamiento PTAR - Sistemas de Tratamiento STAR)",
            fillColor: "#002673",
            outlineColor: "#004da8",
            outlineWidth: 0.7
        }
    }
},

suministroEnergiaLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1305",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1305": {
            value: "1305",
            label: "Suministro de energía (Líneas de transmisión - Subestaciones - Represas)",
            lineColor: "#267300",
            outlineColor: "#267300",
            outlineWidth: 0.5,
            lineWidth: 1.2,
            symbol: {
                type: "line-with-marker-continuous",
                size: 1.2
            }
        }
    }
},

suministroEnergiaAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1305",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1305": {
            value: "1305",
            label: "Suministro de energía (Lineas de Transmisión - Subestaciones - Represas)",
            fillColor: "#38a800",
            outlineColor: "#4c7300",
            outlineWidth: 0.7
        }
    }
},

disposicionResiduosSolidos: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1306",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1306": {
            value: "1306",
            label: "Disposición de residuos solidos (Rellenos sanitarios)",
            fillColor: "#898944",
            outlineColor: "#737300",
            outlineWidth: 0.7
        }
    }
},

disposicionResiduosSolidosLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1306",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1306": {
            value: "1306",
            label: "Disposición de residuos sólidos",
            lineColor: "#38a800",
            outlineColor: "#4c7300",
            outlineWidth: 0.5,
            lineWidth: 1
        }
    }
},

equipamientosAltoImpactoAmbiental: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1307",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1307": {
            value: "1307",
            label: "Equipamientos Colectivos de Alto Impacto Ambiental (Cementerios - Hornos Crematorios - Plantas de Beneficio Animal - Criaderos Animales - Sacrificios Animales)",
            fillColor: "#002673",
            outlineColor: "#004c73",
            outlineWidth: 0.7
        }
    }
},

equipamientosAltoImpactoAmbientalLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1307",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1307": {
            value: "1307",
            label: "Equipamientos Colectivos de Alto Impacto Ambiental",
            lineColor: "#002673",
            outlineColor: "#004c73",
            outlineWidth: 0.7,
            lineWidth: 1
        }
    }
},

gasoductoLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1308",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1308": {
            value: "1308",
            label: "Gasoducto",
            lineColor: "#4e4e4e",
            lineWidth: 1
        }
    }
},

gasoductoAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1308",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1308": {
            value: "1308",
            label: "Gasoducto",
            fillColor: "#4e4e6c",
            outlineColor: "#4e4e4e",
            outlineWidth: 0.7
        }
    }
},

poliductoLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1309",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1309": {
            value: "1309",
            label: "Poliducto",
            lineColor: "#ffaa00",
            lineWidth: 1
        }
    }
},

poliductoAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1309",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1309": {
            value: "1309",
            label: "Poliducto",
            fillColor: "#ffc654",
            outlineColor: "#ffc654",
            outlineWidth: 0.7
        }
    }
},

transporteHidrocarburosLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1310",
    geometryType: "line",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1310": {
            value: "1310",
            label: "Oleoductos - Combustoleoductos",
            lineColor: "#cdaa66",
            outlineColor: "#897044",
            lineWidth: 1
        }
    }
},

transporteHidrocarburosAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "TDeterm = 13 AND SubDet = 1310",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1310": {
            value: "1310",
            label: "Oleoductos - Combustoleoductos",
            fillColor: "#734c00",
            outlineColor: "#734c00",
            outlineWidth: 1
        }
    }
},
telecomunicacionesLineas: {
    serviceId: 16,
    serviceName: "CL_DPL",
    minScale: 1,
    maxScale: 2000000,

    query: "TDeterm = 13 AND SubDet = 1311",

    geometryType: "line",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "1311": {
            value: "1311",
            label: "Telecomunicaciones",
            lineColor: "#00734c",
            lineWidth: 1,
            symbol: {
                type: "boundary"
            }
        }
    }
},

telecomunicacionesAreas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,

    query: "TDeterm = 13 AND SubDet = 1311",

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "SubDet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "1311": {
            value: "1311",
            label: "Telecomunicaciones",
            fillColor: "#66cdab",
            outlineColor: "#00a884",
            outlineWidth: 0.7
        }
    }
},

corredoresVialesSuburbanosMetropolitanos: {
    serviceId: 18,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "determ = 5 AND tdeterm = 14 AND subdet = 1401",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1401": {
            value: "1401",
            label: "Corredores viales suburbanos",
            fillColor: "#83a53e",
            outlineColor: "#83a53e",
            outlineWidth: 0.5
        }
    }
},

areasSuburbanasMetropolitanas: {
    serviceId: 18,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "determ = 5 AND tdeterm = 14 AND subdet = 1402",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1402": {
            value: "1402",
            label: "Áreas suburbanas",
            fillColor: "#c4a9d6",
            outlineColor: "#775b87",
            outlineWidth: 0.7
        }
    }
},

disposicionesDirectricesPIDM: {
    serviceId: 18,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "determ = 5 AND tdeterm = 15 AND subdet = 1501",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1501": {
            value: "1501",
            label: "Disposiciones y directrices del PIDM",
            fillColor: "#fcd6cc",
            outlineColor: "#eda695",
            outlineWidth: 0.5
        }
    }
},

redPueblosPatrimonio: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "determ = 6 AND tdeterm = 16 AND subdet = 1603",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1603": {
            value: "1603",
            label: "Red de Pueblos Patrimonio",
            fillColor: "#c55a11",
            outlineColor: "#8a3d0a",
            outlineWidth: 0.5
        }
    }
},

areasDesarrolloTuristicoPrioritario: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "determ = 6 AND tdeterm = 16 AND subdet = 1611",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1611": {
            value: "1611",
            label: "Áreas de Desarrollo Turístico Prioritario",
            fillColor: "#4472c4",
            outlineColor: "#2f4f82",
            outlineWidth: 0.5
        }
    }
},

zonasFrancasTuristicas: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,
    query: "determ = 6 AND tdeterm = 16 AND subdet = 1612",
    geometryType: "polygon",
    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },
    colors: {
        "1612": {
            value: "1612",
            label: "Zonas Francas Turísticas",
            fillColor: "#5b9bd5",
            outlineColor: "#2e75b6",
            outlineWidth: 0.5
        }
    }
},

areasMetropolitanaSuburbanizacionNacional: {
    serviceId: 18,
    serviceName: "CL_DTS",
    minScale: 2000000,
    maxScale: 20000000,

    query: "Determ = 5",

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "determ",
        alias: "Determinante"
    },

    colors: {
        "5": {
            value: "5",
            label: "Áreas Metropolitanas y Suburbanización",
            fillColor: "#c5c5e0",
            outlineColor: "#000000",
            outlineWidth: 0
        }
    }
},

densidadesOcupacionSueloRural: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,

    query: "TDeterm = 14",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "1402": {
            value: "1402",
            label: "Áreas suburbanas",
            fillColor: "#c4a9d6",
            outlineColor: "#775b87",
            outlineWidth: 0.7
        },
        "1401": {
            value: "1401",
            label: "Corredores viales suburbanos",
            fillColor: null,
            outlineColor: "#83a53e",
            outlineWidth: 0.5
        }
    }
},

planIntegralDesarrolloMetropolitano: {
    serviceId: 19,
    serviceName: "CL_DTS",
    minScale: 1,
    maxScale: 2000000,

    query: "TDeterm = 15",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "subdet",
        alias: "Subtipo de Determinante"
    },

    colors: {
        "1501": {
            value: "1501",
            label: "Disposiciones y directrices del plan",
            fillColor: "#fcd6cc",
            outlineColor: "#eda695",
            outlineWidth: 0.5
        }
    }
},

territoriosColectivosNacional: {
    serviceId: 21,
    serviceName: "CL_CTS",
    minScale: 1500000,
    maxScale: 20000000,

    query: "Condi = 1",

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "Condi",
        alias: "Condicionante"
    },

    colors: {
        "1": {
            value: "1",
            label: "Territorios colectivos",
            fillColor: "#efe3fc",
            outlineColor: "#6e6e6e",
            outlineWidth: 0.7
        }
    }
},

factoresCondicionantesMunicipal: {
    serviceId: 24,
    serviceName: "CL_CTS",
    minScale: 1,
    maxScale: 1500000,

    query: "tcondi IN (1,2,3)",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "tcondi",
        alias: "Tipo de Condicionante"
    },

    colors: {
        "1": {
            value: "1",
            label: "Territorios colectivos",
            fillColor: "#bda9cc",
            outlineColor: "#614272",
            outlineWidth: 0.5
        },
        "2": {
            value: "2",
            label: "Exploración y explotación de recursos no renovables",
            fillColor: "#d69dbc",
            outlineColor: "#732600",
            outlineWidth: 0.5
        },
        "3": {
            value: "3",
            label: "Acuerdo Final de Paz",
            fillColor: "#6c875e",
            outlineColor: "#267300",
            outlineWidth: 0.5
        }
    }
},

territoriosColectivosMunicipal: {
    serviceId: 24,
    serviceName: "CL_CTS",
    minScale: 1,
    maxScale: 1500000,

    query: "tcondi = 1",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "subcon",
        alias: "Subtipo de Condicionante"
    },

    colors: {
        "101": {
            value: "101",
            label: "Resguardos indígenas",
            fillColor: "#bda9cc",
            outlineColor: "#614272",
            outlineWidth: 0.5
        },
        "102": {
            value: "102",
            label: "Consejos comunitarios de las comunidades negras",
            fillColor: "#ffd2bf",
            outlineColor: "#f5a27a",
            outlineWidth: 0.5
        }
    }
},
explotacionRecursosNoRenovablesNacional: {
    serviceId: 22,
    serviceName: "CL_CTS",
    minScale: 1000000,
    maxScale: 20000000,

    query: "Condi = 2",

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "Condi",
        alias: "Condicionante"
    },

    colors: {
        "2": {
            value: "2",
            label: "Explotación de recursos no renovables",
            fillColor: "#cecece",
            outlineColor: "#9c9c9c",
            outlineWidth: 0.5
        }
    }
},

explotacionRecursosNoRenovablesMunicipal: {
    serviceId: 24,
    serviceName: "CL_CTS",
    minScale: 1,
    maxScale: 1000000,

    query: "TCondi = 2",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "subcon",
        alias: "Subtipo de Condicionante"
    },

    colors: {
        "201": {
            value: "201",
            label: "Títulos mineros activos",
            fillColor: "#d69dbc",
            outlineColor: "#732600",
            outlineWidth: 0.5
        },
        "202": {
            value: "202",
            label: "Bloques de explotación y exploración petrolera",
            fillColor: "#4e4e52",
            outlineColor: "#686868",
            outlineWidth: 0.7
        }
    }
},

acuerdoFinalPazNacional: {
    serviceId: 23,
    serviceName: "CL_CTS",
    minScale: 1000000,
    maxScale: 20000000,

    query: "Condi = 3",

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "Condi",
        alias: "Condicionante"
    },

    colors: {
        "4": {
            value: "4",
            label: "Acuerdo Final de Paz",
            fillColor: "#d7efe6",
            outlineColor: "#b6d6c9",
            outlineWidth: 0.01
        }
    }
},

acuerdoFinalPazMunicipal: {
    serviceId: 24,
    serviceName: "CL_CTS",
    minScale: 1,
    maxScale: 1000000,

    query: "TCondi = 3",

    filterFields: {
        municipalityName: "mpnombre",
        municipalityCode: "mpcodigo"
    },

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "subcon",
        alias: "Subtipo de Condicionante"
    },

    colors: {
        "301": {
            value: "301",
            label: "Preservación",
            fillColor: "#6c875e",
            outlineColor: "#267300",
            outlineWidth: 0.5
        },
        "302": {
            value: "302",
            label: "Restauración",
            fillColor: "#ffe0a3",
            outlineColor: "#ffaa00",
            outlineWidth: 0.5
        },
        "303": {
            value: "303",
            label: "Uso sostenible para el aprovechamiento de la biodiversidad",
            fillColor: "#c1c195",
            outlineColor: "#898944",
            outlineWidth: 0.5
        },
        "304": {
            value: "304",
            label: "Uso sostenible para el desarrollo",
            fillColor: "#e5d2ae",
            outlineColor: "#734c00",
            outlineWidth: 0.5
        },
        "305": {
            value: "305",
            label: "Protección por alta oferta de servicios ecosistémicos",
            fillColor: "#fff9ba",
            outlineColor: "#e6e600",
            outlineWidth: 0.5
        },
        "306": {
            value: "306",
            label: "Protección con uso sostenible",
            fillColor: "#b1d6c8",
            outlineColor: "#00734c",
            outlineWidth: 0.4
        },
        "307": {
            value: "307",
            label: "Uso productivo con protección",
            fillColor: "#8ba4ba",
            outlineColor: "#004c73",
            outlineWidth: 0.5
        },
        "308": {
            value: "308",
            label: "Uso productivo con reconversión",
            fillColor: "#cc8e8e",
            outlineColor: "#cd6666",
            outlineWidth: 0.5
        },
        "309": {
            value: "309",
            label: "Uso productivo",
            fillColor: "#e5e6e6",
            outlineColor: "#cdcece",
            outlineWidth: 0.4
        }
    }
},

lineaNegra: {
    serviceId: 24,
    serviceName: "CL_CTS",

    query: "TCondi = 6",

    geometryType: "polygon",

    renderer: {
        type: "unique-value",
        field: "subcon",
        alias: "Subtipo de Condicionante"
    },

    colors: {
        "601": {
            value: "601",
            label: "Espacios Sagrados",
            fillColor: "#efd8ac",
            outlineColor: "#efc87f",
            outlineWidth: 0
        }
    }
},


};

export class ColoresServices {
    constructor() {
        this.domains = DETERMINANTES;
        this._registerDerivedDomains();
    }

    getDomain(domainName) {
        if (!domainName) return null;
        return this.domains[domainName] || null;
    }

    getColors(domainName) {
        return this.getDomain(domainName)?.colors || {};
    }

    getColorInfo(domainName, value) {
        const colors = this.getColors(domainName);
        const rawValue = String(value ?? '');
        return colors[rawValue] || colors[rawValue.trim()] || null;
    }

    getLegendItems(domainName) {
        return Object.values(this.getColors(domainName)).map(item => ({
            code: String(item.value),
            value: item.value,
            label: item.label,
            field: this.getDomain(domainName)?.renderer?.field || '',
            color: item.fillColor || item.lineColor,
            iconUrl: item.iconUrl || this._resolveIconUrl(item.symbol?.name),
            symbolType: this._getLegendSymbolType(this.getDomain(domainName), item),
            hatchStyle: this._getFillHatchStyle(item.hatch),
            outlineColor: item.outlineColor,
            outlineWidth: item.outlineWidth
        }));
    }

    buildUniqueValueRenderer(domainName, options = {}) {
        const domain = this.getDomain(domainName);
        if (!domain?.colors) return null;

        const valueExpression = options.valueExpression || domain.renderer?.valueExpression;
        const field = valueExpression ? null : (options.field || domain.renderer?.field);
        if (!field && !valueExpression) return null;

        const fieldType = options.fieldType || 'integer';
        const symbolType = options.geometryType === 'point'
            ? 'simple-marker'
            : options.geometryType === 'polyline'
                ? 'simple-line'
                : 'simple-fill';

        return {
            type: 'unique-value',
            ...(field ? { field } : {}),
            ...(valueExpression ? {
                valueExpression,
                valueExpressionTitle: domain.renderer?.alias || domain.renderer?.field || 'Categoría'
            } : {}),
            uniqueValueInfos: Object.values(domain.colors).map(item => ({
                value: this._formatValue(item.value, fieldType),
                label: item.label,
                symbol: this._buildSymbol(symbolType, item)
            }))
        };
    }

    _formatValue(value, fieldType) {
        const text = String(value ?? '').trim();
        const numericTypes = new Set(['integer', 'small-integer', 'long', 'single', 'double', 'number']);
        if (numericTypes.has(fieldType) && text !== '' && !Number.isNaN(Number(text))) {
            return Number(text);
        }
        return text;
    }

    _buildSymbol(symbolType, item) {
        if (symbolType === 'simple-line') {
            return {
                type: 'simple-line',
                color: item.lineColor || item.outlineColor || item.fillColor,
                width: Number(item.lineWidth ?? item.outlineWidth ?? 1),
                style: item.lineStyle || 'solid'
            };
        }

        if (symbolType === 'simple-marker') {
            const custom = item.symbol || {};
            const size = Number(custom.size || item.size || 10);
            const iconUrl = item.iconUrl || custom.url || this._resolveIconUrl(custom.name);

            if (custom.type === 'icon' && iconUrl) {
                const width = Number(custom.width || size);
                const height = Number(custom.height || size);
                return {
                    type: 'picture-marker',
                    url: iconUrl,
                    width: `${width}px`,
                    height: `${height}px`
                };
            }

            return {
                type: 'simple-marker',
                style: custom.style || 'circle',
                color: item.fillColor,
                size,
                outline: {
                    color: item.outlineColor || item.fillColor,
                    width: Number(item.outlineWidth ?? 0.5)
                }
            };
        }

        return {
            type: 'simple-fill',
            color: item.fillColor,
            style: this._getFillHatchStyle(item.hatch) || 'solid',
            outline: {
                color: item.outlineColor || item.fillColor,
                width: Number(item.outlineWidth ?? 0)
            }
        };
    }

    _getFillHatchStyle(hatch) {
        if (!hatch) return null;
        const type = String(hatch.type || '').toLowerCase();
        if (type.includes('dash') || type.includes('line') || type.includes('hatch')) {
            return 'forward-diagonal';
        }
        return null;
    }

    _resolveIconUrl(name) {
        const icons = {
            house: './img/patrimoniales/sitios_arqueologicos_house.png'
        };
        return icons[String(name || '').trim()] || null;
    }

    _getLegendSymbolType(domain, item) {
        const geometry = String(domain?.geometryType || '').toLowerCase();
        if (geometry.includes('line') || item.lineColor) return 'line';
        if (geometry.includes('point') || item.symbol?.type === 'point' || item.symbol?.type === 'icon') return 'point';
        return 'polygon';
    }

    _registerDerivedDomains() {
        const factoresPuntoColors = { ...this.getColors('factoresDeterminantes') };
        const sitiosArqueologicosIcon = this.getColorInfo('sitiosArqueologicos', '1201');
        factoresPuntoColors['3'] = {
            ...factoresPuntoColors['3'],
            fillColor: '#DBCB74',
            outlineColor: '#cd8966',
            outlineWidth: 0.5,
            iconUrl: sitiosArqueologicosIcon?.iconUrl,
            symbol: sitiosArqueologicosIcon?.symbol
        };
        factoresPuntoColors['4'] = {
            ...factoresPuntoColors['4'],
            fillColor: '#f5927a',
            outlineColor: '#f5927a',
            outlineWidth: 0,
            symbol: { type: 'point', size: 5 }
        };

        this.domains.factoresDeterminantesPunto = {
            ...this.getDomain('factoresDeterminantes'),
            renderer: {
                type: 'unique-value',
                field: 'determ',
                alias: 'Tipo de determinante'
            },
            geometryType: 'point',
            colors: factoresPuntoColors
        };

        const factoresLineaColors = Object.fromEntries(
            Object.entries(this.getColors('factoresDeterminantes')).map(([key, item]) => [key, {
                ...item,
                lineColor: item.outlineColor || item.fillColor,
                outlineWidth: Number(item.outlineWidth ?? 1)
            }])
        );

        this.domains.factoresDeterminantesLinea = {
            ...this.getDomain('factoresDeterminantes'),
            renderer: {
                type: 'unique-value',
                field: 'determ',
                alias: 'Tipo de determinante'
            },
            geometryType: 'polyline',
            colors: factoresLineaColors
        };

        const factoresPoligonoColors = { ...this.getColors('factoresDeterminantes') };
        factoresPoligonoColors['1'] = {
            ...factoresPoligonoColors['1'],
            label: 'Ambientales',
            fillColor: '#d5e0ce',
            outlineColor: '#acb7a5',
            outlineWidth: 0.5
        };
        factoresPoligonoColors['2'] = {
            ...factoresPoligonoColors['2'],
            label: 'Soberanía Alimentaria',
            fillColor: '#f4e1be',
            outlineColor: '#ffd987',
            outlineWidth: 0.5
        };
        factoresPoligonoColors['3'] = {
            ...factoresPoligonoColors['3'],
            label: 'Patrimoniales',
            fillColor: '#daca6f',
            outlineColor: '#daca6f',
            outlineWidth: 0
        };
        factoresPoligonoColors['4'] = {
            ...factoresPoligonoColors['4'],
            label: 'Infraestructura',
            fillColor: '#f4907a',
            outlineColor: '#f4907a',
            outlineWidth: 1
        };
        factoresPoligonoColors['5'] = {
            ...factoresPoligonoColors['5'],
            label: 'Áreas Metropolitanas y Suburbanización',
            fillColor: '#c5c5e0',
            outlineColor: '#000000',
            outlineWidth: 0
        };

        this.domains.factoresDeterminantesPoligono = {
            ...this.getDomain('factoresDeterminantes'),
            renderer: {
                type: 'unique-value',
                field: 'determ',
                alias: 'Tipo de determinante'
            },
            geometryType: 'polygon',
            colors: factoresPoligonoColors
        };

        this.domains.derivadasInstrumentosPlanificacionAmbiental = this._mergeDomains(
            'pomca',
            'derivadasInstrumentosPlanificacion',
            {
                serviceId: 19,
                serviceName: 'CL_DTS',
                query: 'tdeterm = 4',
                renderer: {
                    type: 'unique-value',
                    field: 'subdet',
                    alias: 'Subtipo de Determinante'
                }
            }
        );

        this.domains.gestionRiesgoMovimientosMasa = this._riskClimateDomain(
            'movimientosMasa',
            'tdeterm = 7 AND subdet = 701'
        );
        this.domains.gestionRiesgoInundacion = this._riskClimateDomain(
            'inundacion',
            'tdeterm = 7 AND subdet = 702'
        );
        this.domains.gestionRiesgoIncendios = this._riskClimateDomain(
            'incendios',
            'tdeterm = 7 AND subdet = 703'
        );
        this.domains.gestionRiesgoAvenidaTorrencial = this._riskClimateDomain(
            'avenidaTorrencial',
            'tdeterm = 7 AND subdet = 704'
        );
        this.domains.gestionRiesgoErosionCostera = this._riskClimateDomain(
            'movimientosMasa',
            'tdeterm = 7 AND subdet = 705'
        );
        this.domains.gestionRiesgoAscensoNivelMar = this._riskClimateDomain(
            'inundacion',
            'tdeterm = 7 AND subdet = 706'
        );

        this.domains.gestionRiesgoCambioClimatico = {
            serviceId: 19,
            serviceName: 'CL_DTS',
            query: 'tdeterm = 7',
            renderer: {
                type: 'unique-value',
                field: 'subdet',
                alias: 'Subtipo de determinante'
            },
            geometryType: 'polygon',
            colors: {
                '701': {
                    value: '701',
                    label: 'Movimientos en Masa',
                    fillColor: '#85521f',
                    outlineColor: '#6e6e6e',
                    outlineWidth: 0.7
                },
                '702': {
                    value: '702',
                    label: 'Inundación',
                    fillColor: '#004ba8',
                    outlineColor: '#6e6e6e',
                    outlineWidth: 0.7
                },
                '703': {
                    value: '703',
                    label: 'Incendios',
                    fillColor: '#b6a700',
                    outlineColor: '#6e6e6e',
                    outlineWidth: 0.7
                },
                '704': {
                    value: '704',
                    label: 'Avenida Torrencial',
                    fillColor: '#6f7bca',
                    outlineColor: '#6e6e6e',
                    outlineWidth: 0.7
                },
                '705': {
                    value: '705',
                    label: 'Erosión Costera',
                    fillColor: '#d9a877',
                    outlineColor: '#6e6e6e',
                    outlineWidth: 0.7
                },
                '706': {
                    value: '706',
                    label: 'Ascenso sobre el nivel del mar',
                    fillColor: '#006eff',
                    outlineColor: '#6e6e6e',
                    outlineWidth: 0.7
                }
            }
        };

        this.domains.soberaniaAlimentariaSubdet = this._mergeDomains(
            'appa',
            'zonasReservaCampesina',
            {
                serviceId: 10,
                serviceName: 'CL_DTS',
                query: 'determ = 2',
                renderer: {
                    type: 'unique-value',
                    field: 'subdet',
                    alias: 'Subtipo de Determinante'
                }
            }
        );
    }

    _mergeDomains(firstDomainName, secondDomainName, overrides = {}) {
        const first = this.getDomain(firstDomainName) || {};
        const second = this.getDomain(secondDomainName) || {};
        return {
            ...first,
            ...second,
            ...overrides,
            renderer: overrides.renderer || second.renderer || first.renderer,
            colors: {
                ...(first.colors || {}),
                ...(second.colors || {})
            }
        };
    }

    _riskClimateDomain(sourceDomainName, query) {
        const source = this.getDomain(sourceDomainName) || {};
        return {
            ...source,
            serviceId: 19,
            serviceName: 'CL_DTS',
            query,
            renderer: {
                type: 'unique-value',
                field: 'descrip',
                alias: 'Descripción'
            },
            geometryType: 'polygon',
            colors: {
                ...(source.colors || {})
            }
        };
    }
}
