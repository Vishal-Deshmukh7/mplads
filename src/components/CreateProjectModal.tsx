import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, MapPin, Building2, Calendar, IndianRupee, Layers } from 'lucide-react';
import { api } from '../api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
}

interface BoqRow {
  item_name: string;
  approved_quantity: number;
  unit: string;
  approved_rate: number;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [name, setName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [description, setDescription] = useState('');
  const [constituency, setConstituency] = useState('Varanasi (PC-77)');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<string>('25.2890');
  const [longitude, setLongitude] = useState<string>('83.0069');
  const [approvedCost, setApprovedCost] = useState<string>('1200000'); // 12 Lakhs default
  const [startDate, setStartDate] = useState('2024-03-01');
  const [endDate, setEndDate] = useState('2024-12-15');
  const [contractorId, setContractorId] = useState('');
  const [contractors, setContractors] = useState<Array<{ id: string; name: string; email: string; organization?: string }>>([]);

  const [boqItems, setBoqItems] = useState<BoqRow[]>([
    { item_name: 'High-mast solar lighting poles & LED luminaires', approved_quantity: 8, unit: 'poles', approved_rate: 45000 },
    { item_name: 'Pedestrian stone pavers and drainage kerbs', approved_quantity: 850, unit: 'sq.m', approved_rate: 650 },
    { item_name: 'Reinforced concrete benches & heritage railings', approved_quantity: 24, unit: 'units', approved_rate: 12000 },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getContractors().then((res) => {
        const conts = res?.contractors || [];
        setContractors(conts);
        if (conts.length > 0 && !contractorId) {
          // Preselect Contractor (Apex Infra)
          const apex = conts.find((c) => c.email.includes('apex')) || conts[0];
          setContractorId(apex.id);
        }
      }).catch((err) => {
        console.error('Failed to load contractors:', err);
        setContractors([]);
      });
      // Generate default code
      setProjectCode(`MPLADS-${new Date().getFullYear()}-VAR-${Math.floor(100 + Math.random() * 900)}`);
      setName('Assi Ghat Heritage Riverfront Walkway & Solar Illumination');
      setLocation('Assi Ghat to Ravidas Ghat, Varanasi District');
      setLatitude('25.2890');
      setLongitude('83.0069');
      setApprovedCost('1200000');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddBoqRow = () => {
    setBoqItems([
      ...boqItems,
      { item_name: '', approved_quantity: 100, unit: 'sq.m', approved_rate: 500 },
    ]);
  };

  const handleRemoveBoqRow = (index: number) => {
    setBoqItems(boqItems.filter((_, i) => i !== index));
  };

  const handleBoqChange = (index: number, field: keyof BoqRow, val: any) => {
    const updated = [...boqItems];
    updated[index] = { ...updated[index], [field]: val };
    setBoqItems(updated);
  };

  // Location preset helper
  const applyPreset = (locName: string, lat: string, lng: string) => {
    setLocation(locName);
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !location.trim()) {
      setError('Project name and location are required.');
      return;
    }

    const numCost = Number(approvedCost);
    if (isNaN(numCost) || numCost <= 0) {
      setError('Approved cost must be a positive number.');
      return;
    }

    setLoading(true);
    try {
      await api.createProject({
        project_code: projectCode,
        name: name.trim(),
        description: description.trim(),
        constituency,
        location: location.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        approved_cost: numCost,
        start_date: startDate,
        end_date: endDate,
        contractor_id: contractorId || null,
        boq_items: boqItems.map((b) => ({
          item_name: b.item_name || 'Standard Civil Work',
          approved_quantity: Number(b.approved_quantity) || 1,
          unit: b.unit || 'units',
          approved_rate: Number(b.approved_rate) || 0,
          approved_amount: (Number(b.approved_quantity) || 1) * (Number(b.approved_rate) || 0),
        })),
      });

      onProjectCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Create MPLADS Project &amp; Contract</h2>
              <p className="text-xs text-slate-500">Government Authority Portal • Work Sanction Order</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs shadow-xs">
              {error}
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rural Road Improvement & Drainage Infrastructure"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Project Sanction Code</label>
              <input
                type="text"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="MPLADS-2024-..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Constituency</label>
              <input
                type="text"
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Location Address *</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Village / Ward, Taluk, District, State"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            {/* GPS Coordinates */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                <span>Latitude *</span>
                <span className="text-[10px] text-slate-400 font-normal">GPS Site Origin</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Longitude *</label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            {/* Location quick presets */}
            <div className="sm:col-span-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('Khed Shivapur, Pune, Maharashtra', '18.3562', '73.8471')}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition cursor-pointer"
              >
                📍 Pune Rural Road
              </button>
              <button
                type="button"
                onClick={() => applyPreset('Ward 14, Narela Village, Delhi', '28.8524', '77.0945')}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition cursor-pointer"
              >
                📍 Delhi Health Centre
              </button>
              <button
                type="button"
                onClick={() => applyPreset('Bangarapet, Kolar, Karnataka', '12.9815', '78.2014')}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition cursor-pointer"
              >
                📍 Kolar Water Plant
              </button>
            </div>
          </div>

          {/* Cost & Timeline */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                <span>Approved Cost (₹) *</span>
              </label>
              <input
                type="number"
                min="1000"
                required
                value={approvedCost}
                onChange={(e) => setApprovedCost(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
              <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                ₹{Number(approvedCost || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Start Date *</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Expected Completion *</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>
          </div>

          {/* Contractor Assignment */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block text-slate-800 font-bold mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Assign Contractor (FEATURE 1 — Controlled Access)</span>
            </label>
            <p className="text-[11px] text-slate-500 mb-2.5">
              The assigned contractor will be granted exclusive claim submission rights for this project. Other contractors are rejected by the backend with 403 Forbidden.
            </p>
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs shadow-xs"
            >
              <option value="">-- Leave Unassigned (Assign Later) --</option>
              {(contractors || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.organization || 'Registered Contractor'} ({c.email})
                </option>
              ))}
            </select>
          </div>

          {/* Basic BOQ Items */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Basic Bill of Quantities (BOQ) Items</span>
              </label>
              <button
                type="button"
                onClick={handleAddBoqRow}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {boqItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                  <input
                    type="text"
                    placeholder="Work / Item Description"
                    value={item.item_name}
                    onChange={(e) => handleBoqChange(idx, 'item_name', e.target.value)}
                    className="flex-1 bg-transparent text-slate-900 border-b border-slate-200 pb-0.5 focus:outline-none text-[11px]"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.approved_quantity}
                    onChange={(e) => handleBoqChange(idx, 'approved_quantity', Number(e.target.value))}
                    className="w-16 bg-transparent text-slate-900 border-b border-slate-200 pb-0.5 focus:outline-none text-[11px] text-right font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={item.unit}
                    onChange={(e) => handleBoqChange(idx, 'unit', e.target.value)}
                    className="w-14 bg-transparent text-slate-600 border-b border-slate-200 pb-0.5 focus:outline-none text-[11px]"
                  />
                  <input
                    type="number"
                    placeholder="Rate"
                    value={item.approved_rate}
                    onChange={(e) => handleBoqChange(idx, 'approved_rate', Number(e.target.value))}
                    className="w-16 bg-transparent text-green-700 font-semibold border-b border-slate-200 pb-0.5 focus:outline-none text-[11px] text-right font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveBoqRow(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              {loading ? 'Creating Project...' : 'Sanction & Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
