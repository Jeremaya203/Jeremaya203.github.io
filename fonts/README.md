# Fuentes institucionales OOT

Esta carpeta debe contener los archivos de fuente copiados desde Colombia OT.

## Archivos requeridos

Copiar desde `observatorioordenamientoterritorial.igac.gov.co/fonts/`:

### Gill Sans Std (fuente principal)
- `GillSansStd.woff2`
- `GillSansStd.woff`
- `GillSansStd-Bold.woff2`
- `GillSansStd-Bold.woff`
- `GillSansStd-Light.woff2`
- `GillSansStd-Light.woff`

### Geometria (hero / display)
- `Geometria-Bold.ttf`

### Tajawal (navbar y footer)
- `Tajawal-Regular.ttf`
- `Tajawal-Bold.ttf`

## Notas

- Los @font-face están declarados en `../oot-base.css` (sección 1).
- Si las fuentes no están disponibles, los navegadores usarán `'Public Sans'` (fallback en :root).
- No subir las fuentes Gill Sans Std a repositorios públicos (licencia comercial).
