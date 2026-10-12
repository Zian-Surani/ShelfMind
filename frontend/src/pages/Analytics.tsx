import React, { useEffect, useState } from 'react';
import { Upload, RefreshCw } from 'lucide-react';
import { shelfmindApi } from '../lib/shelfmindApi';
import { HistoryAnalytics } from '../types';
import { useApp } from '../store/appStore';

const currency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export const Analytics: React.FC = () => {
  const { refreshBackendState } = useApp();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<HistoryAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [provenance, setProvenance] = useState<'simulated' | 'operational'>('simulated');
  const [importResult, setImportResult] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    shelfmindApi.analytics(days).then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, revision]);

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const input = event.target;
    setImporting(true);
    setError(null);
    setImportResult('');
    try {
      const result = await shelfmindApi.importHistory(file, provenance);
      setImportResult(`${result.inserted} records imported; ${result.skipped} unchanged. Latest date: ${result.lastDate}.`);
      await refreshBackendState();
      setRevision(value => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
      input.value = '';
    }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-extrabold">Retail History & Analytics</h1>
      <div className="flex gap-1" role="group" aria-label="History period">
        {[7, 30, 90, 365].map(value => <button key={value} onClick={() => setDays(value)} aria-pressed={days === value}
          className={`px-3 py-2 text-xs rounded-md border ${days === value ? 'bg-[#375B42] text-white' : 'bg-white'}`}>{value} days</button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 border-y border-[#EAE5DA] py-4">
      <label className="text-xs font-semibold" htmlFor="history-provenance">CSV source</label>
      <select id="history-provenance" value={provenance} onChange={event => setProvenance(event.target.value as typeof provenance)} className="border rounded-md bg-white p-2 text-sm">
        <option value="simulated">Simulated history</option><option value="operational">Actual retail operations</option>
      </select>
      <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#375B42] text-white text-sm cursor-pointer ${importing ? 'opacity-50' : ''}`}>
        {importing ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
        {importing ? 'Importing...' : 'Import CSV'}
        <input type="file" accept=".csv,text/csv" aria-label="Import retail history CSV" disabled={importing} onChange={importCsv} className="sr-only" />
      </label>
      {importResult && <p className="text-xs" role="status">{importResult}</p>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700 break-words">{error}</p>}
    {loading && <p role="status" className="text-sm">Loading history...</p>}
    {!loading && !error && data && <>
      <p className="text-sm text-[#68756D]">{data.dataSource.generated ? 'Simulated history' : 'Imported retail history'}: {data.period.firstDate || 'No records'} to {data.period.lastDate || 'No records'}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Units sold', data.totals.unitsSold.toLocaleString()], ['Sales revenue', currency(data.totals.revenue)],
          ['Lost-sale units', data.totals.lostSales.toLocaleString()],
          ['Service level', data.totals.serviceLevel === null ? 'Unavailable' : `${data.totals.serviceLevel}%`],
        ].map(([label, value]) => <div key={label} className="border rounded-lg bg-white p-4 min-w-0">
          <p className="text-xs text-[#68756D]">{label}</p><p className="text-xl font-bold mt-2 break-words">{value}</p>
        </div>)}
      </div>
      <div className="flex flex-wrap gap-6 border-y py-4 text-sm">
        <span>Cost of goods sold: <strong>{currency(data.totals.costOfGoods)}</strong></span>
        <span>Gross margin: <strong>{currency(data.totals.grossMargin)}</strong></span>
        <span>Waste: <strong>{data.totals.wasteUnits} units</strong></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead><tr className="border-b text-[#68756D]">{['Product', 'Demand', 'Sold', 'Lost sales', 'Waste', 'Revenue'].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
          <tbody>{data.byProduct.map(row => <tr key={row.productId} className="border-b">
            <td className="p-3 font-semibold">{row.name}</td><td className="p-3">{row.demand}</td><td className="p-3">{row.unitsSold}</td>
            <td className="p-3">{row.lostSales}</td><td className="p-3">{row.wasteUnits}</td><td className="p-3 whitespace-nowrap">{currency(row.revenue)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </div>;
};
