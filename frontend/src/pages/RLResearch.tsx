import React, { useEffect, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { shelfmindApi } from '../lib/shelfmindApi';
import { RLExperiment } from '../types';

export const RLResearch: React.FC = () => {
  const [algorithm, setAlgorithm] = useState('VALUE_ITERATION');
  const [iterations, setIterations] = useState(100);
  const [episodes, setEpisodes] = useState(120);
  const [seed, setSeed] = useState(42);
  const [experiments, setExperiments] = useState<RLExperiment[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { shelfmindApi.rlExperiments().then(setExperiments).catch(err => setError(err.message)); }, []);
  const current = experiments.find(item => item.algorithm === algorithm);
  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const result = algorithm === 'VALUE_ITERATION' ? await shelfmindApi.runValueIteration(iterations, seed)
        : algorithm === 'Q_LEARNING' ? await shelfmindApi.runQLearning(episodes, seed) : await shelfmindApi.runDqn(episodes, seed);
      setExperiments(previous => [result, ...previous]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Experiment failed'); }
    finally { setRunning(false); }
  };
  return <div className="space-y-6">
    <h1 className="text-2xl font-extrabold">RL Research</h1>
    <p className="text-sm text-[#68756D]">Model experiments using imported product parameters. Results are simulated, not observed business outcomes.</p>
    <form onSubmit={run} className="flex flex-wrap items-end gap-4 border-y py-5">
      <label className="text-xs font-semibold space-y-2">Algorithm
        <select value={algorithm} onChange={e => setAlgorithm(e.target.value)} className="block p-2 border rounded-md bg-white">
          <option value="VALUE_ITERATION">Value Iteration</option><option value="Q_LEARNING">Q-learning</option><option value="DQN">DQN</option>
        </select>
      </label>
      <label className="text-xs font-semibold space-y-2">{algorithm === 'VALUE_ITERATION' ? 'Maximum iterations' : 'Training episodes'}
        <input type="number" min={1} max={algorithm === 'DQN' ? 120 : 1000} required value={algorithm === 'VALUE_ITERATION' ? iterations : episodes}
          onChange={e => algorithm === 'VALUE_ITERATION' ? setIterations(Number(e.target.value)) : setEpisodes(Number(e.target.value))}
          className="block w-36 p-2 border rounded-md bg-white" />
      </label>
      <label className="text-xs font-semibold space-y-2">Random seed
        <input type="number" min={0} max={2147483647} required value={seed} onChange={e => setSeed(Number(e.target.value))} className="block w-36 p-2 border rounded-md bg-white" />
      </label>
      <button disabled={running} className="flex items-center gap-2 rounded-md bg-[#375B42] text-white px-4 py-2 text-sm disabled:opacity-50">
        {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}{running ? 'Running...' : 'Run experiment'}
      </button>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {current ? <>
      <p className="text-sm">{current.iterations} iterations | {current.runtimeMs} ms | {current.converged ? 'Converged' : 'Not converged'} | {current.numberOfStates} states</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Object.entries(current.metrics).map(([key, value]) =>
        <div key={key} className="p-4 border rounded-lg bg-white"><p className="text-xs text-[#68756D] break-words">{key.replace(/_/g, ' ')}</p><p className="font-bold text-xl mt-2">{value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p></div>)}</div>
    </> : <p className="text-sm text-[#68756D]">No saved experiment for this algorithm.</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b">
      {['Algorithm', 'Seed', 'Iterations', 'Runtime', 'Status'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
      <tbody>{experiments.map(experiment => <tr key={experiment.id} className="border-b">
        <td className="p-3">{experiment.algorithm.replace(/_/g, ' ')}</td><td className="p-3">{experiment.seed}</td><td className="p-3">{experiment.iterations}</td>
        <td className="p-3">{experiment.runtimeMs} ms</td><td className="p-3">{experiment.status}</td>
      </tr>)}</tbody></table></div>
  </div>;
};
