import { mkdir, writeFile } from 'node:fs/promises'
import { generateSynthetic, SAMPLE_METADATA } from '../src/data/synthetic'
import { serializeDatasets } from '../src/data/sampleLoader'
import { FILE_NAMES, type DatasetName } from '../src/data/schemas'
const directory = new URL('../public/sample-data/', import.meta.url)
await mkdir(directory, { recursive: true })
const files = serializeDatasets(generateSynthetic(SAMPLE_METADATA.seed))
for (const name of Object.keys(files) as DatasetName[]) await writeFile(new URL(FILE_NAMES[name], directory), files[name]! + '\n')
await writeFile(new URL('sample-metadata.json', directory), JSON.stringify(SAMPLE_METADATA, null, 2) + '\n')
console.log('Generated five deterministic synthetic CSV files (seed 42).')
