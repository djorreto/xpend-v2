// PDF de texto mínimo (Helvetica, WinAnsi) para los documentos ficticios de la demostración. Sin dependencias.

const PAGE_LINES = 46
const WIDTH = 92

function wrap(text) {
  const out = []
  for (const paragraph of String(text).split('\n')) {
    if (!paragraph.trim()) { out.push(''); continue }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > WIDTH) { out.push(line); line = word }
      else line = (line + ' ' + word).trim()
    }
    out.push(line)
  }
  return out
}

const escape = (value) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

export function textPdf(title, body) {
  const header = ['DOCUMENTO FICTICIO DE DEMOSTRACIÓN · XPEND Company S.A. (DEMO)', '']
  const lines = [...header, ...wrap(body)]
  const pages = []
  for (let index = 0; index < lines.length; index += PAGE_LINES) pages.push(lines.slice(index, index + PAGE_LINES))
  const objects = []
  const add = (content) => { objects.push(content); return objects.length }
  const catalog = add(null)
  const pagesObj = add(null)
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const kids = []
  pages.forEach((page, pageIndex) => {
    const ops = ['BT', '/F2 14 Tf', '56 790 Td', `(${escape(title)}) Tj`, '/F1 10 Tf', '0 -24 Td', '14 TL']
    for (const line of page) ops.push(`(${escape(line)}) '`)
    ops.push('ET', 'BT', '/F1 8 Tf', '56 30 Td', `(${escape(`${title} · página ${pageIndex + 1} de ${pages.length}`)}) Tj`, 'ET')
    const stream = Buffer.from(ops.join('\n'), 'latin1')
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`)
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`))
  })
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(id => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`
  let out = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${index + 1} 0 obj\n${content}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
