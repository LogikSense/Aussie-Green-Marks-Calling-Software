import React, { useState, useEffect } from 'react';
import { Search, PhoneIncoming, Play, FileText, Calendar, Clock, User, Phone, CheckCircle2, XCircle, Clock4, ExternalLink, Mic2, RefreshCcw, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const PROVIDER_CALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE_STATUSES = new Set(['calling', 'in-progress', 'ringing', 'queued', 'pending', 'scheduled']);

export default function CallHistoryView() {
  const { getAuthHeaders } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const syncCall = async (callId) => {
    if (!PROVIDER_CALL_ID.test(callId || '')) return;
    try {
      setSyncing(true);
      setSyncError(null);
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const url = `${API_BASE}/api/v1/calls/${callId}/sync`.replace('//api', '/api');

      const res = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError(data.detail || 'Failed to sync call from the voice provider.');
        return;
      }
      if (data.success && data.call) {
        setSelectedCall(data.call);
        setCalls(prev => prev.map(c => c.vapi_call_id === callId ? data.call : c));
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncError('Failed to sync call from the voice provider.');
    } finally {
      setSyncing(false);
    }
  };

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const url = `${API_BASE}/api/v1/calls`.replace('//api', '/api');
      
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
      }
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  useEffect(() => {
    if (!selectedCall?.vapi_call_id || selectedCall.transcript) return;
    if (!PROVIDER_CALL_ID.test(selectedCall.vapi_call_id)) return;
    syncCall(selectedCall.vapi_call_id);
  }, [selectedCall?.vapi_call_id]);

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'ended':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock4 className="w-4 h-4 text-amber-500" />;
    }
  };

  const getSummary = (call) => {
    if (call.summary) return call.summary;
    const analysis = call.result?.analysis || {};
    const nested = analysis.summary || call.result?.summary;
    if (nested) return nested;
    if (LIVE_STATUSES.has((call.status || '').toLowerCase())) return 'Summary pending...';
    if (call.endedReason) return `No summary captured. Call ended (${call.endedReason}).`;
    return 'No summary available yet';
  };

  const getRecordingUrl = (call) => {
    return call.recordingUrl || call.result?.recordingUrl || call.result?.artifact?.recordingUrl;
  };

  const getTranscript = (call) => {
    if (call.transcript) return call.transcript;
    const nested = call.result?.transcript || call.result?.artifact?.transcript;
    if (nested) return nested;
    if (LIVE_STATUSES.has((call.status || '').toLowerCase())) {
      return 'Transcript will be available once the call is fully processed.';
    }
    if (call.endedReason) {
      return `No transcript was captured. The call ended (${call.endedReason}).`;
    }
    return 'No transcript captured for this call.';
  };

  const getCost = (call) => {
    // If call provider provided a cost in the result, use it (with conversion + margin)
    // Otherwise show the base trigger cost
    if (call.result?.cost) {
      return `$${(call.result.cost * 1.55).toFixed(2)} AUD`;
    }
    return "$0.50 AUD";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredCalls = calls.filter(call => {
    const searchLower = searchTerm.toLowerCase();
    return (
      call.customer_id.toLowerCase().includes(searchLower) ||
      call.status.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
          <p className="text-muted-foreground mt-1">Detailed logs of every AI interaction.</p>
        </div>
        <button 
          onClick={fetchCalls}
          className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors flex items-center gap-2"
        >
          Refresh Logs
        </button>
      </div>

      <div className="premium-card !p-0 overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by contact or status..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-accent/30 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="text-muted-foreground">Loading call history...</p>
          </div>
        ) : filteredCalls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-accent/10">
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Recipient</th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Date / Time</th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Cost</th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">AI Summary</th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-accent/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{call.customer_id}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {call.vapi_call_id?.slice(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider",
                        call.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                        call.status === 'failed' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {getStatusIcon(call.status)}
                        {call.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-muted-foreground" /> {formatDate(call.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-primary">{getCost(call)}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs md:max-w-sm lg:max-w-md">
                      <p className="text-sm text-muted-foreground line-clamp-2 italic">
                        "{getSummary(call)}"
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                          title="View Details"
                          onClick={() => setSelectedCall(call)}
                        >
                          <FileText className="w-4 h-4" /> DETAILS
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-accent/5 flex items-center justify-center mb-6">
              <PhoneIncoming className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-semibold">No call records found</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm">
              Your call history is currently empty. Records will appear here once agents begin making calls.
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex items-center justify-between bg-accent/5">
              <div>
                <h3 className="text-xl font-bold">{selectedCall.customer_id}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    selectedCall.status === 'completed' ? "bg-emerald-500" : "bg-amber-500"
                  )} />
                  {selectedCall.status}{selectedCall.endedReason ? ` • ${selectedCall.endedReason}` : ''} • {formatDate(selectedCall.created_at)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedCall(null)}
                className="p-2 hover:bg-accent rounded-xl"
              >
                <XCircle className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Recording Section */}
              {getRecordingUrl(selectedCall) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Play className="w-4 h-4 fill-current" /> Call Recording
                  </h4>
                  <audio controls className="w-full">
                    <source src={getRecordingUrl(selectedCall)} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Summary Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> AI Analysis
                </h4>
                <div className="bg-accent/20 p-4 rounded-xl border border-border italic text-sm text-balance">
                  "{getSummary(selectedCall)}"
                </div>
              </div>

              {/* Transcript Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <Mic2 className="w-4 h-4" /> Transcript
                </h4>
                <div className="bg-card p-4 rounded-xl border border-border font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {getTranscript(selectedCall)}
                </div>
              </div>
            </div>

            {syncError && (
              <div className="px-6 text-sm text-red-500">{syncError}</div>
            )}
            <div className="p-6 border-t border-border bg-accent/5 flex justify-end gap-3">
              <button 
                onClick={() => syncCall(selectedCall.vapi_call_id)}
                disabled={syncing}
                className="px-6 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Sync Call Status
              </button>
              <button 
                onClick={() => setSelectedCall(null)}
                className="px-6 py-2 bg-accent hover:bg-accent/80 rounded-xl text-sm font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

