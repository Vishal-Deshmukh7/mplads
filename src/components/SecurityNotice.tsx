import React, { useState } from 'react';
import { ShieldCheck, Info, ChevronDown, ChevronUp, Lock, FileCheck, Cpu } from 'lucide-react';

export const SecurityNotice: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-indigo-50/90 border-b border-indigo-100 px-4 py-2.5 text-xs text-slate-700">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold text-slate-900">Security Principle:</span>
          <span className="text-slate-800">
            Every user can access only the screens, projects, claims, and actions permitted for their assigned role. Frontend controls reflect permissions, and backend authorization strictly enforces them.
          </span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-indigo-700 hover:text-indigo-900 transition font-semibold self-start md:self-auto cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{expanded ? 'Hide 3 Pillars' : 'View 3 Pillars & Rules'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-indigo-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs tracking-tight">1. CONTROL</div>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Backend enforces project-level authorization. Contractors strictly see only their assigned projects. Unauthorized requests trigger 403 Forbidden.
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 shrink-0 mt-0.5">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs tracking-tight">2. EVIDENCE</div>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Claims require geotagged visual evidence, timestamp, and BOQ item link. All submissions start as <em>Pending Verification</em>.
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs tracking-tight">3. VERIFICATION</div>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Deterministic 5-check engine analyzes budget limits, progress gaps, GPS radius, timeline, and duplicate invoices. Human authority verifies.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
