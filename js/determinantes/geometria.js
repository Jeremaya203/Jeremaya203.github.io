// Bbox [[minLng,minLat],[maxLng,maxLat]] de un FeatureCollection
export function boundsDeGeoJSON(fc) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90, found = false;
  const scan = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]; if (c[1] < minY) minY = c[1];
      if (c[0] > maxX) maxX = c[0]; if (c[1] > maxY) maxY = c[1]; found = true;
    } else c.forEach(scan);
  };
  (fc.features || []).forEach(f => { if (f.geometry && f.geometry.coordinates) scan(f.geometry.coordinates); });
  return found ? [[minX, minY], [maxX, maxY]] : null;
}

function bboxGeoJSON(gj) {
  if (!gj) return null;
  let coords = [];
  function extraer(obj) {
    if (!obj) return;
    if (obj.type === 'FeatureCollection') obj.features.forEach(f => extraer(f));
    else if (obj.type === 'Feature') extraer(obj.geometry);
    else if (obj.type === 'Polygon') obj.coordinates.forEach(r => r.forEach(c => coords.push(c)));
    else if (obj.type === 'MultiPolygon') obj.coordinates.forEach(p => p.forEach(r => r.forEach(c => coords.push(c))));
  }
  extraer(gj);
  if (!coords.length) return null;
  let lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export function centroideGeoJSON(gj) {
  const bb = bboxGeoJSON(gj);
  if (!bb) return null;
  return [(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2];
}
