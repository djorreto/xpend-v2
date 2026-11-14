const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/

function assertCompanyId(companyId: string) {
  if (!UUID.test(companyId)) {
    throw new Error('La empresa no tiene un identificador válido para almacenar documentos.')
  }
}

function assertSegment(value: string, label: string) {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`${label} no es válido para almacenar documentos.`)
  }
}

function extension(fileName: string) {
  const match = fileName.toLowerCase().match(/(\.[a-z0-9]{1,10})$/)
  return match?.[1] || ''
}

export function licitacionDocumentPath(
  companyId: string,
  licitacionId: string,
  fileName: string,
  timestamp = Date.now()
) {
  assertCompanyId(companyId)
  assertSegment(licitacionId, 'El ID de la licitación')
  return `${companyId}/licitaciones/${licitacionId}/${timestamp}-bases${extension(fileName)}`
}

export function offerFilePath(
  companyId: string,
  eventId: string,
  supplierId: string,
  fileName: string,
  timestamp = Date.now()
) {
  assertCompanyId(companyId)
  assertSegment(eventId, 'La sala')
  assertSegment(supplierId, 'El proveedor')
  return `${companyId}/ofertas/${eventId}/${supplierId}/${timestamp}-anexo${extension(fileName)}`
}

export function supplierNdaPath(
  companyId: string,
  supplierId: string,
  fileName: string,
  timestamp = Date.now()
) {
  assertCompanyId(companyId)
  assertSegment(supplierId, 'El ID del proveedor')
  return `${companyId}/${supplierId}/${timestamp}-nda${extension(fileName)}`
}
