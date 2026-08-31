import React, { useState, useEffect } from 'react';
import { Save, Key, Globe, Bell, Shield, Webhook, Cpu, Sliders, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function SettingsView() {
  const { getAuthHeaders } = useAuth();
  const [showVapi, setShowVapi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [formData, setFormData] = useState({
    vapiApiKey: '',
    vapiAssistantId: '',
    vapiPhoneNumberId: '',
    voiceAiProvider: '',
    aiAgentPrompt: '',
    crmEndpoint: '',
    crmApiKey: '',
    webhookUrl: '',
  });

  const API_BASE = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setFormData({
            vapiApiKey: data.config.vapiApiKey || '',
            vapiAssistantId: data.config.vapiAssistantId || '',
            vapiPhoneNumberId: data.config.vapiPhoneNumberId || '',
            voiceAiProvider: data.config.voiceAiProvider || '',
            aiAgentPrompt: data.config.aiAgentPrompt || '',
            crmEndpoint: data.config.crmEndpoint || '',
            crmApiKey: data.config.crmApiKey || '',
            webhookUrl: data.config.webhookUrl || '',
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your AI agents, integrations, and global preferences.</p>
        </div>
        {message.text && (
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium animate-in slide-in-from-top duration-300",
            message.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
          )}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { id: 'general', label: 'General', icon: Sliders },
            { id: 'integrations', label: 'AI Channel Configuration', icon: Cpu },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security & Auth', icon: Shield },
            { id: 'webhooks', label: 'System Webhooks', icon: Webhook },
          ].map((item) => (
            <button
              key={item.id}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                item.id === 'integrations' ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              AI Core Configuration
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Voice AI engine</label>
                <select
                  value={formData.voiceAiProvider || ''}
                  onChange={(e) => setFormData({...formData, voiceAiProvider: e.target.value})}
                  className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Vapi (default)</option>
                  <option value="signalwire">SignalWire</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  SignalWire uses a purchased SignalWire number as caller ID and the prompt below (or your Vapi assistant prompt).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">AI agent prompt</label>
                <textarea
                  value={formData.aiAgentPrompt}
                  onChange={(e) => setFormData({...formData, aiAgentPrompt: e.target.value})}
                  placeholder="You are a professional outbound agent. Confirm identity, then..."
                  rows={5}
                  className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <p className="text-xs text-muted-foreground">
                  Required for SignalWire AI if you are not also storing a Vapi assistant.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Service Authentication Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type={showVapi ? "text" : "password"} 
                    value={formData.vapiApiKey}
                    onChange={(e) => setFormData({...formData, vapiApiKey: e.target.value})}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full bg-accent/20 border-border rounded-xl py-3 pl-10 pr-12 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  />
                  <button 
                    onClick={() => setShowVapi(!showVapi)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-accent rounded-lg text-muted-foreground"
                  >
                    {showVapi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Global Multi-Agent ID</label>
                  <input 
                    type="text" 
                    value={formData.vapiAssistantId}
                    onChange={(e) => setFormData({...formData, vapiAssistantId: e.target.value})}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Communication Line ID</label>
                  <input 
                    type="text" 
                    value={formData.vapiPhoneNumberId}
                    onChange={(e) => setFormData({...formData, vapiPhoneNumberId: e.target.value})}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="premium-card">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Webhook className="w-5 h-5 text-primary" />
              Event Callback Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status Update Endpoint</label>
                <input 
                  type="text" 
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData({...formData, webhookUrl: e.target.value})}
                  placeholder="https://api.aussiegreenmarks.com/events"
                  className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <p className="text-xs text-muted-foreground">This is where the calling engine sends real-time status updates.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button 
              onClick={fetchSettings}
              className="px-6 py-3 rounded-xl font-semibold hover:bg-accent transition-all"
            >
              Reset
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="premium-gradient text-white flex items-center gap-2 px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
