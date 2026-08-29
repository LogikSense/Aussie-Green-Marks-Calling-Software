import React, { useState, useEffect } from 'react';
import { Phone, X, Minus, Mic, MicOff, PhoneOff, User, Hash, Clock, Pause, Share2, Users, Bot, ShieldCheck } from 'lucide-react';
import { Device } from '@twilio/voice-sdk';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function SoftphoneWindow({ onClose }) {
  const { user, getAuthHeaders } = useAuth();
  const [minimized, setMinimized] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [status, setStatus] = useState('Available');
  const [callState, setCallState] = useState('idle'); // idle, calling, active, incoming
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  
  // Number Management
  const [outboundMode, setOutboundMode] = useState('primary'); // primary, secondary, local_presence
  const [myNumbers, setMyNumbers] = useState([]);
  
  // Transfer Modal & State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState('blind'); // blind, warm
  const [transferTarget, setTransferTarget] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [warmTransferStatus, setWarmTransferStatus] = useState(''); // consulting, bridged, cancelled

  // AI Coaching State
  const [aiCoaching, setAiCoaching] = useState({
    sentiment: 'Positive (0.88)',
    suggestion: 'Customer asked about solar tier pricing. Offer Tier 2 package rebate.',
    objection: 'None detected'
  });

  const [device, setDevice] = useState(null);
  const [activeConnection, setActiveConnection] = useState(null);
  const [tokenError, setTokenError] = useState('');
  const [dialNotice, setDialNotice] = useState('');
  const [placing, setPlacing] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  // Fetch agent numbers
  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/twilio/my-numbers`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setMyNumbers(data.numbers || []);
        }
      } catch (err) {
        console.error('Error fetching my numbers:', err);
      }
    };
    fetchNumbers();
  }, [API_BASE, getAuthHeaders]);

  // Initialize Twilio Device
  useEffect(() => {
    if (status === 'Offline') {
      if (device) {
        device.destroy();
        setDevice(null);
      }
      return;
    }

    const initDevice = async () => {
      try {
        setTokenError('');
        const res = await fetch(`${API_BASE}/api/twilio/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ client_name: user?.email || 'agent' })
        });

        if (!res.ok) {
          let detail = 'Voice telephony is not configured. Contact an administrator.';
          try {
            const body = await res.json();
            if (typeof body?.detail === 'string' && body.detail) {
              detail = body.detail;
            }
          } catch {
            // Keep the fallback message when the body is not JSON.
          }
          throw new Error(detail);
        }

        const data = await res.json();
        
        const newDevice = new Device(data.token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true
        });

        newDevice.on('incoming', (connection) => {
          setCallState('incoming');
          setActiveConnection(connection);
          setDialNumber(connection.parameters.From || 'Unknown');
          
          connection.on('disconnect', () => {
            setCallState('idle');
            setActiveConnection(null);
            setDialNumber('');
          });
        });

        newDevice.register();
        setDevice(newDevice);

      } catch (err) {
        console.error('Error initializing Twilio Device:', err);
        setTokenError(err.message);
        setStatus('Offline');
      }
    };

    initDevice();

    return () => {
      if (device) device.destroy();
    };
  }, [status, user, getAuthHeaders, API_BASE]);

  const handleDial = async () => {
    if (!dialNumber || placing) return;
    setPlacing(true);
    setTokenError('');
    setDialNotice('');
    try {
      const displayName = (user?.full_name || user?.email || 'Outbound').trim();
      const [firstName, ...rest] = displayName.split(/\s+/);
      const res = await fetch(`${API_BASE}/api/trigger-manual-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          firstName: firstName || 'Outbound',
          lastName: rest.join(' '),
          phone: dialNumber.trim(),
          countryCode: '+61'
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'Failed to place AI call.';
        throw new Error(detail);
      }

      setDialNotice(data.message || 'AI call placed. The recipient will speak with your Vapi agent.');
    } catch (err) {
      console.error('Dial error:', err);
      setTokenError(err.message || 'Failed to place AI call.');
    } finally {
      setPlacing(false);
    }
  };

  const handleEndCall = () => {
    if (activeConnection) {
      activeConnection.disconnect();
    }
    setCallState('idle');
    setDialNumber('');
    setIsMuted(false);
    setIsOnHold(false);
    setActiveConnection(null);
    setShowTransferModal(false);
  };

  const handleExecuteTransfer = async () => {
    if (!activeConnection || !transferTarget) return;
    
    try {
      const endpoint = transferType === 'blind' ? '/api/telephony/transfers/blind' : '/api/telephony/transfers/warm';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          call_sid: activeConnection.parameters?.CallSid || 'simulated_sid',
          target_phone: transferTarget,
          notes: transferNotes
        })
      });
      
      if (res.ok) {
        if (transferType === 'blind') {
          handleEndCall();
        } else {
          setWarmTransferStatus('consulting');
        }
      }
    } catch (err) {
      console.error('Transfer execution error:', err);
    }
  };

  const handleAcceptIncoming = () => {
    if (activeConnection) {
      activeConnection.accept();
      setCallState('active');
    }
  };

  const toggleMute = () => {
    if (activeConnection) {
      const newMutedState = !isMuted;
      activeConnection.mute(newMutedState);
      setIsMuted(newMutedState);
    }
  };

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 shadow-2xl rounded-full px-4 py-2 flex items-center gap-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setMinimized(false)}>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold">Omnichannel Softphone ({status})</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-slate-700 rounded-full">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] bg-slate-950 text-white border border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900/80 p-3 flex items-center justify-between border-b border-slate-800 backdrop-blur">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide">AI Contact Centre Softphone</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col h-[520px]">
        {callState === 'idle' ? (
          <div className="flex-1 p-4 flex flex-col">
            {/* Status & Outbound Number Selector */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400 ml-2">Agent Status</span>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none border-none cursor-pointer text-emerald-400"
                >
                  <option value="Available" className="bg-slate-900 text-white">🟢 Available</option>
                  <option value="Busy" className="bg-slate-900 text-white">🔴 Busy</option>
                  <option value="Offline" className="bg-slate-900 text-white">⚫ Offline</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400 ml-2">Caller ID</span>
                <select 
                  value={outboundMode}
                  onChange={(e) => setOutboundMode(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none border-none cursor-pointer"
                >
                  <option value="primary" className="bg-slate-900">Primary Number</option>
                  <option value="secondary" className="bg-slate-900">Secondary Number</option>
                  <option value="local_presence" className="bg-slate-900">Local Presence (Auto Match)</option>
                </select>
              </div>
            </div>

            {/* Display / Input */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-2">
              <input 
                type="text" 
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                placeholder="Enter number..."
                className="w-full text-center text-3xl font-bold bg-transparent outline-none tracking-wider placeholder:text-slate-700"
              />
              {tokenError && (
                <p className="text-xs text-red-400 font-medium bg-red-950/40 border border-red-800 p-2 rounded-lg text-center leading-tight">
                  {tokenError}
                </p>
              )}
              {dialNotice && (
                <p className="text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800 p-2 rounded-lg text-center leading-tight">
                  {dialNotice}
                </p>
              )}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
                <button 
                  key={key}
                  onClick={() => setDialNumber(prev => prev + key)}
                  className="p-3 text-lg font-semibold bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors text-slate-200"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-center gap-4">
              <button 
                onClick={handleDial}
                disabled={!dialNumber || placing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Phone className="w-5 h-5 fill-current" />
                {placing ? 'Placing AI call…' : 'Dial Out'}
              </button>
            </div>
          </div>
        ) : callState === 'incoming' ? (
          <div className="flex-1 p-6 flex flex-col bg-slate-950 text-white justify-between">
             <div className="text-center space-y-2 mt-6">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full mx-auto flex items-center justify-center mb-4 animate-pulse">
                <Phone className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold tracking-widest">{dialNumber}</h3>
              <p className="text-emerald-400 font-medium text-sm">Incoming Call via PSTN Queue...</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleEndCall}
                className="py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-5 h-5" />
                Decline
              </button>
              <button 
                onClick={handleAcceptIncoming}
                className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 animate-bounce"
              >
                <Phone className="w-5 h-5 fill-current" />
                Accept
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-4 flex flex-col bg-slate-950 text-white overflow-y-auto">
            {/* Call Header */}
            <div className="text-center space-y-1 mb-4">
              <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-full mx-auto flex items-center justify-center">
                <User className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold tracking-wide">{dialNumber}</h3>
              <p className="text-emerald-400 text-xs font-medium flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Connected • 01:24</span>
              </p>
            </div>

            {/* AI Live Coaching Panel */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" /> VAPI Live Coach
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                  {aiCoaching.sentiment}
                </span>
              </div>
              <p className="text-slate-300 leading-snug">
                <span className="font-semibold text-slate-400">Next Action:</span> {aiCoaching.suggestion}
              </p>
            </div>

            {/* Action Bar */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <button 
                onClick={toggleMute}
                className={cn("flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition-colors", isMuted ? "bg-white text-slate-950 border-white font-bold" : "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300")}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span className="mt-1">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              
              <button 
                onClick={() => setIsOnHold(!isOnHold)}
                className={cn("flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition-colors", isOnHold ? "bg-amber-500 border-amber-400 text-white font-bold" : "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300")}
              >
                <Pause className="w-5 h-5" />
                <span className="mt-1">{isOnHold ? 'Resume' : 'Hold'}</span>
              </button>

              <button 
                onClick={() => setShowTransferModal(true)}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs transition-colors"
              >
                <Share2 className="w-5 h-5 text-indigo-400" />
                <span className="mt-1">Transfer</span>
              </button>

              <button 
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs transition-colors"
              >
                <Users className="w-5 h-5 text-cyan-400" />
                <span className="mt-1">3-Way</span>
              </button>
            </div>

            {/* Transfer Modal / Form */}
            {showTransferModal && (
              <div className="bg-slate-900 border border-indigo-900/60 rounded-xl p-3 mb-4 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-400 border-b border-slate-800 pb-1.5">
                  <span>Call Handoff / Transfer</span>
                  <button onClick={() => setShowTransferModal(false)}><X className="w-3.5 h-3.5" /></button>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setTransferType('blind')}
                    className={cn("flex-1 py-1 rounded text-xs font-medium", transferType === 'blind' ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Blind (Cold)
                  </button>
                  <button 
                    onClick={() => setTransferType('warm')}
                    className={cn("flex-1 py-1 rounded text-xs font-medium", transferType === 'warm' ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400")}
                  >
                    Warm (Consult)
                  </button>
                </div>

                <input 
                  type="text" 
                  placeholder="Target Agent / Phone..." 
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-indigo-500"
                />

                <input 
                  type="text" 
                  placeholder="Handoff notes for agent..." 
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-indigo-500"
                />

                <button 
                  onClick={handleExecuteTransfer}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded text-xs transition-colors"
                >
                  Execute {transferType === 'blind' ? 'Blind Transfer' : 'Warm Consult'}
                </button>
              </div>
            )}

            <button 
              onClick={handleEndCall}
              className="mt-auto w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-950/40 transition-all flex items-center justify-center gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              Disconnect Call
            </button>
          </div>
        )}
      </div>
    </div>
  );
}