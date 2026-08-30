'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseGeoJSONText, parseKml, polygonAreaHa, ringToGeoJSON, type LatLng } from '@/lib/geo'

export type MapField = {
  id: string
  name: string
  area_ha: number | null
  color?: string | null
  geojson: unknown
}

const MAP_HEIGHT = 560

function ensureLeafletCss() {
  if (typeof document === 'undefined') return
  if (document.getElementById('leaflet-css')) return
  const l = document.createElement('link')
  l.id = 'leaflet-css'
  l.rel = 'stylesheet'
  l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(l)
}

function asGeoJSON(geo: unknown) {
  if (!geo) return null
  const g = geo as { type?: string; geometry?: { type?: string } }
  if (g.type === 'Feature' || g.type === 'FeatureCollection') return geo
  if (g.type === 'Polygon' || g.type === 'MultiPolygon' || g.type === 'Point') {
    return { type: 'Feature', properties: {}, geometry: g }
  }
  return geo
}

export function FarmMap({
  fields,
  farmId,
  onSaved,
  selectable,
  selectedIds,
  onToggleSelect,
}: {
  fields: MapField[]
  farmId: string | null
  onSaved?: () => void
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}) {
  const el = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const groupRef = useRef<import('leaflet').FeatureGroup | null>(null)
  const draftRef = useRef<LatLng[]>([])
  const draftLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const modeRef = useRef<'view' | 'draw'>('view')
  const selectRef = useRef(onToggleSelect)
  const selectedRef = useRef(selectedIds)
  const [mode, setMode] = useState<'view' | 'draw'>('view')
  const [draftCount, setDraftCount] = useState(0)
  const [sat, setSat] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Loading map…')

  selectRef.current = onToggleSelect
  selectedRef.current = selectedIds
  modeRef.current = mode

  useEffect(() => {
    ensureLeafletCss()
    const node = el.current
    if (!node) return
    let cancelled = false
    let map: import('leaflet').Map | null = null
    let ro: ResizeObserver | null = null
    const timers: number[] = []

    async function boot() {
      const mod = await import('leaflet')
      const L = (mod.default ?? mod) as typeof import('leaflet')
      if (cancelled || !el.current) return

      // React Strict Mode remounts: Leaflet throws if the div is already a map.
      const stale = el.current as HTMLDivElement & { _leaflet_id?: number }
      if (stale._leaflet_id) {
        try {
          mapRef.current?.remove()
        } catch {
          /* ignore */
        }
        stale._leaflet_id = undefined
        stale.innerHTML = ''
      }

      // Default marker images break under Next.js bundling.
      const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown }
      delete proto._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      map = L.map(el.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([53.42, -7.9], 8)

      mapRef.current = map
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      })
      const imagery = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
      )
      imagery.addTo(map)
      const group = L.featureGroup().addTo(map)
      groupRef.current = group
      const draft = L.layerGroup().addTo(map)
      draftLayerRef.current = draft
      Object.assign(map, { _osm: osm, _sat: imagery })

      map.on('click', (e) => {
        if (modeRef.current !== 'draw') return
        draftRef.current = [...draftRef.current, { lat: e.latlng.lat, lng: e.latlng.lng }]
        setDraftCount(draftRef.current.length)
        L.circleMarker(e.latlng, { radius: 6, color: '#facc15', fillOpacity: 1, weight: 2 }).addTo(draft)
        if (draftRef.current.length > 1) {
          const last = draftRef.current.slice(-2)
          L.polyline(
            last.map((p) => [p.lat, p.lng] as [number, number]),
            { color: '#facc15', weight: 3 }
          ).addTo(draft)
        }
      })

      const bump = () => {
        try {
          map?.invalidateSize({ animate: false })
        } catch {
          /* ignore */
        }
      }
      timers.push(window.setTimeout(bump, 50))
      timers.push(window.setTimeout(bump, 250))
      timers.push(window.setTimeout(bump, 800))
      timers.push(window.setTimeout(bump, 1600))

      ro = new ResizeObserver(bump)
      ro.observe(el.current)

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || !map) return
            if (group.getLayers().length) return
            map.setView([pos.coords.latitude, pos.coords.longitude], 16)
            bump()
          },
          () => {
            /* keep Ireland view */
          },
          { enableHighAccuracy: true, timeout: 8000 }
        )
      }

      setStatus('')
      setReady(true)
      bump()
    }

    boot().catch((err) => {
      setStatus(err instanceof Error ? err.message : 'Map failed to load')
    })

    const onResize = () => mapRef.current?.invalidateSize({ animate: false })
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      timers.forEach((t) => window.clearTimeout(t))
      ro?.disconnect()
      try {
        map?.remove()
      } catch {
        /* ignore */
      }
      mapRef.current = null
      groupRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current as
      | (import('leaflet').Map & { _osm?: import('leaflet').TileLayer; _sat?: import('leaflet').TileLayer })
      | null
    if (!map?._osm || !map._sat) return
    if (sat) {
      if (map.hasLayer(map._osm)) map.removeLayer(map._osm)
      if (!map.hasLayer(map._sat)) map.addLayer(map._sat)
    } else {
      if (map.hasLayer(map._sat)) map.removeLayer(map._sat)
      if (!map.hasLayer(map._osm)) map.addLayer(map._osm)
    }
    map.invalidateSize({ animate: false })
  }, [sat, ready])

  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group || !ready) return
    let cancelled = false
    ;(async () => {
      const mod = await import('leaflet')
      const L = (mod.default ?? mod) as typeof import('leaflet')
      if (cancelled) return
      group.clearLayers()
      for (const f of fields) {
        const gj = asGeoJSON(f.geojson)
        if (!gj) continue
        try {
          const selected = selectedRef.current?.has(f.id)
          const layer = L.geoJSON(gj as never, {
            style: {
              color: selected ? '#facc15' : '#14532d',
              weight: selected ? 4 : 2,
              fillColor: f.color || '#15803d',
              fillOpacity: selected ? 0.65 : 0.45,
            },
            pointToLayer: (_feat, latlng) =>
              L.circleMarker(latlng, {
                radius: 10,
                color: '#14532d',
                fillColor: f.color || '#15803d',
                fillOpacity: 0.9,
              }),
            onEachFeature: (_feat, lyr) => {
              lyr.bindTooltip(f.name, { sticky: true })
              lyr.on('click', (ev) => {
                L.DomEvent.stopPropagation(ev)
                if (selectRef.current) selectRef.current(f.id)
                else window.location.href = `/fields/${f.id}`
              })
            },
          })
          group.addLayer(layer)
        } catch {
          /* skip broken shape */
        }
      }
      if (group.getLayers().length) {
        try {
          map.fitBounds(group.getBounds().pad(0.18))
        } catch {
          /* empty */
        }
      }
      map.invalidateSize({ animate: false })
    })()
    return () => {
      cancelled = true
    }
  }, [fields, selectedIds, ready])

  async function saveRing(name: string, ring: LatLng[], color: string) {
    if (!farmId || ring.length < 3) return
    const geojson = ringToGeoJSON(ring)
    const area = polygonAreaHa(ring)
    const supabase = createClient()
    const { error } = await supabase.from('farm_fields').insert({
      farm_id: farmId,
      name,
      color,
      geojson,
      area_ha: area,
    })
    if (error) setMsg(error.message)
    else {
      setMsg('Saved ' + name)
      draftRef.current = []
      setDraftCount(0)
      draftLayerRef.current?.clearLayers()
      setMode('view')
      onSaved?.()
    }
  }

  async function closeDraw() {
    const ring = draftRef.current
    if (ring.length < 3) {
      setMsg('Tap at least 3 corners on the map')
      return
    }
    const name = window.prompt('Field name')
    if (!name) return
    const color = window.prompt('Colour hex (e.g. #15803d)', '#15803d') || '#15803d'
    await saveRing(name.trim(), ring, color)
  }

  async function onImport(file: File) {
    setMsg(null)
    try {
      const lower = file.name.toLowerCase()
      let items: { name: string; ring: LatLng[] }[] = []
      if (lower.endsWith('.kml')) {
        items = parseKml(await file.text())
      } else if (lower.endsWith('.json') || lower.endsWith('.geojson')) {
        items = parseGeoJSONText(await file.text())
      } else if (lower.endsWith('.zip') || lower.endsWith('.shp')) {
        const shp = (await import('shpjs')).default
        const buf = await file.arrayBuffer()
        const gj = await shp(buf)
        items = parseGeoJSONText(JSON.stringify(gj))
      } else {
        setMsg('Use KML, GeoJSON or a shapefile ZIP')
        return
      }
      if (!items.length) {
        setMsg('No polygons found in file')
        return
      }
      for (const it of items) {
        await saveRing(it.name, it.ring, '#15803d')
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSat((v) => !v)}
          className="min-h-[44px] rounded-xl border-2 border-slate-700 bg-white px-3 text-sm font-bold"
        >
          {sat ? 'Map view' : 'Satellite'}
        </button>
        {!selectable && (
          <button
            type="button"
            onClick={() => {
              draftRef.current = []
              setDraftCount(0)
              draftLayerRef.current?.clearLayers()
              setMode((m) => (m === 'draw' ? 'view' : 'draw'))
            }}
            className={`min-h-[44px] rounded-xl border-2 px-3 text-sm font-bold ${
              mode === 'draw' ? 'border-amber-700 bg-amber-200' : 'border-slate-700 bg-white'
            }`}
          >
            {mode === 'draw' ? 'Cancel draw' : 'Draw field'}
          </button>
        )}
        {mode === 'draw' && (
          <button
            type="button"
            onClick={closeDraw}
            className="min-h-[44px] rounded-xl bg-brand-700 px-3 text-sm font-bold text-white"
          >
            Close shape ({draftCount} pts)
          </button>
        )}
        {!selectable && (
          <label className="min-h-[44px] cursor-pointer rounded-xl border-2 border-slate-700 bg-white px-3 text-sm font-bold leading-[44px]">
            Import KML / ZIP
            <input
              type="file"
              accept=".kml,.geojson,.json,.zip,.shp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImport(f)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {selectable
          ? 'Tap a field on the map to add or remove it from the job.'
          : mode === 'draw'
            ? 'Tap the corners of the field on the satellite image, then Close shape.'
            : 'Satellite map of your fields. Allow location if asked so it zooms to the farm. Draw a new field or import a KML / shapefile.'}
      </p>
      {msg && <p className="font-semibold text-brand-800">{msg}</p>}
      <div className="relative w-full" style={{ height: MAP_HEIGHT, minHeight: MAP_HEIGHT }}>
        {status && (
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-2xl bg-slate-600/80 text-lg font-bold text-white">
            {status}
          </div>
        )}
        <div
          ref={el}
          style={{ height: MAP_HEIGHT, minHeight: MAP_HEIGHT, width: '100%', zIndex: 0 }}
          className="h-full w-full overflow-hidden rounded-2xl border-4 border-slate-700 bg-slate-500"
        />
      </div>
    </div>
  )
}
