/**
 * Lectura estructurada del informe de recomendación ya persistido (`award_recommendations.report_text`).
 * Solo reordena el texto en secciones: no recalcula puntajes ni agrega información.
 */
export type ReportRow = {
  rank: number | null
  supplier: string
  technical: string
  economic: string
  final: string
  currency: string
  amount: string
  notes: string[]
}

export type ParsedReport = {
  title: string
  method: string[]
  disclaimer: string[]
  ranking: ReportRow[]
  recommendation: string[]
  notes: { label: string; text: string }[]
  other: string[]
}

const ROW = /^(?:(\d+)\.\s|Excluido\.\s)(.+?): técnico (.+?), económico (.+?), (final .+?|sin puntaje final), ([A-Z]{3}) (-?\d+(?:[.,]\d+)*)(.*)$/

export function parseRecommendationReport(text: string | null | undefined): ParsedReport | null {
  if (!text) return null
  const lines = text.split('\n').map(line => line.trimEnd())
  const first = lines.find(line => line.trim())
  if (!first || !first.startsWith('Informe de evaluación')) return null

  const report: ParsedReport = { title: '', method: [], disclaimer: [], ranking: [], recommendation: [], notes: [], other: [] }
  let lastNote: { label: string; text: string } | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('Informe de evaluación')) {
      report.title = line.replace(/^Informe de evaluación\.?\s*/, '').trim()
      lastNote = null
      continue
    }
    if (line.startsWith('Modelo:') || line.startsWith('El puntaje económico')) {
      report.method.push(line)
      lastNote = null
      continue
    }
    if (line.startsWith('Esta recomendación no adjudica')) {
      report.disclaimer.push(line)
      lastNote = null
      continue
    }
    const row = ROW.exec(line)
    if (row) {
      report.ranking.push({
        rank: row[1] ? Number(row[1]) : null,
        supplier: row[2],
        technical: row[3],
        economic: row[4],
        final: row[5].replace(/^final\s+/, ''),
        currency: row[6],
        amount: row[7],
        notes: row[8].replace(/^\.\s*/, '').split(/\.\s+/).map(note => note.replace(/\.$/, '').trim()).filter(Boolean),
      })
      lastNote = null
      continue
    }
    if (line.startsWith('Se recomienda a') || line.startsWith('No es la oferta de menor precio') || line.startsWith('La oferta recomendada')) {
      report.recommendation.push(line)
      lastNote = null
      continue
    }
    const note = /^(Nota técnica|Nota económica):\s*(.*)$/.exec(line)
    if (note) {
      lastNote = { label: note[1], text: note[2] }
      report.notes.push(lastNote)
      continue
    }
    if (lastNote) {
      lastNote.text += `\n${line}`
      continue
    }
    report.other.push(line)
  }
  return report
}
