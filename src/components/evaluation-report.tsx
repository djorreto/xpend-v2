import { parseRecommendationReport } from '@/lib/evaluation-report'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[13px] font-medium uppercase tracking-[0.08em] text-petrol-blue">{title}</h4>
      {children}
    </section>
  )
}

/** Presenta el informe persistido con secciones y párrafos legibles. Si el formato no se reconoce, muestra el texto tal cual. */
export function EvaluationReport({ text }: { text: string }) {
  const report = parseRecommendationReport(text)
  if (!report) return <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-petrol-blue">{text}</pre>

  return (
    <article className="space-y-4 text-[13.5px] leading-relaxed text-petrol-blue" aria-label="Informe de evaluación">
      <header>
        <h3 className="text-[15px] font-medium text-petrol-blue">Informe de evaluación</h3>
        {report.title && <p className="text-[13px] text-petrol-blue/75">{report.title}</p>}
      </header>

      {report.disclaimer.length > 0 && (
        <p className="rounded-lg border border-petrol-blue/15 bg-accent-mint/20 px-3 py-2 text-[13px] font-medium">
          {report.disclaimer.join(' ')} La adjudicación la decide el comité.
        </p>
      )}

      {report.method.length > 0 && (
        <Section title="Cómo se calculó">
          {report.method.map(line => <p key={line}>{line}</p>)}
        </Section>
      )}

      {report.ranking.length > 0 && (
        <Section title="Ranking de ofertas">
          <div className="overflow-x-auto rounded-lg border border-petrol-blue/10">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="bg-petrol-blue/[0.05] text-[12px] uppercase tracking-wide text-petrol-blue/75">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Puesto</th>
                  <th scope="col" className="px-3 py-2 font-medium">Proveedor</th>
                  <th scope="col" className="px-3 py-2 font-medium">Técnico</th>
                  <th scope="col" className="px-3 py-2 font-medium">Económico</th>
                  <th scope="col" className="px-3 py-2 font-medium">Final</th>
                  <th scope="col" className="px-3 py-2 font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petrol-blue/[0.06]">
                {report.ranking.map(row => (
                  <tr key={`${row.rank}-${row.supplier}`} className={row.rank ? '' : 'bg-red-50/50'}>
                    <td className="px-3 py-2 align-top font-medium">{row.rank ?? 'Excluido'}</td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-medium">{row.supplier}</span>
                      {row.notes.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[12.5px] text-petrol-blue/80">
                          {row.notes.map(note => <li key={note}>{note}</li>)}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">{row.technical}</td>
                    <td className="px-3 py-2 align-top">{row.economic}</td>
                    <td className="px-3 py-2 align-top font-medium">{row.final}</td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">{row.currency} {row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {report.recommendation.length > 0 && (
        <Section title="Recomendación">
          {report.recommendation.map(line => <p key={line}>{line}</p>)}
        </Section>
      )}

      {report.notes.length > 0 && (
        <Section title="Fundamentos">
          {report.notes.map(note => (
            <div key={note.label}>
              <p className="text-[12.5px] font-medium text-petrol-blue/80">{note.label}</p>
              <p className="whitespace-pre-line">{note.text}</p>
            </div>
          ))}
        </Section>
      )}

      {report.other.length > 0 && (
        <Section title="Otras observaciones">
          {report.other.map(line => <p key={line}>{line}</p>)}
        </Section>
      )}
    </article>
  )
}
