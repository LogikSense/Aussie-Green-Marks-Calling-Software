import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, RefreshCw, Plus, CheckCircle, XCircle, RotateCw, Database, Activity, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SpamProtectionView() {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState({ metrics: {}, recent_rotations: [] });
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, numRes] = await Promise.all([
        fetch(`${API_BASE}/api/spam/dashboard`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/spam/numbers`, { headers: getAuthHeaders() })
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setData(dashData);
      }
      if (numRes.ok) {
        const numData = await numRes.json();
        setNumbers(numData.numbers || []);
      }
    } catch (err) {
      console.error('Error loading spam protection data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReportComplaint = async (numberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/spam/numbers/${numberId}/report-complaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reason: "Customer flagged caller ID as spam" })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Complaint reporting error:', err);
    }
  };

  const handleForceRotate = async (numberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/spam/numbers/${numberId}/rotate`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Rotation error:', err);
    }
  };

  const handleToggleSpare = async (numberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/spam/numbers/${numberId}/toggle-spare`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Spare toggle error:', err);
    }
  };

  const getHealthStatusBadge = (status, score) => {
    switch (status) {
      case 'Healthy':
        return <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3.5 h-3.5" /> Healthy ({score})</span>;
      case 'Warning':
        return <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><AlertTriangle className="w-3.5 h-3.5" /> Warning ({score})</span>;
      case 'High Risk':
        return <span className="bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><ShieldAlert className="w-3.5 h-3.5" /> High Risk ({score})</span>;
      case 'Spam Reported':
        return <span className="bg-red-500/10 text-red-600 border border-red-500/20 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><XCircle className="w-3.5 h-3.5" /> Spam Reported ({score})</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-500 border border-slate-500/20 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">Retired</span>;
    }
  };

  const metrics = data.metrics || {};

  return (
    <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-500" /> Caller-ID Reputation & Automated Rotation
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Real-time STIR/SHAKEN Tracking • Answer Rate Analytics • Automated Twilio Replacement Workflow</p>
        </div>
        <button onClick={fetchData} className="px-3.5 py-2 bg-accent hover:bg-accent/80 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh Health Scores
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border p-4 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Managed</p>
          <p className="text-xl font-bold mt-1">{metrics.total_numbers || 0}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-emerald-600">Healthy</p>
          <p className="text-xl font-bold text-emerald-500 mt-1">{metrics.healthy || 0}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-amber-600">Warning / Risk</p>
          <p className="text-xl font-bold text-amber-500 mt-1">{(metrics.warning || 0) + (metrics.high_risk || 0)}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-red-600">Spam / Retired</p>
          <p className="text-xl font-bold text-red-500 mt-1">{metrics.spam_reported || 0}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-cyan-600">Spare Pool Depth</p>
          <p className="text-xl font-bold text-cyan-500 mt-1">{metrics.spare_inventory || 0}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-primary">Avg Health Score</p>
          <p className="text-xl font-bold text-primary mt-1">{metrics.average_health_score || 100}%</p>
        </div>
      </div>

      {/* Main Table: Outbound Phone Numbers & Health Matrix */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold tracking-tight">Active Outbound Phone Pool & Health Reputation</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-accent/40 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-3">Phone Number</th>
                <th className="p-3">Health Status</th>
                <th className="p-3">STIR / SHAKEN</th>
                <th className="p-3">Answer Rate</th>
                <th className="p-3">Spam Complaints</th>
                <th className="p-3">Assignment</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {numbers.map((num) => (
                <tr key={num.id} className="hover:bg-accent/30 transition-colors">
                  <td className="p-3 font-bold font-mono text-sm">{num.phone_number}</td>
                  <td className="p-3">{getHealthStatusBadge(num.health_status, num.health_score)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded font-semibold text-[10px]">{num.stir_shaken_status}</span></td>
                  <td className="p-3 font-semibold">{num.answer_rate}%</td>
                  <td className="p-3"><span className={num.spam_complaints > 0 ? "font-bold text-red-500" : "text-muted-foreground"}>{num.spam_complaints}</span></td>
                  <td className="p-3">
                    {num.is_spare ? (
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 rounded font-semibold text-[10px]">Spare Inventory</span>
                    ) : (
                      <span className="text-muted-foreground">{num.assigned_to ? `User #${num.assigned_to} (${num.assignment_type})` : 'Unassigned'}</span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button 
                      onClick={() => handleReportComplaint(num.id)}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded font-semibold text-[11px] transition-colors"
                    >
                      Log Complaint
                    </button>
                    <button 
                      onClick={() => handleForceRotate(num.id)}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-semibold text-[11px] transition-colors flex-inline items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3 inline mr-1" /> Rotate Number
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Trail: Recent Automated Twilio Rotations */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Automated Twilio Rotation Audit Log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-accent/40 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Retired Number</th>
                <th className="p-3">Twilio Replacement Purchased</th>
                <th className="p-3">Trigger Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data.recent_rotations || []).map((rot) => (
                <tr key={rot.id} className="hover:bg-accent/30 transition-colors">
                  <td className="p-3 text-muted-foreground">{rot.created_at ? new Date(rot.created_at).toLocaleString() : 'N/A'}</td>
                  <td className="p-3 font-mono font-bold text-red-500">{rot.retired_number}</td>
                  <td className="p-3 font-mono font-bold text-emerald-500">{rot.replacement_number}</td>
                  <td className="p-3 text-slate-300">{rot.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
