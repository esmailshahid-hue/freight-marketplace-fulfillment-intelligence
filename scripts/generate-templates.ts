import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile, copyFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { csvTemplates } from '../src/data/templates'

// Maintainer-only generation uses the system zip utility; serving needs no library.
const directory = new URL('../public/templates/', import.meta.url)
const staging = await mkdtemp(join(tmpdir(), 'freight-csv-templates-'))
await mkdir(directory, { recursive: true })
const templates = csvTemplates()
for (const { filename, csv } of templates) {
  await writeFile(join(staging, filename), csv)
  await utimes(join(staging, filename), new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))
  await writeFile(new URL(filename, directory), csv)
}
execFileSync('zip', ['-X', '-q', 'csv-templates.zip', ...templates.map(t => t.filename)], { cwd: staging, env: { ...process.env, TZ: 'UTC' } })
await copyFile(join(staging, 'csv-templates.zip'), new URL('csv-templates.zip', directory))
console.log('Generated five schema-based CSV templates and public/templates/csv-templates.zip.')
