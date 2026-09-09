export function Badge({ value }: { value: string }) {
  const tone = ['Critical', 'High', 'At Risk', 'Excluded'].includes(value) ? 'danger'
    : ['Watch', 'Medium'].includes(value) ? 'caution' : ['Healthy', 'Qualified'].includes(value) ? 'good' : 'neutral'
  return <span className={`badge ${tone}`}>{value}</span>
}
