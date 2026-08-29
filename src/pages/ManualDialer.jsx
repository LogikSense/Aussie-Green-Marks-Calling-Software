import React, { useState } from 'react';
import { Phone, User, Loader2, CheckCircle2, AlertCircle, PhoneCall, Calendar, Clock, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const COUNTRY_CODES = [
  { code: '+1', label: 'US/Canada (+1)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+64', label: 'NZ (+64)' },
];

export default function ManualDialer() {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isScheduled, setIsScheduled] = useState(false);
  
  const getAUDateTime = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const p = {};
    parts.forEach(part => { p[part.type] = part.value; });
    return {
      date: `${p.year}-${p.month}-${p.day}`,
      time: `${p.hour}:${p.minute}`
    };
  };

  const auDefaults = getAUDateTime();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    countryCode: '+61',
    phone: '',
    scheduledDate: auDefaults.date,
    scheduledAt: auDefaults.time,
    timezone: 'Australia/Sydney'
  });

  const handleToggleSchedule = (val) => {
    setIsScheduled(val);
    if (val) {
      const current = getAUDateTime();
      setFormData(prev => ({
        ...prev,
        scheduledDate: current.date,
        scheduledAt: current.time
      }));
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const handleDial = async (e) => {
    e.preventDefault();
    if (!formData.phone || !formData.firstName) {
      setMessage({ type: 'error', text: 'First name and phone number are required' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    // Build payload
    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      countryCode: formData.countryCode,
      timezone: formData.timezone
    };

    if (isScheduled && formData.scheduledAt) {
      payload.scheduledDate = formData.scheduledDate;
      payload.scheduledAt = formData.scheduledAt;
    }

    try {
      // Use the new explicit endpoint
      const url = `${API_BASE}/api/trigger-manual-call`.replace('//api', '/api');
      console.log('Dialer: Sending request to', url);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      
      if (res.status === 405) {
        throw new Error('Method Not Allowed: The backend route exists but does not accept POST. Please check backend/main.py.');
      }

      const data = await res.json();
      
      if (res.ok) {
        setMessage({ 
          type: 'success', 
          text: isScheduled ? `Call scheduled successfully for ${formData.scheduledDate} ${formData.scheduledAt}` : 'Call initiated successfully! Check Call History.' 
        });
        if (!isScheduled) {
          setFormData(prev => ({ ...prev, firstName: '', lastName: '', phone: '' }));
        }
      } else {
        throw new Error(data.detail || 'Failed to initiate call');
      }
    } catch (err) {
      console.error('Dialer error:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Manual Dialer</h1>
        <p className="text-muted-foreground mt-1">Directly trigger or schedule an AI voice call.</p>
      </div>

      {message.text && (
        <div className={cn(
          "flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm",
          message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="premium-card overflow-hidden">
        <div className="p-8 space-y-8">
          <div className="bg-primary/5 rounded-2xl p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Call Configuration</h3>
                <p className="text-sm text-muted-foreground">Enter recipient details and timing.</p>
              </div>
            </div>
            
            <div className="flex bg-accent/30 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => handleToggleSchedule(false)}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", !isScheduled ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}
              >
                Now
              </button>
              <button 
                type="button"
                onClick={() => handleToggleSchedule(true)}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", isScheduled ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}
              >
                Schedule
              </button>
            </div>
          </div>

          <form onSubmit={handleDial} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  First Name
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  placeholder="John"
                  className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Last Name
                </label>
                <input 
                  type="text" 
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  placeholder="Doe"
                  className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  Country Code
                </label>
                <select
                  value={formData.countryCode}
                  onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
                  className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Phone Number
                </label>
                <input 
                  type="tel" 
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="0400000000"
                  className="w-full bg-accent/20 border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
                />
              </div>
            </div>

            {isScheduled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/5 rounded-2xl animate-in zoom-in-95 duration-200">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Date
                  </label>
                  <input 
                    type="date" 
                    required={isScheduled}
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                    className="w-full bg-white border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                       <Clock className="w-4 h-4 text-primary" />
                       Time (24h HH:mm)
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        const current = getAUDateTime();
                        setFormData(prev => ({ ...prev, scheduledAt: current.time, scheduledDate: current.date }));
                      }}
                      className="text-[10px] uppercase font-bold text-primary hover:underline"
                    >
                      Set to Current AU Time
                    </button>
                  </label>
                  <input 
                    type="time" 
                    required={isScheduled}
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({...formData, scheduledAt: e.target.value})}
                    className="w-full bg-white border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full premium-gradient text-white flex items-center justify-center gap-3 py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:opacity-95 transform transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Phone className="w-6 h-6" />
                  <span>{isScheduled ? 'Schedule AI Call' : 'Start AI Call Now'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground italic">
          Calls are logged in the "Manual Calls" campaign automatically.
        </p>
      </div>
    </div>
  );
}