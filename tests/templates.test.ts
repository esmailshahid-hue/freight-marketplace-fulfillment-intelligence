import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { expect, it } from 'vitest'
import { csvTemplates } from '../src/data/templates'
import { SCHEMAS } from '../src/data/schemas'
import { validateCsv } from '../src/data/validation'
import { inspectUpload, missingMappings } from '../src/ui/uploadState'

it('ships schema-matching templates with examples accepted by the existing upload mapper and validator', () => {
  const templates = csvTemplates()
  expect(templates).toHaveLength(5)
  for (const t of templates) {
    expect(readFileSync(new URL(`../public/templates/${t.filename}`, import.meta.url), 'utf8')).toBe(t.csv)
    const parsed = Papa.parse(t.csv, { header: true, skipEmptyLines: true })
    expect(parsed.meta.fields).toEqual(Object.keys(SCHEMAS[t.dataset]))
    expect(parsed.data).toHaveLength(1)
    expect(missingMappings(t.dataset, inspectUpload(t.dataset, t.filename, t.csv.length, t.csv))).toEqual([])
  }
  const files = Object.fromEntries(templates.map(t => [t.dataset, t.csv]))
  const result = validateCsv(files, '2026-09-09T09:00:00+03:00')
  expect(result.errors).toEqual([])
  expect(result.data?.upcoming).toHaveLength(1)
  expect(result.data?.capacity[0].active).toBe(true)
  expect(result.data?.historical[0].cancelled).toBe(false)
  expect(result.data?.payments).toHaveLength(1)
  delete files.payments
  expect(validateCsv(files, '2026-09-09T09:00:00+03:00').errors).toEqual([])
})
