import React, { useState } from 'react';
import { X, Landmark, MapPin, IndianRupee, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

interface MPRecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecommended: () => void;
  mpName: string;
}

export const MPRecommendModal: React.FC<MPRecommendModalProps> = ({
  isOpen,
  onClose,
  onRecommended,
  mpName,
}) => {
  const [name, setName] = useState('Construction of High-Mast Solar Lighting & Public Walkway');
  const [description, setDescription] = useState(
    'Installation of 8 high-mast solar lighting poles, pedestrian walkway pavers, and community benches to improve public safety and night-time accessibility.'
  );
  const [location, setLocation] = useState('Assi Ghat to Ravidas Ghat Corridor, Varanasi');
  const [latitude, setLatitude] = useState<number>(25.2890);
  const [longitude, setLongitude] = useState<number>(83.0069);
  const [estimatedCost, setEstimatedCost] = useState<string>('1200000');
  const [boqItemName, setBoqItemName] = useState('Solar Lighting Mast & Walkway Paving Works');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const presets = [
    {
      label: 'Assi Ghat Solar Corridor',
      name: 'Installation of Solar Lighting & Heritage Walkway',
      location: 'Assi Ghat to Ravidas Ghat Corridor, Varanasi',
      lat: 25.2890,
      lng: 83.0069,
      cost: '1200000',
      boq: 'Solar Lighting Mast & Walkway Paving Works',
      desc: 'Installation of high-mast solar lighting poles and heritage walkway pavers to improve public accessibility and riverfront security.',
    },
    {
      label: 'Shivpur Public Library',
      name: 'Digital Public Library & E-Learning Center',
      location: 'Shivpur Ward, Varanasi District',
      lat: 25.3524,
      lng: 82.9739,
      cost: '1800000',
      boq: 'Library civil works, digital workstations & educational furniture',
      desc: 'Creation of a fully equipped digital public reading room and competitive exam study center for rural youth.',
    },
    {
      label: 'Pindra PHC Solar Cold Chain',
      name: 'Primary Health Center Solar Cold Chain Facility',
      location: 'Pindra Community Health Center, Varanasi District',
      lat: 25.4380,
      lng: 82.8120,
      cost: '1500000',
      boq: 'Solar power plant and vaccine refrigeration storage setup',
      desc: '24/7 dedicated solar backup power and cold-chain vaccine refrigeration unit for rural healthcare.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !estimatedCost) {
      setError('Please provide project title, location, and estimated budget.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.recommendProject({
        name: name.trim(),
        description: description.trim(),
        location: location.trim(),
        estimated_cost: Number(estimatedCost),
        latitude,
        longitude,
        boq_item_name: boqItemName,
      });

      onRecommended();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit proposal to Nodal Officer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 p-2 rounded-xl">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">MP Project Recommendation</h2>
              <p className="text-[11px] text-amber-100 font-medium">
                Step 1: Hon&apos;ble MP recommends development proposal to District Nodal Officer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets Quick Picker */}
        <div className="bg-amber-50/60 px-6 py-2.5 border-b border-amber-100 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-bold text-amber-900 shrink-0">Demo Presets:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setName(p.name);
                setLocation(p.location);
                setLatitude(p.lat);
                setLongitude(p.lng);
                setEstimatedCost(p.cost);
                setBoqItemName(p.boq);
                setDescription(p.desc);
              }}
              className="px-2.5 py-1 rounded-md bg-white border border-amber-200 hover:border-amber-400 text-amber-900 font-medium text-[11px] shrink-0 transition cursor-pointer shadow-2xs"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* District and Recommender Info Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px]">
            <div>
              <span className="text-slate-500 block">Recommending Authority:</span>
              <span className="font-bold text-slate-900">{mpName} (Member of Parliament)</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Target District:</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Varanasi District (PC-77)
              </span>
            </div>
          </div>

          {/* Project Title */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 block">
              Development Project Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Construction of Community Hall..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              required
            />
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 block flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>Specific Location in Varanasi District <span className="text-red-500">*</span></span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Assi Ghat Corridor, Ward 12, Varanasi"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              required
            />
          </div>

          {/* GPS Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-600 block text-[11px]">GPS Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-600 block text-[11px]">GPS Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Estimated Cost */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 block flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
              <span>Recommended MPLADS Allocation (₹) <span className="text-red-500">*</span></span>
            </label>
            <input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              required
            />
            <span className="text-[10px] text-slate-500">
              ₹{(Number(estimatedCost) / 100000).toFixed(2)} Lakhs (Allocable under Varanasi MPLADS Fund)
            </span>
          </div>

          {/* Description & Justification */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 block flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Public Benefit &amp; MP Justification</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe why this project is recommended and the community benefit..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          {/* Primary BOQ Item */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 block">Primary Execution Component / Scope</label>
            <input
              type="text"
              value={boqItemName}
              onChange={(e) => setBoqItemName(e.target.value)}
              placeholder="e.g. Civil construction and materials"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Submitting to Nodal Officer...' : 'Recommend to Nodal Officer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
