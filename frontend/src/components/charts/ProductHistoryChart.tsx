import React from 'react';

interface Series { key: string; label: string; color: string }
interface Props {
  title: string;
  rows: { label: string; values: Record<string, number> }[];
  series: Series[];
}

export const ProductHistoryChart: React.FC<Props> = ({ title, rows, series }) => {
  const width = 560, height = 220;
  const max = Math.max(1, ...rows.flatMap(row => series.map(item => row.values[item.key] ?? 0)));
  const x = (index: number) => rows.length === 1 ? 300 : 42 + index / (rows.length - 1) * 492;
  const y = (value: number) => 180 - value / max * 150;
  const ticks = [...new Set([0, Math.round(max / 2), max])];
  return <section className="min-w-0" aria-label={title}>
    <h3 className="text-sm font-bold tracking-normal">{title}</h3>
    {rows.length ? <>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#526057]">
        {series.map(item => <span key={item.key} className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}
        </span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-52 w-full" role="img" aria-label={title}>
        {ticks.map(tick => <g key={tick}><line x1="42" x2="534" y1={y(tick)} y2={y(tick)} stroke="#E3E8E4" />
          <text x="34" y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#68756D">{tick}</text></g>)}
        {series.map(item => <g key={item.key}>
          <polyline points={rows.map((row, index) => `${x(index)},${y(row.values[item.key] ?? 0)}`).join(' ')} fill="none" stroke={item.color} strokeWidth="2" />
          {rows.map((row, index) => <circle key={index} cx={x(index)} cy={y(row.values[item.key] ?? 0)} r="3" fill={item.color} tabIndex={0}
            aria-label={`${row.label}: ${item.label} ${row.values[item.key] ?? 0}`}>
            <title>{row.label}: {item.label} {row.values[item.key] ?? 0}</title>
          </circle>)}
        </g>)}
        {[...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(index =>
          <text key={index} x={x(index)} y="207" textAnchor="middle" fontSize="10" fill="#68756D">{rows[index].label}</text>)}
      </svg>
      <details className="text-xs text-[#526057]">
        <summary className="cursor-pointer">Data table</summary>
        <div className="max-h-52 overflow-auto"><table className="w-full text-left">
          <thead><tr><th className="py-2">Date</th>{series.map(item => <th key={item.key}>{item.label}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className="border-t"><td className="py-1">{row.label}</td>
            {series.map(item => <td key={item.key}>{row.values[item.key] ?? 0}</td>)}</tr>)}</tbody>
        </table></div>
      </details>
    </> : <p className="flex h-52 items-center text-sm text-[#68756D]">No records for this item yet.</p>}
  </section>;
};
