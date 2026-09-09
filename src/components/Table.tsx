import type { ReactNode } from 'react'
export interface Column<T> { title: string; render: (row: T) => ReactNode; numeric?: boolean }
export function Table<T>({ caption, columns, rows, rowKey, onSelect, empty = 'No rows to display.' }: {
  caption: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; onSelect?: (row: T) => void; empty?: string;
}) {
  return <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
    <table>
      <caption className="sr-only">{caption}</caption>
      <thead><tr>{columns.map(c => <th key={c.title} scope="col" className={c.numeric ? 'numeric' : undefined}>{c.title}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={rowKey(row)} className={onSelect ? 'selectable' : undefined} onClick={onSelect ? () => onSelect(row) : undefined}>
        {columns.map(c => <td key={c.title} className={c.numeric ? 'numeric' : undefined}>{c.render(row)}</td>)}
      </tr>)}</tbody>
    </table>
    {!rows.length && <p className="empty">{empty}</p>}
  </div>
}
