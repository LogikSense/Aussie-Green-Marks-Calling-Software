import React, { useState, useEffect } from 'react';
import { Plus, Search, Inbox, X, Upload, Calendar, Sliders, Loader2, CheckCircle2, TrendingUp, Phone, Users, MoreVertical, Play, Pause } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

export default function CampaignsView() {
  const { getAuthHeaders } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState(null);
  const [campaignName, setCampaignName] = useState('');
  const [assistants, setAssistants] = useState([]);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const API_BASE = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    fetchCampaigns();
    fetchAssistants();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/campaigns`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssistants = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/assistants`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAssistants(data.assistants || []);
        if (data.assistants?.length > 0 && !selectedAssistant) {
          setSelectedAssistant(data.assistants[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch assistants:', err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseLeads = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          
          // Basic mapping - in a real app, we'd use a mapping modal
          const leads = json.map((row, idx) => ({
            customerId: row.customerId || row['Customer ID'] || row.id || `L-${Date.now()}-${idx}`,
            firstName: row.firstName || row['First Name'] || row.fname || '',
            lastName: row.lastName || row['Last Name'] || row.lname || '',
            phone: String(row.phone || row['Phone Number'] || row.mobile || '').replace(/[^0-9+]/g, ''),
            email: row.email || row['Email Address'] || '',
          })).filter(l => l.phone && l.firstName);
          
          resolve(leads);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const handleLaunch = async () => {
    if (!campaignName) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    
    try {
      // 1. Create or get campaign
      const campRes = await fetch(`${API_BASE}/api/v1/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          name: campaignName,
          vapi_assistant_id: selectedAssistant
        })
      });
      
      const campData = await campRes.json();
      if (!campRes.ok) throw new Error(campData.detail || 'Failed to create campaign');
      
      const campaignId = campData.campaign.id;
      
      // 2. If file exists, parse and upload leads
      if (file) {
        const leads = await parseLeads(file);
        if (leads.length === 0) throw new Error('No valid leads found in file');
        
        const leadRes = await fetch(`${API_BASE}/api/v1/campaigns/${campaignId}/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ customers: leads })
        });
        
        if (!leadRes.ok) {
          const leadData = await leadRes.json();
          throw new Error(leadData.detail || 'Failed to upload leads');
        }
      }
      
      setMessage({ type: 'success', text: `Campaign successfully updated with ${file ? 'new leads' : 'settings'}` });
      setIsModalOpen(false);
      fetchCampaigns();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor your AI calling campaigns.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="premium-gradient text-white flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-all font-sans"
        >
          <Plus className="w-5 h-5" />
          Create/Update Campaign
        </button>
      </div>

      {message.text && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-in slide-in-from-top duration-300",
          message.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="premium-card flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground mt-4">Syncing campaigns...</p>
        </div>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {campaigns.map((camp) => (
            <div key={camp.id} className="premium-card group hover:border-primary/50 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{camp.name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {camp.status.toUpperCase()}
                      </span>
                      {camp.vapi_assistant_id && (
                        <span className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <Sliders className="w-3 h-3" />
                          Specialist: {assistants.find(a => a.id === camp.vapi_assistant_id)?.name || 'AI Specialist'}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {camp.total_leads || 0} Leads
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        Created {new Date(camp.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setCampaignName(camp.name);
                      setSelectedAssistant(camp.vapi_assistant_id || (assistants[0]?.id || ''));
                      setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/20 hover:bg-accent/40 font-medium transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Add Leads
                  </button>
                  <button className="p-2 rounded-xl hover:bg-accent/40 transition-all">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Completion', value: camp.success_rate || '0%' },
                  { label: 'Calls Made', value: camp.calls_made || 0 },
                  { label: 'Pending', value: (camp.total_leads || 0) - (camp.calls_made || 0) },
                  { label: 'AI Accuracy', value: 'High' },
                ].map((stat, i) => (
                  <div key={i} className="bg-accent/5 rounded-2xl p-4 border border-border/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{stat.label}</p>
                    <p className="text-xl font-bold mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="premium-card overflow-hidden !p-0">
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-accent/5 flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-semibold">No campaigns found</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm">
              You haven't created any campaigns yet. Launch your first AI outreach campaign to get started.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-8 text-primary font-semibold hover:underline flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create your first campaign
            </button>
          </div>
        </div>
      )}

      {/* Create/Update Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">Manage Outreach Campaign</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-accent transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Campaign Name</label>
                  <input 
                    type="text" 
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Q4 Customer Verification"
                    className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <p className="text-xs text-muted-foreground">Keep the same name to add leads to your existing campaign.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Specialist Assignment</label>
                    <select 
                      value={selectedAssistant}
                      onChange={(e) => setSelectedAssistant(e.target.value)}
                      className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      {assistants.length > 0 ? (
                        assistants.map((ast) => (
                          <option key={ast.id} value={ast.id}>
                            {ast.name || 'AI Specialist'}
                          </option>
                        ))
                      ) : (
                        <option value="">No specialists available</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Lead List (CSV/Excel)</label>
                    <div className="relative">
                      <input type="file" className="hidden" id="file-upload" onChange={handleFileChange} accept=".csv, .xlsx, .xls" />
                      <label htmlFor="file-upload" className={cn(
                        "w-full flex items-center gap-2 bg-accent/20 border-border rounded-xl py-3 px-4 text-sm cursor-pointer hover:bg-accent/30 transition-all",
                        file && "border-primary bg-primary/5 text-primary"
                      )}>
                        <Upload className="w-4 h-4" />
                        <span className="truncate">{file ? file.name : 'Upload Lead File'}</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Instruction Override</label>
                  <textarea 
                    rows="3"
                    placeholder="Add specific instructions for this campaign..."
                    className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold hover:bg-accent transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={handleLaunch}
                  disabled={submitting || !campaignName}
                  className="flex-[2] premium-gradient text-white flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  {submitting ? 'Updating Campaign...' : 'Launch/Update Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

