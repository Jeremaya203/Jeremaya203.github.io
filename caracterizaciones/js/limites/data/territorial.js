const GEOVISOR_URL = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";

export async function cargarDiccionarioDesdeApi() {
    try {
        const res = await fetch(GEOVISOR_URL);
        const json = await res.json();
        if (!json?.UNIDAD) return null;

        const munis = json.UNIDAD.filter(u => u.type === "MUNI");
        const deptos = json.UNIDAD.filter(u => u.type === "DEPTO");

        const diccionarioMunicipios = {};
        munis.forEach(m => { diccionarioMunicipios[m.id] = m.text; });

        const diccionarioDepartamentos = {};
        deptos.forEach(d => {
            if (d.id === "00") diccionarioDepartamentos[d.id] = "Área en litigio";
            else if (d.id === "88") diccionarioDepartamentos[d.id] = "San Andrés, Providencia y Santa Catalina";
            else diccionarioDepartamentos[d.id] = d.text;
        });

        const todosMunicipios = munis.map(m => ({
            codigo: m.id,
            nombre: m.text,
            depto: m.id.substring(0, 2)
        }));

        return { diccionarioMunicipios, diccionarioDepartamentos, todosMunicipios };
    } catch (e) {
        console.error("Error cargando diccionario desde Geovisor:", e);
        return null;
    }
}
