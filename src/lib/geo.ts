export type LatLng = { lat: number; lng: number }

export function polygonAreaHa(ring: LatLng[]): number {
  if (!ring || ring.length < 3) return 0
  const R = 6371000
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length
    const lat1 = (ring[i].lat * Math.PI) / 180
    const lat2 = (ring[j].lat * Math.PI) / 180
    const dLng = ((ring[j].lng - ring[i].lng) * Math.PI) / 180
    a += dLng * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  const m2 = Math.abs((a * R * R) / 2)
  return Math.round((m2 / 10000) * 10000) / 10000
}

export function ringToGeoJSON(ring: LatLng[]) {
  const coords = ring.map((p) => [p.lng, p.lat])
  if (coords.length) {
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first])
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}

export function geojsonToRing(geo: any): LatLng[] {
  if (!geo) return []
  let coords: any = geo
  if (geo.type === 'Feature') coords = geo.geometry
  if (coords?.type === 'Polygon') {
    return (coords.coordinates[0] || []).map((c: number[]) => ({
      lng: c[0],
      lat: c[1],
    }))
  }
  if (coords?.type === 'MultiPolygon') {
    const first = coords.coordinates[0]?.[0] || []
    return first.map((c: number[]) => ({ lng: c[0], lat: c[1] }))
  }
  if (coords?.type === 'FeatureCollection') {
    return geojsonToRing(coords.features?.[0])
  }
  return []
}

export function centroid(ring: LatLng[]): LatLng | null {
  if (!ring.length) return null
  const n = ring.length
  return {
    lat: ring.reduce((s, p) => s + p.lat, 0) / n,
    lng: ring.reduce((s, p) => s + p.lng, 0) / n,
  }
}

export function parseKml(text: string): { name: string; ring: LatLng[] }[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const placemarks = Array.from(doc.getElementsByTagName('Placemark'))
  const out: { name: string; ring: LatLng[] }[] = []
  for (const pm of placemarks) {
    const name = pm.getElementsByTagName('name')[0]?.textContent?.trim() || 'Imported field'
    const coordText =
      pm.getElementsByTagName('coordinates')[0]?.textContent?.trim() || ''
    const ring: LatLng[] = []
    for (const part of coordText.split(/\s+/)) {
      const bits = part.split(',')
      if (bits.length >= 2) {
        const lng = Number(bits[0])
        const lat = Number(bits[1])
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) ring.push({ lat, lng })
      }
    }
    if (ring.length >= 3) out.push({ name, ring })
  }
  return out
}

export function parseGeoJSONText(text: string): { name: string; ring: LatLng[] }[] {
  const json = JSON.parse(text)
  const features = json.type === 'FeatureCollection' ? json.features : [json]
  const out: { name: string; ring: LatLng[] }[] = []
  for (const f of features || []) {
    const ring = geojsonToRing(f)
    if (ring.length >= 3) {
      out.push({
        name: f.properties?.name || f.properties?.Name || 'Imported field',
        ring,
      })
    }
  }
  return out
}
