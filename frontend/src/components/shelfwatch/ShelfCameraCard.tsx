import React from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import { useApp } from '../../store/appStore';

export const ShelfCameraCard: React.FC = () => {
  const { shelfWatch, setCurrentTab } = useApp();
  const analysis = shelfWatch.latestAnalysis;
  return <div className="flex flex-col h-full gap-3">
    <h3 className="text-base font-bold">Latest Shelf Image</h3>
    <p className="text-xs text-[#68756D]">{shelfWatch.lastUpdated}</p>
    <button onClick={() => setCurrentTab('shelfwatch')} className="w-full h-36 bg-[#EDEFEA] rounded-lg overflow-hidden" aria-label="Open ShelfWatch">
      {analysis?.annotated_image ? <img src={`data:image/jpeg;base64,${analysis.annotated_image}`} alt="Latest analyzed shelf" className="h-full w-full object-contain" />
        : <span className="flex items-center justify-center gap-2 text-sm"><Camera size={20} /> No image analyzed</span>}
    </button>
    {analysis && <p className="text-xs">{analysis.product_count} facings detected - {(analysis.average_confidence * 100).toFixed(1)}% average confidence</p>}
    <button onClick={() => setCurrentTab('shelfwatch')} className="flex items-center justify-end gap-2 text-xs font-semibold mt-auto">View ShelfWatch <ArrowRight size={14} /></button>
  </div>;
};
