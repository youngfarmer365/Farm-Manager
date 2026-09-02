export type PenRow = {
  id: string
  name: string
  type?: string | null
  parent_id?: string | null
  capacity?: number | null
  is_active?: boolean
}

export function isShed(p: PenRow) {
  return (p.type || '').toLowerCase() === 'shed'
}

export function isFieldPen(p: PenRow) {
  return (p.type || '').toLowerCase() === 'field'
}

export function isHousingPen(p: PenRow) {
  return !isShed(p) && !isFieldPen(p)
}

export function housingPens(pens: PenRow[]) {
  return pens.filter(isHousingPen)
}

export function penLabel(p: PenRow, all: PenRow[]) {
  const parent = p.parent_id ? all.find((x) => x.id === p.parent_id) : null
  return parent ? parent.name + ' · ' + p.name : p.name
}

export function groupPensByShed(pens: PenRow[]) {
  const sheds = pens.filter(isShed).sort((a, b) => a.name.localeCompare(b.name))
  const housing = housingPens(pens)
  const grouped = sheds.map((shed) => ({
    shed,
    pens: housing.filter((p) => p.parent_id === shed.id).sort((a, b) => a.name.localeCompare(b.name)),
  }))
  const ungrouped = housing
    .filter((p) => !p.parent_id || !sheds.some((s) => s.id === p.parent_id))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { grouped, ungrouped }
}
