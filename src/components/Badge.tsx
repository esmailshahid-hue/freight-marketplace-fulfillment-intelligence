export function Badge({ value }: { value: string }) {
  const tone = ['Critical', 'Blocking error', 'High', 'At Risk', 'Excluded'].includes(value) ? 'danger'
    : ['Below commercial floor', 'Watch', 'Mapping required', 'Medium', 'Requires attention'].includes(value) ? 'caution' : ['Healthy', 'Validation passed', 'Uploaded · Ready', 'Qualified', 'Ready for review', 'Passed'].includes(value) ? 'good' : 'neutral'
  return <span className={`badge ${tone}`}>{value}</span>
}
