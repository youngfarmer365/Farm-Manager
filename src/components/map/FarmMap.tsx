'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Field = {
  id: string
  name: string
  area_ha: number | null
  color: string | null
  geojson: unknown
}

export function FarmMap({
  fields,
  farmId,
  onSaved,
}: {
  fields: Field[]
  farmId: string | null
  onSaved?: () => void
}) {
  const el = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!el.current) return
    let map: import('leaflet').Map | null = null
    let cancelled = false

    async function boot() {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !el.current) return

      map = L.map(el.current).setView([53.4, -7.9], 7)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      const layer = L.featureGroup().addTo(map)
      for (const f of fields) {
        if (!f.geojson) continue
        try {
          const gj = L.geoJSON(f.geojson as never, {
            style: {
              color: '#14532d',
              weight: 2,
              fillColor: f.color || '#15803d',
              fillOpacity: 0.45,
            },
            onEachFeature: (_feat, lyr) => {
              lyr.bindPopup(
                `<strong>${f.name}</strong><br/><a href="/fields/${f.id}">Open field</a>`
              )
            },
          })
          layer.addLayer(gj)
        } catch {
          /* skip bad geojson */
        }
      }
      if (layer.getLayers().length) {
        map.fitBounds(layer.getBounds().pad(0.15))
      }

      map.on('click', async (e) => {
        if (!farmId) return
        const name = window.prompt('Name for a new field at this point?')
        if (!name) return
        const color = window.prompt('Hex colour (e.g. #15803d for grass)', '#15803d') || '#15803d'
        const geojson = {
          type: 'Point',
          coordinates: [e.latlng.lng, e.latlng.lat],
        }
        const supabase = createClient()
        const { error } = await supabase.from('farm_fields').insert({
          farm_id: farmId,
          name: name.trim(),
          color,
          geojson,
        })
        if (error) window.alert(error.message)
        else onSaved?.()
      })
    }

    boot()
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [fields, farmId, onSaved])

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">
        Tap the map to drop a named field. Existing fields show in their crop colour.
      </p>
      <div ref={el} className="h-[420px] overflow-hidden rounded-2xl border-4 border-slate-700" />
    </div>
  )
}
