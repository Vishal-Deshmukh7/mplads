import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, AlertTriangle, UserCheck } from 'lucide-react';
import { User } from '../types';

interface AccessDeniedScreenProps {
  attemptedUrl: string;
  reason: string;
  user: User | null;
  onReturn: () => void;
}

export const AccessDeniedScreen: React.FC<AccessDeniedScreenProps> = ({
  attemptedUrl,
  reason,
  user,
  onReturn,
}) => {
  const normalizedRole = (user?.role || '').toUpperCase();

  const getAllowedScreens = () => {
    switch (normalizedRole) {
      case 'CONTRACTOR':
        return [
          'Contractor Mobile App (Assigned Projects)',
          'Submit Geo-tagged Progress Claims',
          'Submit BOQ Expense Claims',
          'Respond to Verification Queries',
        ];
      case 'MP':
        return [
          'Constituency Overview & Project Tracker',
          'Recommend New Projects (+ Recommend Project)',
          'Track Sanctions & Physical Progress',
          'Constituency Audit Trail',
        ];
      case 'IMPLEMENTING_AGENCY':
        return [
          'Assigned Engineering Projects',
          'Field Inspection & Progress Logging',
          'Ground Verification Updates',
        ];
      case 'DISTRICT_AUTHORITY':
      default:
        return [
          'District Proposals Scrutiny & Sanctions',
          'Direct Technical Sanctions',
          'Automated Claims Verification Engine',
          'Contractor Empanelling & Assignment',
          'Official District Security Audit Log',
        ];
    }
  };

  return (
    <div className="min-h-[500px] flex items-center justify-center p-4">
      <div className="bg-white border-2 border-rose-300 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-xl">
        {/* Top Warning Badge */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">
                HTTP 403 Forbidden
              </span>
              <span className="text-xs font-semibold text-rose-800">RBAC Enforcement</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">Access Denied: Unauthorized Screen</h2>
          </div>
        </div>

        {/* Reason Box */}
        <div className="mt-5 p-4 rounded-2xl bg-rose-50 border border-rose-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-rose-900">Why was access blocked?</div>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                {reason}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-rose-200/60 text-[11px] text-rose-700 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>Target URL:</strong> <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">{attemptedUrl}</code></span>
            <span><strong>Logged Persona:</strong> {user?.name}</span>
            <span><strong>Assigned Role:</strong> <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">{normalizedRole}</code></span>
          </div>
        </div>

        {/* Allowed Screens Box */}
        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Authorized Screens for Your Role ({normalizedRole}):</span>
          </div>
          <ul className="space-y-1.5">
            {getAllowedScreens().map((screen, idx) => (
              <li key={idx} className="text-xs text-slate-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{screen}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Security Principle reminder */}
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong>JANDARPAN Security Principle:</strong> Every user can access only the screens, projects, claims, and actions permitted for their assigned role. This violation has been recorded in the district security audit log.
          </span>
        </div>

        {/* Return to allowed screen button */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onReturn}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Allowed Screens</span>
          </button>
        </div>
      </div>
    </div>
  );
};
