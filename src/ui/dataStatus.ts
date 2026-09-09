import type { DataIssue } from '../data/validation'

const ADDITIVE_CAPACITY_MESSAGE = 'Possible duplicated capacity blocks — confirm these rows are additive.'
export function dataStatusIssues(issues: DataIssue[], source: 'sample' | 'upload') {
  const notes = source === 'sample' ? issues.filter(issue => issue.dataset === 'capacity' && issue.message === ADDITIVE_CAPACITY_MESSAGE) : []
  return { notes, warnings: issues.filter(issue => !notes.includes(issue)) }
}


export const isTemporalWarning = (issue: DataIssue) => (issue.dataset === 'upcoming' && issue.message.startsWith('Past Due:'))
  || (['historical', 'offers'].includes(issue.dataset) && issue.message.startsWith('Future historical row excluded:'))
export function warningGroups(issues: DataIssue[]) {
  return { temporal: issues.filter(isTemporalWarning), warnings: issues.filter(issue => !isTemporalWarning(issue)) }
}
