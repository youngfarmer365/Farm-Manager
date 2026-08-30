export async function fetchWeather(lat: number, lng: number) {
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    lat +
    '&longitude=' +
    lng +
    '&current=temperature_2m,wind_speed_10m,precipitation,weather_code&wind_speed_unit=kmh'
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const c = data.current || {}
  return {
    at: c.time || new Date().toISOString(),
    temp_c: c.temperature_2m ?? null,
    wind_kmh: c.wind_speed_10m ?? null,
    rain_mm: c.precipitation ?? null,
    code: c.weather_code ?? null,
    summary: weatherSummary(c.weather_code, c.precipitation),
  }
}

function weatherSummary(code: number | null, rain: number | null) {
  if (rain && rain > 0.2) return 'Rain'
  if (code == null) return 'Recorded'
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Fog / mist'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code >= 95) return 'Thunder'
  return 'Mixed'
}

export function formatWeather(w: any) {
  if (!w) return '—'
  const bits = []
  if (w.summary) bits.push(w.summary)
  if (w.temp_c != null) bits.push(w.temp_c + '°C')
  if (w.wind_kmh != null) bits.push(w.wind_kmh + ' km/h wind')
  if (w.rain_mm != null) bits.push(w.rain_mm + ' mm rain')
  return bits.join(' · ') || '—'
}
