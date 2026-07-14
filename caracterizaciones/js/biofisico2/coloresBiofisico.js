
const coloresGeoformas = {
    "3001,3101": { color: "rgb(110, 70, 31)", label: "Altiplanicie, Abanicos aluviales" },
    "3001,3103": { color: "rgb(104, 57, 10)", label: "Altiplanicie, Abanicos mixtos" },
    "3001,3110": { color: "rgb(118, 70, 21)", label: "Altiplanicie, Cañones" },
    "3001,3121": { color: "rgb(133, 82, 31)", label: "Altiplanicie, Depresiones" },
    "3001,3125": { color: "rgb(147, 94, 41)", label: "Altiplanicie, Glacis" },
    "3001,3127": { color: "rgb(161, 106, 51)", label: "Altiplanicie, Lomas" },
    "3001,3128": { color: "rgb(176, 119, 62)", label: "Altiplanicie, Lomas y colinas" },
    "3001,3129": { color: "rgb(190, 131, 72)", label: "Altiplanicie, Mantos de arenas" },
    "3001,3131": { color: "rgb(204, 143, 82)", label: "Altiplanicie, Mesas" },
    "3001,3132": { color: "rgb(217, 168, 119)", label: "Altiplanicie, Mesas y cuestas" },
    "3001,3136": { color: "rgb(230, 193, 156)", label: "Altiplanicie, Ondulaciones" },
    "3001,3138": { color: "rgb(242, 218, 193)", label: "Altiplanicie, Peniplanos" },
    "3001,3149": { color: "rgb(100, 100, 0)", label: "Altiplanicie, Vallecitos" },
    "3002,3117": { color: "rgb(0, 112, 255)", label: "Cuerpos de agua" },
    "3003,3101": { color: "rgb(100, 100, 0)", label: "Lomerío, Abanicos aluviales" },
    "3003,3104": { color: "rgb(100, 100, 0)", label: "Lomerío, Abanicos terraza" },
    "3003,3106": { color: "rgb(255, 219, 177)", label: "Lomerío, Barras" },
    "3003,3112": { color: "rgb(255, 211, 164)", label: "Lomerío, Colinas" },
    "3003,3116": { color: "rgb(255, 204, 151)", label: "Lomerío, Crestones" },
    "3003,3118": { color: "rgb(255, 196, 139)", label: "Lomerío, Cuestas" },
    "3003,3121": { color: "rgb(255, 189, 126)", label: "Lomerío, Depresiones" },
    "3003,3122": { color: "rgb(255, 181, 115)", label: "Lomerío, Escarpes" },
    "3003,3123": { color: "rgb(255, 174, 103)", label: "Lomerío, Espinazos" },
    "3003,3125": { color: "rgb(254, 167, 91)", label: "Lomerío, Glacis" },
    "3003,3127": { color: "rgb(253, 160, 80)", label: "Lomerío, Lomas" },
    "3003,3128": { color: "rgb(251, 153, 69)", label: "Lomerío, Lomas y colinas" },
    "3003,3131": { color: "rgb(249, 146, 58)", label: "Lomerío, Mesas" },
    "3003,3133": { color: "rgb(247, 139, 47)", label: "Lomerío, Misceláneo erosionado" },
    "3003,3134": { color: "rgb(245, 132, 36)", label: "Lomerío, Misceláneo rocoso" },
    "3003,3136": { color: "rgb(242, 125, 24)", label: "Lomerío, Ondulaciones" },
    "3003,3149": { color: "rgb(240, 144, 34)", label: "Lomerío, Vallecitos" },
    "3004,3101": { color: "rgb(222, 51, 82)", label: "Montaña, Abanicos aluviales" },
    "3004,3104": { color: "rgb(227, 188, 179)", label: "Montaña, Abanicos terraza" },
    "3004,3105": { color: "rgb(179, 95, 111)", label: "Montaña, Artesas glaciales" },
    "3004,3106": { color: "rgb(191, 69, 42)", label: "Montaña, Barras" },
    "3004,3108": { color: "rgb(250, 148, 120)", label: "Montaña, Campos morrénicos" },
    "3004,3109": { color: "rgb(184, 78, 68)", label: "Montaña, Campos y coladas de lava" },
    "3004,3110": { color: "rgb(191, 136, 126)", label: "Montaña, Cañones" },
    "3004,3113": { color: "rgb(237, 107, 120)", label: "Montaña, Conos coluviales" },
    "3004,3114": { color: "rgb(245, 147, 163)", label: "Montaña, Crestas" },
    "3004,3115": { color: "rgb(250, 85, 60)", label: "Montaña, Crestas y crestones" },
    "3004,3116": { color: "rgb(235, 100, 82)", label: "Montaña, Crestones" },
    "3004,3118": { color: "rgb(194, 58, 88)", label: "Montaña, Cuestas" },
    "3004,3119": { color: "rgb(247, 75, 70)", label: "Montaña, Cumbres andinas" },
    "3004,3121": { color: "rgb(191, 42, 52)", label: "Montaña, Depresiones" },
    "3004,3122": { color: "rgb(222, 162, 175)", label: "Montaña, Escarpes" },
    "3004,3123": { color: "rgb(214, 116, 117)", label: "Montaña, Espinazos" },
    "3004,3124": { color: "rgb(69, 100, 0)", label: "Montaña, Filas y vigas" },
    "3004,3125": { color: "rgb(247, 172, 158)", label: "Montaña, Glacis" },
    "3004,3127": { color: "rgb(224, 112, 137)", label: "Montaña, Lomas" },
    "3004,3128": { color: "rgb(181, 78, 92)", label: "Montaña, Lomas y colinas" },
    "3004,3133": { color: "rgb(219, 140, 123)", label: "Montaña, Misceláneo erosionado" },
    "3004,3134": { color: "rgb(209, 125, 134)", label: "Montaña, Misceláneo rocoso" },
    "3004,3149": { color: "rgb(214, 107, 86)", label: "Montaña, Vallecitos" },
    "3005,3135": { color: "rgb(115, 0, 0)", label: "No aplica" },
    "3006,3111": { color: "rgb(152, 94, 168)", label: "Peneplanicie, Cerros residuales" },
    "3006,3125": { color: "rgb(216, 184, 245)", label: "Peneplanicie, Glacis" },
    "3006,3127": { color: "rgb(232, 190, 255)", label: "Peneplanicie, Lomas" },
    "3006,3128": { color: "rgb(255, 190, 232)", label: "Peneplanicie, Lomas y colinas" },
    "3006,3138": { color: "rgb(194, 158, 215)", label: "Peneplanicie, Peniplanos" },
    "3006,3149": { color: "rgb(214, 157, 188)", label: "Peneplanicie, Vallecitos" },
    "3007,3101": { color: "rgb(255, 255, 190)", label: "Piedemonte, Abanicos aluviales" },
    "3007,3102": { color: "rgb(255, 255, 115)", label: "Piedemonte, Abanicos antiguos" },
    "3007,3103": { color: "rgb(230, 230, 0)", label: "Piedemonte, Abanicos mixtos" },
    "3007,3104": { color: "rgb(245, 245, 122)", label: "Piedemonte, Abanicos terraza" },
    "3007,3112": { color: "rgb(255, 255, 142)", label: "Piedemonte, Colinas" },
    "3007,3125": { color: "rgb(255, 246, 142)", label: "Piedemonte, Glacis" },
    "3007,3126": { color: "rgb(245, 240, 158)", label: "Piedemonte, Llanura aluvial heredada" },
    "3007,3128": { color: "rgb(219, 249, 53)", label: "Piedemonte, Lomas y colinas" },
    "3007,3137": { color: "rgb(255, 255, 140)", label: "Piedemonte, Pedimento" },
    "3007,3149": { color: "rgb(229, 236, 138)", label: "Piedemonte, Vallecitos" },
    "3008,3121": { color: "rgb(215, 250, 208)", label: "Planicie fluvial, Depresiones" },
    "3008,3126": { color: "rgb(201, 239, 192)", label: "Planicie fluvial, Llanura aluvial heredada" },
    "3008,3139": { color: "rgb(187, 230, 176)", label: "Planicie fluvial, Plano de inundación" },
    "3008,3142": { color: "rgb(173, 220, 161)", label: "Planicie fluvial, Terrazas" },
    "3008,3143": { color: "rgb(159, 211, 146)", label: "Planicie fluvial, Terrazas antiguas" },
    "3008,3147": { color: "rgb(144, 202, 132)", label: "Planicie fluvial, Terrazas recientes" },
    "3008,3148": { color: "rgb(128, 194, 119)", label: "Planicie fluvial, Terrazas subrecientes" },
    "3009,3107": { color: "rgb(112, 186, 106)", label: "Planicie fluvio-eólica, Campos de dunas" },
    "3009,3129": { color: "rgb(94, 178, 95)", label: "Planicie fluvio-eólica, Mantos de arenas" },
    "3009,3130": { color: "rgb(72, 170, 87)", label: "Planicie fluvio-eólica, Mantos de limos" },
    "3009,3149": { color: "rgb(48, 162, 82)", label: "Planicie fluvio-eólica, Vallecitos" },
    "3010,3139": { color: "rgb(26, 153, 80)", label: "Planicie fluvio-lacustre, Plano de inundación" },
    "3010,3142": { color: "rgb(11, 143, 79)", label: "Planicie fluvio-lacustre, Terrazas" },
    "3010,3147": { color: "rgb(6, 133, 77)", label: "Planicie fluvio-lacustre, Terrazas recientes" },
    "3010,3149": { color: "rgb(10, 123, 74)", label: "Planicie fluvio-lacustre, Vallecitos" },
    "3011,3134": { color: "rgb(15, 113, 70)", label: "Planicie fluvio-marina, Misceláneo rocoso" },
    "3011,3140": { color: "rgb(20, 103, 65)", label: "Planicie fluvio-marina, Plano de marea" },
    "3011,3141": { color: "rgb(23, 93, 60)", label: "Planicie fluvio-marina, Plataforma costera" },
    "3011,3144": { color: "rgb(25, 84, 55)", label: "Planicie fluvio-marina, Terrazas litorales" },
    "3011,3145": { color: "rgb(26, 74, 48)", label: "Planicie fluvio-marina, Terrazas litorales recientes" },
    "3011,3146": { color: "rgb(25, 64, 42)", label: "Planicie fluvio-marina, Terrazas litorales subrecientes" },
    "3011,3147": { color: "rgb(23, 55, 35)", label: "Planicie fluvio-marina, Terrazas recientes" },
    "3011,3148": { color: "rgb(21, 45, 27)", label: "Planicie fluvio-marina, Terrazas subrecientes" },
    "3011,3149": { color: "rgb(17, 36, 20)", label: "Planicie fluvio-marina, Vallecitos" },
    "3012,3104": { color: "rgb(57, 34, 99)", label: "Valle, Abanicos terraza" },
    "3012,3120": { color: "rgb(40, 60, 111)", label: "Valle, Depresión de deflación" },
    "3012,3126": { color: "rgb(45, 96, 156)", label: "Valle, Llanura aluvial heredada" },
    "3012,3139": { color: "rgb(89, 126, 205)", label: "Valle, Plano de inundación" },
    "3012,3142": { color: "rgb(158, 158, 233)", label: "Valle, Terrazas" },
    "3012,3143": { color: "rgb(196, 190, 243)", label: "Valle, Terrazas antiguas" },
    "3012,3147": { color: "rgb(225, 222, 249)", label: "Valle, Terrazas recientes" },
    "3012,3148": { color: "rgb(190, 232, 255)", label: "Valle, Terrazas subrecientes" }
};

const coloresTemperatura = {
    "4001": { color: "rgb(214, 157, 188)", label: "< 8" },
    "4002": { color: "rgb(122, 182, 245)", label: "8 - 12" },
    "4003": { color: "rgb(204, 240, 255)", label: "12 - 16" },
    "4004": { color: "rgb(158, 215, 194)", label: "16 - 20" },
    "4005": { color: "rgb(171, 205, 102)", label: "20 - 22" },
    "4006": { color: "rgb(76, 230, 0)", label: "22 - 24" },
    "4007": { color: "rgb(245, 245, 122)", label: "24 - 26" },
    "4008": { color: "rgb(255, 211, 127)", label: "26 - 28" },
    "4009": { color: "rgb(255, 190, 85)", label: "> 28" }
};

const coloresClimas = {
    "7001": { color: "rgb(214, 109, 44)", label: "Cálido desértico" },
    "7002": { color: "rgb(223, 128, 34)", label: "Cálido árido" },
    "7003": { color: "rgb(255, 211, 127)", label: "Cálido semiárido" },
    "7004": { color: "rgb(255, 235, 190)", label: "Cálido semihúmedo" },
    "7005": { color: "rgb(247, 220, 213)", label: "Cálido húmedo" },
    "7006": { color: "rgb(255, 179, 179)", label: "Cálido superhúmedo" },
    "7007": { color: "rgb(211, 255, 190)", label: "Templado desértico" },
    "7008": { color: "rgb(214, 250, 105)", label: "Templado árido" },
    "7009": { color: "rgb(173, 245, 82)", label: "Templado semiárido" },
    "7010": { color: "rgb(133, 238, 59)", label: "Templado semihúmedo" },
    "7011": { color: "rgb(89, 230, 34)", label: "Templado húmedo" },
    "7012": { color: "rgb(58, 218, 33)", label: "Templado superhúmedo" },
    "7013": { color: "rgb(62, 201, 73)", label: "Frío árido" },
    "7014": { color: "rgb(60, 184, 104)", label: "Frío semiárido" },
    "7015": { color: "rgb(53, 168, 133)", label: "Frío semihúmedo" },
    "7016": { color: "rgb(36, 152, 161)", label: "Frío húmedo" },
    "7017": { color: "rgb(31, 125, 164)", label: "Frío superhúmedo" },
    "7018": { color: "rgb(34, 94, 153)", label: "Muy frío semiárido" },
    "7019": { color: "rgb(122, 182, 245)", label: "Muy frío semihúmedo" },
    "7020": { color: "rgb(190, 210, 255)", label: "Muy frío húmedo" },
    "7021": { color: "rgb(190, 232, 255)", label: "Muy frío superhúmedo" },
    "7022": { color: "rgb(194, 158, 215)", label: "Extremadamente frío superhúmedo" },
    "7023": { color: "rgb(232, 190, 255)", label: "Nival superhúmedo" }
};

const coloresCambioTemp = {
    "8001": { color: "rgb(255, 255, 204)", label: "Aumento entre 0 y 0,5 °C" },
    "8002": { color: "rgb(255, 237, 160)", label: "Aumento entre 0,5 y 1 °C" },
    "8003": { color: "rgb(254, 217, 118)", label: "Aumento entre 1 y 1,5 °C" },
    "8004": { color: "rgb(254, 178, 76)", label: "Aumento entre 1,5 y 2 °C" },
    "8005": { color: "rgb(253, 141, 60)", label: "Aumento entre 2 y 2,5 °C" },
    "8006": { color: "rgb(252, 78, 42)", label: "Aumento entre 2,5 y 3 °C" },
    "8007": { color: "rgb(227, 26, 28)", label: "Aumento entre 3 y 4 °C" },
    "8008": { color: "rgb(177, 0, 38)", label: "Aumento entre 4 y 5 °C" }
};

const coloresCambioPrecip = {
    "9001": { color: "rgb(190, 255, 232)", label: "Aumento entre 0% y 10%" },
    "9002": { color: "rgb(158, 215, 194)", label: "Aumento entre 10% y 20%" },
    "9003": { color: "rgb(122, 182, 245)", label: "Aumento entre 20% y 30%" },
    "9004": { color: "rgb(0, 132, 168)", label: "Aumento entre 30% y 40%" },
    "9005": { color: "rgb(233, 255, 190)", label: "Reducción entre 0% y 10%" },
    "9006": { color: "rgb(245, 245, 122)", label: "Reducción entre 10% y 20%" },
    "9007": { color: "rgb(255, 127, 127)", label: "Reducción entre 20% y 30%" }
};

const coloresRiesgo = {
    "0": { color: "rgb(78, 78, 78)", label: "Sin información" },
    "1": { color: "rgb(250, 233, 212)", label: "Muy bajo" },
    "2": { color: "rgb(235, 186, 159)", label: "Bajo" },
    "3": { color: "rgb(216, 143, 112)", label: "Medio" },
    "4": { color: "rgb(195, 103, 70)", label: "Alto" },
    "5": { color: "rgb(171, 65, 36)", label: "Muy alto" }
};

const coloresPrecipitacion = {
    "5001": { color: "rgb(255, 235, 175)", label: "0 - 50" },
    "5002": { color: "rgb(255, 255, 190)", label: "50 - 100" },
    "5003": { color: "rgb(209, 255, 115)", label: "100 - 150" },
    "5004": { color: "rgb(0, 230, 169)", label: "150 - 200" },
    "5005": { color: "rgb(154, 214, 206)", label: "200 - 300" },
    "5006": { color: "rgb(103, 192, 202)", label: "300 - 400" },
    "5007": { color: "rgb(21, 221, 238)", label: "400 - 600" },
    "5008": { color: "rgb(0, 169, 230)", label: "600 - 800" },
    "5009": { color: "rgb(170, 102, 205)", label: "800 - 1000" },
    "5010": { color: "rgb(112, 68, 137)", label: "> 1000" }
};

// Diccionario para Hipsometría: mapea el código numérico (campo rangoh) a color y label
const coloresHipsometricos = {
    1001: { color: "rgba(175,240,233,1)", label: "< - 0" },
    1002: { color: "rgba(177,242,211,1)", label: "0 - 1" },
    1003: { color: "rgba(176,245,185,1)", label: "1 - 2" },
    1004: { color: "rgba(195,247,178,1)", label: "2 - 5" },
    1005: { color: "rgba(223,250,177,1)", label: "5 - 10" },
    1006: { color: "rgba(255,255,179,1)", label: "10 - 20" },
    1007: { color: "rgba(199,230,129,1)", label: "20 - 30" },
    1008: { color: "rgba(133,204,86,1)", label: "30 - 40" },
    1009: { color: "rgba(63,179,50,1)", label: "40 - 50" },
    1010: { color: "rgba(21,153,48,1)", label: "50 - 75" },
    1011: { color: "rgba(0,128,64,1)", label: "75 - 100" },
    1012: { color: "rgba(49,142,58,1)", label: "100 - 150" },
    1013: { color: "rgba(98,156,52,1)", label: "150 - 200" },
    1014: { color: "rgba(147,170,46,1)", label: "200 - 250" },
    1015: { color: "rgba(197,185,40,1)", label: "250 - 300" },
    1016: { color: "rgba(245,196,37,1)", label: "300 - 400" },
    1017: { color: "rgba(222,147,27,1)", label: "400 - 500" },
    1018: { color: "rgba(199,102,18,1)", label: "500 - 600" },
    1019: { color: "rgba(173,59,10,1)", label: "600 - 700" },
    1020: { color: "rgba(150,26,5,1)", label: "700 - 800" },
    1021: { color: "rgba(128,0,0,1)", label: "800 - 900" },
    1022: { color: "rgba(126,12,3,1)", label: "900 - 1000" },
    1023: { color: "rgba(125,25,7,1)", label: "1000 - 1250" },
    1024: { color: "rgba(124,37,10,1)", label: "1250 - 1500" },
    1025: { color: "rgba(123,50,14,1)", label: "1500 - 1750" },
    1026: { color: "rgba(121,62,17,1)", label: "1750 - 2000" },
    1027: { color: "rgba(134,87,51,1)", label: "2000 - 2250" },
    1028: { color: "rgba(147,111,84,1)", label: "2250 - 2500" },
    1029: { color: "rgba(159,136,118,1)", label: "2500 - 3000" },
    1030: { color: "rgba(172,160,151,1)", label: "3000 - 3500" },
    1031: { color: "rgba(185,185,185,1)", label: "3500 - 4000" },
    1032: { color: "rgba(198,198,198,1)", label: "4000 - 4500" },
    1033: { color: "rgba(212,212,212,1)", label: "4500 - 5000" },
    1034: { color: "rgba(225,225,226,1)", label: "5000 - 5500" },
    1035: { color: "rgba(239,239,240,1)", label: "5500 - >" }
};

const coloresCuencas = {
    "11001": { color: "rgb(204, 235, 197)", label: "Amazonas" },
    "11002": { color: "rgb(251, 180, 174)", label: "Caribe" },
    "11003": { color: "rgb(190, 232, 255)", label: "Magdalena Cauca" },
    "11004": { color: "rgb(254, 217, 166)", label: "Orinoco" },
    "11005": { color: "rgb(222, 203, 228)", label: "Pacifico" }
};

const coloresEscorrentia = {
    "12001": { color: "rgb(136, 82, 17)", label: "0 - 100" },
    "12002": { color: "rgb(161, 78, 6)", label: "100 - 200" },
    "12003": { color: "rgb(194, 102, 10)", label: "200 - 300" },
    "12004": { color: "rgb(230, 152, 0)", label: "300 - 400" },
    "12005": { color: "rgb(245, 202, 122)", label: "400 - 600" },
    "12006": { color: "rgb(255, 255, 115)", label: "600 - 800" },
    "12007": { color: "rgb(255, 255, 190)", label: "800 - 1000" },
    "12008": { color: "rgb(211, 255, 190)", label: "1000 - 1500" },
    "12009": { color: "rgb(122, 245, 202)", label: "1500 - 2000" },
    "12010": { color: "rgb(158, 215, 194)", label: "2000 - 2500" },
    "12011": { color: "rgb(190, 186, 218)", label: "2500 - 3000" },
    "12012": { color: "rgb(161, 152, 197)", label: "3000 - 4000" },
    "12013": { color: "rgb(128, 115, 172)", label: "4000 - 5000" },
    "12014": { color: "rgb(214, 157, 188)", label: "5000 - 6000" },
    "12015": { color: "rgb(205, 102, 153)", label: "Mayor a 6000" }
};

const coloresDeforestacion = {
    "14001": { color: "rgb(255, 127, 127)", label: "Deforestación" },
    "14002": { color: "rgb(76, 230, 0)", label: "Regeneración" }
};

const coloresEcosistemas = {
    // Naturales (13001) - Verdes/Azules claros
    "Arbustal Andino Húmedo": { color: "rgb(190, 255, 232)", label: "Natural, Arbustal Andino Húmedo" },
    "Arbustal Inundable Andino": { color: "rgb(190, 255, 232)", label: "Natural, Arbustal Inundable Andino" },
    "Bosque Andino Húmedo": { color: "rgb(100, 100, 0)", label: "Natural, Bosque Andino Húmedo" },
    "Bosque Andino Seco": { color: "rgb(100, 100, 0)", label: "Natural, Bosque Andino Seco" },
    "Bosque Subandino Húmedo": { color: "rgb(100, 100, 0)", label: "Natural, Bosque Subandino Húmedo" },
    "Herbazal Andino Húmedo": { color: "rgb(215, 215, 158)", label: "Natural, Herbazal Andino Húmedo" },
    "Páramo": { color: "rgb(158, 215, 194)", label: "Natural, Páramo" },
    "Río de Aguas Blancas": { color: "rgb(115, 178, 255)", label: "Natural, Río de Aguas Blancas" },
    "Laguna Aluvial": { color: "rgb(102, 153, 205)", label: "Natural, Laguna Aluvial" },
    // Seminaturales (13002) - Rosados
    "Bosque Fragmentado con Pastos y Cultivos": { color: "rgb(245, 161, 160)", label: "Seminatural, Bosque Frag. con Pastos" },
    "Vegetación Secundaria": { color: "rgb(100, 100, 0)", label: "Seminatural, Vegetación Secundaria" },
    // Semitransformados (13003) - Naranjas/Amarillos
    "Agroecosistema de Mosaico de Cultivos y Espacios Naturales": { color: "rgb(237, 191, 100)", label: "Semitrans., Mosaico Cultivos y Espacios Nat." },
    "Agroecosistema de Mosaico de Pastos y Espacios Naturales": { color: "rgb(237, 191, 100)", label: "Semitrans., Mosaico Pastos y Espacios Nat." },
    "Agroecosistema de Mosaico de Cultivos, Pastos y Espacios Naturales": { color: "rgb(237, 191, 100)", label: "Semitrans., Mosaico Mixto" },
    // Transformados (13004) - Marrones claros
    "Agroecosistema Ganadero": { color: "rgb(215, 194, 158)", label: "Transformado, Ganadero" },
    "Agroecosistema de Mosaico de Cultivos y Pastos": { color: "rgb(217, 186, 208)", label: "Transformado, Mosaico Cultivos y Pastos" },
    "Agroecosistema de Cultivos Transitorios": { color: "rgb(217, 186, 208)", label: "Transformado, Cultivos Transitorios" },
    "Agroecosistema de Cultivos Permanentes": { color: "rgb(217, 186, 208)", label: "Transformado, Cultivos Permanentes" },
    // Artificializados (13005) - Morado
    "Territorio Artificializado": { color: "rgb(202, 122, 245)", label: "Artificializado, Urbano" }
};

const coloresVocacion = {
    "15101,15211": { color: "rgb(245, 245, 122)", label: "Agrícola, Cultivos permanentes intensivos" },
    "15101,15212": { color: "rgb(255, 255, 190)", label: "Agrícola, Cultivos permanentes semi intensivos" },
    "15101,15213": { color: "rgb(205, 205, 102)", label: "Agrícola, Cultivos transitorios intensivos" },
    "15101,15214": { color: "rgb(230, 230, 0)", label: "Agrícola, Cultivos transitorios semi intensivos" },
    "15102,15201": { color: "rgb(100, 100, 0)", label: "Agroforestal, Agrosilvícola con cultivos permanentes" },
    "15102,15202": { color: "rgb(100, 100, 0)", label: "Agroforestal, Agrosilvícola con cultivos transitorios" },
    "15102,15203": { color: "rgb(255, 235, 175)", label: "Agroforestal, Agrosilvopastoril con cultivos permanentes" },
    "15102,15204": { color: "rgb(245, 219, 122)", label: "Agroforestal, Agrosilvopastoril con cultivos transitorios" },
    "15102,15224": { color: "rgb(100, 100, 0)", label: "Agroforestal, Silvopastoril" },
    "15103,15205": { color: "rgb(112, 168, 0)", label: "Áreas de Protección Legal" },
    "15104,15206": { color: "rgb(60, 100, 0)", label: "Áreas Prioritarias para la Conservación" },
    "15105,15207": { color: "rgb(158, 170, 215)", label: "Conservación de Rec. Hidrobiológicos" },
    "15105,15208": { color: "rgb(214, 157, 188)", label: "Conservación y Recuperación Erosión" },
    "15105,15209": { color: "rgb(255, 190, 232)", label: "Conservación y Recuperación Salinidad" },
    "15106,15210": { color: "rgb(115, 178, 255)", label: "Cuerpos de agua" },
    "15107,15221": { color: "rgb(102, 205, 171)", label: "Forestal, Producción" },
    "15107,15222": { color: "rgb(165, 245, 122)", label: "Forestal, Protección" },
    "15107,15223": { color: "rgb(146, 255, 104)", label: "Forestal, Protección - producción" },
    "15108,15218": { color: "rgb(211, 255, 190)", label: "Ganadera, Pastoreo extensivo" },
    "15108,15219": { color: "rgb(180, 215, 158)", label: "Ganadera, Pastoreo intensivo" },
    "15108,15220": { color: "rgb(215, 215, 158)", label: "Ganadera, Pastoreo semi intensivo" },
    "15109,15215": { color: "rgb(245, 202, 122)", label: "Misceláneo Erosionado" },
    "15110,15216": { color: "rgb(215, 176, 158)", label: "Misceláneo Rocoso" },
    "15111,15217": { color: "rgb(225, 225, 225)", label: "No aplica" }
};

const coloresConflictos = {
    "16001": { color: "rgb(0, 112, 255)", label: "Conflictos en áreas de cuerpos de agua" },
    "16002": { color: "rgb(0, 230, 169)", label: "Conflictos en áreas pantanosas" },
    "16003": { color: "rgb(232, 190, 255)", label: "Conflictos mineros" },
    "16004": { color: "rgb(178, 178, 178)", label: "Conflictos por obras civiles" },
    "16005": { color: "rgb(255, 127, 127)", label: "Conflictos urbanos" },
    "16006": { color: "rgb(255, 235, 190)", label: "Sobreutilización ligera" },
    "16007": { color: "rgb(245, 162, 122)", label: "Sobreutilización moderada" },
    "16008": { color: "rgb(137, 112, 68)", label: "Sobreutilización severa" },
    "16009": { color: "rgb(211, 255, 190)", label: "Subutilización ligera" },
    "16010": { color: "rgb(180, 215, 158)", label: "Subutilización moderada" },
    "16011": { color: "rgb(168, 168, 0)", label: "Subutilización severa" },
    "16012": { color: "rgb(230, 230, 0)", label: "Usos inadecuados en zonas quemadas" }
};

// Diccionarios para Fenómenos Amenazantes
const coloresInundaciones = {
    "18001": { color: "rgb(254, 254, 204)", label: "Baja" },
    "18002": { color: "rgb(93, 186, 164)", label: "Media" },
    "18003": { color: "rgb(61, 100, 149)", label: "Alta" },
    "18004": { color: "rgb(39, 26, 44)", label: "Muy alta" }
};

const coloresRemocion = {
    "1701": { color: "rgb(255, 255, 208)", label: "Baja" },
    "1702": { color: "rgb(245, 245, 122)", label: "Media" },
    "1703": { color: "rgb(255, 127, 127)", label: "Alta" },
    "1704": { color: "rgb(225, 0, 0)", label: "Muy alta" }
};

const coloresDegradacion = {
    "19001": { color: "rgb(255, 190, 190)", label: "Ligera" },
    "19002": { color: "rgb(246, 167, 115)", label: "Moderada" },
    "19003": { color: "rgb(227, 98, 83)", label: "Severa" },
    "19004": { color: "rgb(180, 46, 94)", label: "Muy severa" },
    "19005": { color: "rgb(168, 112, 0)", label: "No suelo" },
    "19006": { color: "rgb(230, 255, 222)", label: "Sin evidencia" }
};

const coloresSismica = {
    "20001": { color: "rgb(137, 205, 102)", label: "Débil" },
    "20002": { color: "rgb(205, 205, 102)", label: "Ligero" },
    "20003": { color: "rgb(211, 255, 190)", label: "Moderado" },
    "20004": { color: "rgb(245, 245, 122)", label: "Fuerte" },
    "20005": { color: "rgb(255, 211, 127)", label: "Muy fuerte" },
    "20006": { color: "rgb(255, 127, 127)", label: "Severo" },
    "20007": { color: "rgb(255, 83, 72)", label: "Violento" }
};

window.coloresHipsometricos = coloresHipsometricos;
