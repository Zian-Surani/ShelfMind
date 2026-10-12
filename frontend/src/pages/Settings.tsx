import React, { useState } from 'react';
import {
  Shield,
  Sliders,
  Store,
  Check,
} from 'lucide-react';
import { useApp } from '../store/appStore';

export const Settings: React.FC = () => {
  const { settings, updateSettings, saveSettings, setMascotMood } = useApp();
  const [savedToast, setSavedToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await saveSettings();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Settings could not be saved.');
      return;
    }
    setSavedToast(true);
    setMascotMood('success');
    setTimeout(() => {
      setSavedToast(false);
      setMascotMood('calm');
    }, 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#19211D] tracking-tight">
            Store & Autonomy Settings
          </h1>
          <p className="text-xs font-medium text-[#68756D] mt-0.5">
            Configure ShelfMind decision autonomy, execution guardrails, and store parameters.
          </p>
        </div>

        {savedToast && (
          <span className="px-3.5 py-1.5 rounded-full bg-[#EAF5EC] text-[#267343] text-xs font-bold flex items-center gap-1.5 border border-[#D5EED8] animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            Preferences Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
        {/* Section 1: Autonomy Mode */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EAE6DD]">
            <Shield className="w-5 h-5 text-[#375B42]" />
            <h3 className="text-base font-bold text-[#19211D]">
              Decision Autonomy Engine Mode
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'RECOMMEND_ONLY',
                title: 'Recommend Only',
                desc: 'All decisions generate alerts; manual approval always required.',
              },
              {
                id: 'HUMAN_APPROVAL',
                title: 'Human Supervised',
                desc: 'Image recommendations require manager approval.',
              },
              {
                id: 'AUTO_UNDER_THRESHOLD',
                title: 'Auto Under Threshold',
                desc: 'Auto-approve reviewed counts when quality, freshness and budget checks pass. No supplier dispatch.',
              },
            ].map((mode) => {
              const isSelected = settings.autonomyMode === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => updateSettings({ autonomyMode: mode.id as any })}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#E3EBDD] border-[#375B42] shadow-2xs'
                      : 'bg-[#FAF8F5] border-[#EAE6DD] hover:bg-[#F3EFE6]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-[#19211D]">{mode.title}</span>
                    <input
                      type="radio"
                      name="autonomyMode"
                      checked={isSelected}
                      onChange={() => {}}
                      className="text-[#375B42] focus:ring-0"
                    />
                  </div>
                  <p className="text-xs text-[#68756D] leading-relaxed mt-1">
                    {mode.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Safety Thresholds */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EAE6DD]">
            <Sliders className="w-5 h-5 text-[#375B42]" />
            <h3 className="text-base font-bold text-[#19211D]">
              Safety Ceilings & Service Targets
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Max Auto Quantity */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-[#4A554E]">Maximum Automatic Order Quantity</span>
                <span className="text-[#375B42] text-sm">{settings.maxAutoQuantity} units</span>
              </div>
              <p className="text-[11px] text-[#78887E]">
                Orders above this count automatically escalate for store manager sign-off.
              </p>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.maxAutoQuantity}
                onChange={(e) => updateSettings({ maxAutoQuantity: parseInt(e.target.value) })}
                className="w-full accent-[#375B42]"
              />
            </div>

            {/* Max Auto Spend */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-[#4A554E]">Maximum Spend Threshold</span>
                <span className="text-[#375B42] text-sm">${settings.maxAutoSpend}</span>
              </div>
              <p className="text-[11px] text-[#78887E]">
                Single purchase requisition spend cap for autonomous EDI dispatch.
              </p>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={settings.maxAutoSpend}
                onChange={(e) => updateSettings({ maxAutoSpend: parseInt(e.target.value) })}
                className="w-full accent-[#375B42]"
              />
            </div>

            {/* Service Level Target */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-[#4A554E]">Target Service Level (In-Stock Probability)</span>
                <span className="text-[#375B42] text-sm">{settings.serviceLevelTarget}%</span>
              </div>
              <p className="text-[11px] text-[#78887E]">
                MDP Bellman penalty curve weights stockouts against holding costs to hit this objective.
              </p>
              <input
                type="range"
                min="90"
                max="99"
                value={settings.serviceLevelTarget}
                onChange={(e) => updateSettings({ serviceLevelTarget: parseInt(e.target.value) })}
                className="w-full accent-[#375B42]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Store & Agent Preferences */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EAE6DD]">
            <Store className="w-5 h-5 text-[#375B42]" />
            <h3 className="text-base font-bold text-[#19211D]">
              Store & Operations Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#4A554E] mb-1">Store Name</label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => updateSettings({ storeName: e.target.value })}
                className="w-full bg-[#FAF8F5] border border-[#DCD6C9] rounded-2xl px-3.5 py-2 text-[#19211D] font-medium focus:outline-none focus:border-[#375B42]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#4A554E] mb-1">Store Manager Name</label>
              <input
                type="text"
                value={settings.managerName}
                onChange={(e) => updateSettings({ managerName: e.target.value })}
                className="w-full bg-[#FAF8F5] border border-[#DCD6C9] rounded-2xl px-3.5 py-2 text-[#19211D] font-medium focus:outline-none focus:border-[#375B42]"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-8 py-3 rounded-full bg-[#375B42] text-white text-xs font-bold shadow-md hover:bg-[#2C4935] active:scale-95 transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
