import React, { useState } from 'react';
import { Eye, Mic, PhoneCall, PhoneForwarded, AlertTriangle, ShieldCheck, Users, Clock, Activity, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SupervisorDashboardView() {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState('active_calls');
  const [activeIntervention, setActiveIntervention] = useState(null); // { callSid, mode }

  const API_BASE = import.meta.env.VITE_API_URL || '';

  // Simulated live active calls
  const activeCalls = [
    {
      callSid: "CA1234567890",
      agentName: "Sarah Jenkins",
      agentId: 101,
      customerName: "Robert Miller",
      customerPhone: "+61 411 999 888",
      duration: "04:12",
      queue: "Solar Sales Tier 1",
      sentiment: "Positive (0.85)",
      status: "In Call"
    },
    {
      callSid: "CA0987654321",
      agentName: "Alex Rivera",
      agentId: 102,
      customerName: "Amanda Cross",
      customerPhone: "+61 422 777 666",
      duration: "01:45",
      queue: "Commercial Audits",
      sentiment: "Frustrated (0.32)",
      status: "In Call"
    }
  ];

  // Simulated queue status
  const queueStats = [
    { name: "Solar Sales Tier 1", waitingCalls: 3, avgWait: "00:45", priority: "High" },
    { name: "Commercial Audits", waitingCalls: 1, avgWait: "00:15", priority: "Medium" },
    { name: "General Inquiries", waitingCalls: 0, avgWait: "00:00", priority: "Normal" }
  ];

  const handleSupervisorAction = async (callSid, agentId, mode) => {
    try {
      const res = await fetch(`${API_BASE}/api/telephony/supervisor/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          call_sid: callSid,
          agent_id: agentId,
          mode: mode
        })
      });
      if (res.ok) {
        setActiveIntervention({ callSid, mode });
      }
    } catch (err) {
      console.error('Supervisor action error:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-500 animate-pulse" /> Supervisor Live Operations Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Real-time Call Monitoring • Listen (Eavesdrop), Whisper, Barge-In & Takeover Controls</p>
        </div>

        {/* Live Metrics Quick Cards */}
        <div className="flex items-center gap-3">
          <div className="bg-card border border-border px-3.5 py-2 rounded-xl text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Active Calls</p>
            <p className="text-lg font-bold text-emerald-500">2</p>
          </div>
          <div className="bg-card border border-border px-3.5 py-2 rounded-xl text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Waiting in Queue</p>
            <p className="text-lg font-bold text-amber-500">4</p>
          </div>
          <div className="bg-card border border-border px-3.5 py-2 rounded-xl text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Active Supervisors</p>
            <p className="text-lg font-bold text-primary">1</p>
          </div>
        </div>
      </div>

      {/* Active Intervention Alert Banner */}
      {activeIntervention && (
        <div className="bg-indigo-950/60 border border-indigo-500/50 p-4 rounded-xl flex items-center justify-between text-xs text-indigo-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>
              Active Supervisor Session: <strong>{activeIntervention.mode.toUpperCase()}</strong> on Call <code>{activeIntervention.callSid}</code>
            </span>
          </div>
          <button 
            onClick={() => setActiveIntervention(null)}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-colors"
          >
            End Intervention
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-border gap-4 text-xs font-semibold">
        <button 
          onClick={() => setActiveTab('active_calls')}
          className={`pb-2 transition-colors border-b-2 ${activeTab === 'active_calls' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Live Active Agent Calls ({activeCalls.length})
        </button>
        <button 
          onClick={() => setActiveTab('queues')}
          className={`pb-2 transition-colors border-b-2 ${activeTab === 'queues' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Queue Monitoring & Overflow ({queueStats.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'active_calls' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeCalls.map((call) => (
            <div key={call.callSid} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-bold text-base">{call.agentName}</h3>
                  <p className="text-xs text-muted-foreground">Queue: {call.queue}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-500 flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5" /> {call.duration}
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-semibold mt-1 inline-block">
                    {call.sentiment}
                  </span>
                </div>
              </div>

              <div className="bg-accent/40 p-3 rounded-xl border border-border text-xs space-y-1">
                <p className="text-muted-foreground">Connected Customer:</p>
                <p className="font-semibold text-sm">{call.customerName} ({call.customerPhone})</p>
              </div>

              {/* 4 Supervisor Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <button 
                  onClick={() => handleSupervisorAction(call.callSid, call.agentId, 'listen')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-colors"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Listen (Silent)
                </button>

                <button 
                  onClick={() => handleSupervisorAction(call.callSid, call.agentId, 'whisper')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-colors"
                >
                  <Mic className="w-4 h-4 text-emerald-400" />
                  Whisper (Coach)
                </button>

                <button 
                  onClick={() => handleSupervisorAction(call.callSid, call.agentId, 'barge')}
                  className="p-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-colors"
                >
                  <PhoneCall className="w-4 h-4" />
                  Barge-In
                </button>

                <button 
                  onClick={() => handleSupervisorAction(call.callSid, call.agentId, 'takeover')}
                  className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-colors"
                >
                  <PhoneForwarded className="w-4 h-4" />
                  Take Over
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-accent/40 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-3">Queue Name</th>
                <th className="p-3">Calls Waiting</th>
                <th className="p-3">Avg Wait Time</th>
                <th className="p-3">Priority Level</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {queueStats.map((q, idx) => (
                <tr key={idx} className="hover:bg-accent/30 transition-colors">
                  <td className="p-3 font-bold">{q.name}</td>
                  <td className="p-3"><span className="font-semibold text-amber-500">{q.waitingCalls}</span></td>
                  <td className="p-3">{q.avgWait}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-accent rounded text-[10px] font-semibold">{q.priority}</span></td>
                  <td className="p-3 text-right">
                    <button className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-semibold">
                      Force Route
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
