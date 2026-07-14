const namesDocument = {
  documento: {
    diagnostico: {
      label: "Diagnóstico",
      items: {
        institucional: {
          label: "Institucional",
          items: [
            "Capacidad de gestión de la ​administración municipal",
            "Análisis de la capacidad financiera del municipio",
            "Conflictos de límites con municipios vecinos",
            "OTRO",
          ],
        },
        sintesis: {
          label: "Síntesis",
          items: ["Documento Diagnóstico", "OTRO"],
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
            "Documento Formulación",
            "Documento Resumen",
            "OTRO",
          ],
        },
      },
    },
    implementacion: {
      label: "Implementacíon",
      items: [
        "Acuerdo, Decreto: Adopción POT",
        "Acuerdo, Decreto: Modificación POT",
        "Acuerdo, Decreto: Revisión y adopción a largo plazo",
        "Acuerdo, Decreto: Derogación",
        "Acuerdo, Decreto: Planes parciales",
        "OTRO",
      ]},
      evaluacionyseguimiento: {
        label: "Evaluación y Seguimiento",
        items: ["Documento Evaluación y seguimiento", "OTRO"],
      },
  },
  cartografia: {
    diagnostico: {
      label: "Diagnóstico",
      items: {
        ambiental: {
          label: "Ambiental",
          items: [
            "Información Base Urbano",
            "Información Base Rural",
            "Zonificación climática Rural",
            "Geología Rural",
            "Hidrografía y áreas hidrográficas Rural",
            "Geomorfología Rural",
            "Pendientes Rural",
            "Capacidad de uso del suelo Rural",
            "Cobertura y uso actual del suelo Rural (metodología Corine Land Cover)",
            "Uso potencial del suelo Rural",
            "Conflictos de uso del suelo Urbano",
            "Conflictos de uso del suelo Rural",
            "Áreas de conservación y protección ambiental. Urbano",
            "Áreas de conservación y protección ambiental. Rural",
            "Amenazas por inundación Urbano",
            "Amenazas por inundación Rural",
            "Amenazas por movimiento en masa Urbano",
            "Amenazas por movimiento en masa Rural",
            "Amenazas por Avenidas Torrenciales Urbano",
            "Amenazas por Avenidas Torrenciales Rural",
            "Amenazas por incendios forestales Rural",
            "OTRO",
          ],
        },
        economica: {
          label: "Económica",
          items: ["Predial Urbano", "Predial Rural", "OTRO"],
        },
        sociocultural: {
          label: "Socio-Cultural",
          items: ["Territorios étnicos", "OTRO"],
        },
        funcional: {
          label: "Funcional",
          items: [
            "Ocupación actual",
            "División Político Administrativa Urbano",
            "División Político Administrativa Rural",
            "Patrimonio Material Urbano",
            "Patrimonio Material Rural",
            "Equipamientos existentes Urbano",
            "Equipamientos existentes Rural",
            "Espacio público existente Urbano",
            "Espacio público existente Rural",
            "Infraestructura vial y de transporte Urbano",
            "Infraestructura vial y de transporte Rural",
            "Caracterización físico espacial",
            "Espacio Público Existente Urbano",
            "Espacio Público Existente Rural",
            "Servicios públicos Urbano",
            "Servicios públicos Rural",
            "Perímetro de Servicios Públicos",
            "Análisis del crecimiento urbano",
            "Uso actual del suelo urbano",
            "OTRO",
          ],
        },
        institucional: {
          label: "Institucional",
          items: ["OTRO"],
        },
        sintesis: {
          label: "Síntesis",
          items: ["GDB (BASE GEOGRÁFICA)"],
        },
      },
    },
    formulacion: {
      label: "Formulación",
      items: {
        general: {
          label: "General",
          items: [
            "Modelo de ocupación del territorio",
            "Clasificación del suelo",
            "Suelo de protección Urbano",
            "Suelo de protección Rural",
            "Áreas de conservación y protección ambiental",
            "Patrimonio material",
            "Gestión del riesgo",
            "Espacio público",
            "Infraestructura vial y de transporte",
            "Equipamientos",
            "Servicios públicos domiciliarios",
            "Servicios públicos Acueducto",
            "Servicios públicos Aseo y Alcantarillado",
            "Servicios públicos Energía",
            "Tecnologías de la Información y las Comunicaciones (TIC)",
            "GDB (BASE GEOGRÁFICA)",
            "OTRO",
          ],
        },
        urbano: {
          label: "Urbano",
          items: [
            "Suelo urbano y de expansión urbana",
            "Áreas de conservación Protección ambiental",
            "Patrimonio material",
            "Espacio público",
            "Servicios públicos domiciliarios",
            "Servicios públicos Acueducto",
            "Servicios públicos Aseo y Alcantarillado",
            "Servicios públicos Energía",
            "Equipamientos",
            "Infraestructura vial y de transporte",
            "Tratamientos urbanísticos",
            "Áreas de actividad",
            "Gestión del riesgo",
            "OTRO",
          ],
        },
        rural: {
          label: "Rural",
          items: [
            "Reglamentación del suelo rural.",
            "Áreas de conservación y protección ambiental",
            "Categorías del suelo rural",
            "Centros poblados",
            "Gestión del riesgo",
            "OTRO",
          ],
        },
      },
    },
  },
};

window.namesDocument = namesDocument;
