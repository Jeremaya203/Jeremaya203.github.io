const namesDocument = {
    documento: {
        diagnostico: {
            label: "Diagnóstico",
            items: {
                sintesis: {
                    label: "Síntesis",
                    items: [
                        "Documento Diagnóstico",
                        "Consolidado documentos diagnóstico"
                    ],
                },
            },
        },
        formulacion: {
            label: "Formulación",
            items: {
                general: {
                    label: "General",
                    items: [
                        "Documento técnico de soporte (DTS)",
                        "Documento Resumen",
                        "Consolidado documentos formulación",
                        "Adopción",
                        "Revisión por vencimiento por corto plazo",
                        "Revisión por vencimiento por mediano plazo",
                        "Revisión por vencimiento por largo plazo",
                        "Excepcional norma urbanistica",
                        "Excepcional de interes publico",
                        "Ajuste de POT para incoporar suelo urbano para VIS y VIP",
                        "OTRO",
                    ],
                },
            },
        },
        implementacion: {
            label: "Implementacíon",
            items: [
                "Programa de ejecución",
                "Plan parcial",
                "OTRO",
            ]
        },
        evaluacionyseguimiento: {
            label: "Evaluación y Seguimiento",
            items: [
                "Documento Evaluación y seguimiento",
                "Memoria justificativa",
                "Expediente municipal - anexos",
                "OTRO"
            ],
        },
    },
    cartografia: {
        diagnostico: {
            label: "Diagnóstico",
            items: {
                sintesis: {
                    label: "Síntesis",
                    items: ["Consolidado cartografía diagnóstico (DWG)", "Consolidado cartografía diagnóstico (PDF)", "Consolidado cartografía diagnóstico (GDB)", "Consolidado cartografía diagnóstico (SHP)", "Consolidado cartografía diagnóstico (Otros formatos)", "Consolidado cartografía diagnóstico - estudios de riesgo"],
                },
            },
        },
        formulacion: {
            label: "Formulación",
            items: {
                general: {
                    label: "General",
                    items: [
                        "Clasificación del suelo",
                        "Consolidado cartografía formulación (DWG)",
                        "Consolidado cartografía formulación (GDB)",
                        "Consolidado cartografía formulación (SHP)",
                        "Consolidado cartografía formulación (PDF)",
                        "Consolidado cartografía formulación (Otros formatos)",
                        "OTRO",
                    ],
                },
                urbano: {
                    label: "Urbano",
                    items: [
                        "Áreas de actividad",
                        "OTRO",
                    ],
                },
                rural: {
                    label: "Rural",
                    items: [
                        "Zonificación del suelo rural",
                        "OTRO",
                    ],
                },
            },
        },
    },
};

window.namesDocument = namesDocument;
