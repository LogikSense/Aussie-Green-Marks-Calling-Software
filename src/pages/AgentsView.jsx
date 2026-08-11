import React, { useState, useEffect } from 'react';
import { 
  Mic2, 
  Search, 
  RefreshCw, 
  Settings2, 
  ShieldCheck, 
  MessageSquare, 
  Zap, 
  Globe, 
  Clock,
  Loader2,
  AlertCircle,
  ExternalLink,
  Phone,
  Hash
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function AgentsView() {
  const { getAuthHeaders } = useAuth();
  const [agents, setAgents] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('agents');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const API_BASE = import.meta.env.VITE_API_URL || '';

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const authHeaders = getAuthHeaders();
      
      // Fetch both assistants and phone numbers in parallel
      const [agentsRes, numbersRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/assistants`, { headers: authHeaders }),
        fetch(`${API_BASE}/api/v1/numbers`, { headers: authHeaders })
      ]);

      const agentsData = await agentsRes.json();
      const numbersData = await numbersRes.json();
      
      if (agentsData.success) {
        setAgents(agentsData.assistants || []);
      } else {
        setError(agentsData.error || 'Failed to fetch agents');
      }

      if (numbersData.success) {
        setNumbers(numbersData.numbers || []);
      }
    } catch (err) {
      setError('Connection to backend failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground mt-4 font-medium italic">Synchronizing with AI Core API...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Voice Agent Management</h1>
          <p className="text-muted-foreground mt-1">Manage and sync your AI voice agents and communication lines.</p>
          
          <div className="flex gap-6 mt-6 border-b border-border">
            <button 
              onClick={() => setActiveSubTab('agents')}
              className={cn(
                "pb-3 text-sm font-semibold transition-all relative",
                activeSubTab === 'agents' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              AI Voice Specialists ({agents.length})
            </button>
            <button 
              onClick={() => setActiveSubTab('numbers')}
              className={cn(
                "pb-3 text-sm font-semibold transition-all relative",
                activeSubTab === 'numbers' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Communication Lines ({numbers.length})
            </button>
          </div>
        </div>
        <button 
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="bg-accent/20 hover:bg-accent/40 text-foreground flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all border border-border mb-1"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Sync Assets
        </button>
      </div>

      {error ? (
        <div className="premium-card border-red-500/20 bg-red-500/5 flex items-center gap-4 text-red-600 p-6">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-bold">Sync Error</p>
            <p className="text-sm opacity-90">{error}</p>
            <p className="text-xs mt-2 italic">Ensure your Authentication Keys are valid in the Settings tab.</p>
          </div>
        </div>
      ) : activeSubTab === 'agents' ? (
        agents.length === 0 ? (
          <div className="premium-card flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-accent/5 flex items-center justify-center mb-6">
              <Mic2 className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-semibold">No AI Specialists Synchronized</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              We couldn't detect any voice specialists on your account. 
              <strong> Please check that your API Key is set correctly in Platform Settings.</strong>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div key={agent.id} className="premium-card group hover:border-primary/50 transition-all flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Mic2 className="w-6 h-6" />
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    agent.model?.provider === 'openai' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {agent.model?.model || 'Enterprise AI'}
                  </span>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{agent.name || 'Unnamed Specialist'}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1 opacity-60">REF: {agent.id.substring(0, 12)}...</p>
                  
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Globe className="w-4 h-4 shrink-0 text-muted-foreground/50" />
                      <span>Language: <span className="text-foreground font-medium">{agent.transcriber?.language || 'en-US'}</span></span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground/50" />
                      <span className="truncate">Voice Profile: <span className="text-foreground font-medium">{agent.voice?.voiceId || 'HD Human'}</span></span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border flex items-center justify-between font-sans text-xs text-muted-foreground">
                   <span>Secure AI Channel</span>
                   <span>Ver {agent.updatedAt?.split('T')[0] || '1.0'}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        numbers.length === 0 ? (
          <div className="premium-card flex flex-col items-center justify-center py-20 text-center">
             <div className="w-16 h-16 rounded-3xl bg-accent/5 flex items-center justify-center mb-6">
               <Hash className="w-8 h-8 text-muted-foreground/30" />
             </div>
             <h3 className="text-xl font-semibold">No Active Lines</h3>
             <p className="text-muted-foreground mt-2">Activate or link a communication line to use for campaigns.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {numbers.map((num) => (
              <div key={num.id} className="premium-card group hover:border-primary/50 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{num.number}</h3>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Network Active</p>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                   <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Line Label</span>
                     <span className="font-medium">{num.name || 'Outbound Primary'}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Status</span>
                     <span className="text-emerald-500 font-bold uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}