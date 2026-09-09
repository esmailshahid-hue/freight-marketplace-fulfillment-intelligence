export function Badge({ value }: { value: string }) {
  const tone = ['Critical', 'High', 'At Risk', 'Excluded'].includes(value) ? 'danger'
    : ['Watch', 'Medium', 'Requires attention'].includes(value) ? 'caution' : ['Healthy', 'Qualified', 'Ready for review', 'Passed'].includes(value) ? 'good' : 'neutral'
  return <span className={`badge ${tone}`}>{value}</span>
}
