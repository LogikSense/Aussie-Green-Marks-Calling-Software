import React, { useState, useEffect, useRef } from 'react';
import { Phone, X, Minus, Mic, MicOff, PhoneOff, User, Hash, Clock, MoreHorizontal, Pause } from 'lucide-react';
import { Device } from '@twilio/voice-sdk';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function SoftphoneWindow({ onClose }) {
  const { user, getAuthHeaders } = useAuth();
  const [minimized, setMinimized] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [status, setStatus] = useState('Offline'); // Available, Busy, Offline
  const [callState, setCallState] = useState('idle'); // idle, calling, active, incoming
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  
  const [device, setDevice] = useState(null);
  const [activeConnection, setActiveConnection] = useState(null);
  const [tokenError, setTokenError] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL || '';

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
          throw new Error('Failed to fetch Twilio token. Ensure backend Twilio environment variables are set.');
        }

        const data = await res.json();
        
        const newDevice = new Device(data.token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true
        });

        newDevice.on('registered', () => {
          console.log('Twilio Device registered');
        });

        newDevice.on('error', (twilioError) => {
          console.error('Twilio Device Error:', twilioError);
          setTokenError(twilioError.message);
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
          
          connection.on('cancel', () => {
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
    if (!dialNumber || !device) return;
    setCallState('calling');
    try {
      const params = { To: dialNumber };
      const connection = await device.connect({ params });
      
      connection.on('accept', () => {
        setCallState('active');
      });
      
      connection.on('disconnect', () => {
        setCallState('idle');
        setActiveConnection(null);
        setDialNumber('');
      });
      
      connection.on('error', (err) => {
        console.error('Connection error:', err);
        setCallState('idle');
        setActiveConnection(null);
      });

      setActiveConnection(connection);
    } catch (err) {
      console.error('Dial error:', err);
      setCallState('idle');
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
      <div className="fixed bottom-6 right-6 z-50 bg-background border border-border shadow-2xl rounded-full px-4 py-2 flex items-center gap-4 cursor-pointer hover:bg-accent transition-colors" onClick={() => setMinimized(false)}>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-sm font-semibold">Softphone ({status})</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-background rounded-full">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[340px] bg-background border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="bg-accent/30 p-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Manual Calling</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col h-[480px]">
        {callState === 'idle' ? (
          <div className="flex-1 p-4 flex flex-col">
            {/* Status Selector */}
            <div className="mb-4 flex items-center justify-between bg-accent/20 p-2 rounded-xl border border-border">
              <span className="text-xs font-medium text-muted-foreground ml-2">Status</span>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-sm font-semibold focus:outline-none border-none cursor-pointer"
              >
                <option value="Available">🟢 Available</option>
                <option value="Busy">🔴 Busy</option>
                <option value="Offline">⚫ Offline</option>
              </select>
            </div>

            {/* Display / Input */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <input 
                type="text" 
                value={dialNumber}
                readOnly
                placeholder="Enter number..."
                className="w-full text-center text-3xl font-bold bg-transparent outline-none tracking-wider placeholder:text-muted-foreground/30"
              />
              {tokenError && (
                <p className="text-xs text-red-500 mt-2 font-medium bg-red-50 p-2 rounded-lg text-center leading-tight">
                  {tokenError}
                </p>
              )}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
                <button 
                  key={key}
                  onClick={() => setDialNumber(prev => prev + key)}
                  className="p-3 text-lg font-semibold bg-accent/30 hover:bg-accent rounded-xl transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-center gap-4">
              <button 
                onClick={handleDial}
                disabled={!dialNumber || status === 'Offline'}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Phone className="w-5 h-5 fill-current" />
                Call
              </button>
              {callState === 'calling' && (
                <button 
                  onClick={handleEndCall}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <PhoneOff className="w-5 h-5" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : callState === 'incoming' ? (
          <div className="flex-1 p-6 flex flex-col bg-slate-900 text-white">
             <div className="text-center space-y-2 mb-8 mt-10">
              <div className="w-24 h-24 bg-primary/20 rounded-full mx-auto flex items-center justify-center mb-4 animate-pulse">
                <Phone className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold tracking-widest">{dialNumber}</h3>
              <p className="text-emerald-400 font-medium">Incoming Call...</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-auto">
              <button 
                onClick={handleEndCall}
                className="py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-6 h-6" />
                Decline
              </button>
              <button 
                onClick={handleAcceptIncoming}
                className="py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 animate-bounce"
              >
                <Phone className="w-6 h-6 fill-current" />
                Accept
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 flex flex-col bg-slate-900 text-white">
            <div className="text-center space-y-2 mb-8">
              <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold tracking-widest">{dialNumber}</h3>
              <p className="text-emerald-400 font-medium flex items-center justify-center gap-2">
                {callState === 'calling' ? (
                  <span className="animate-pulse">Calling...</span>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>00:00</span>
                  </>
                )}
              </p>
            </div>

            {callState === 'active' && (
              <div className="grid grid-cols-3 gap-4 mt-auto mb-8 px-4">
                <button 
                  onClick={toggleMute}
                  className={cn("flex flex-col items-center gap-2 p-3 rounded-xl transition-colors", isMuted ? "bg-white text-slate-900" : "bg-slate-800 hover:bg-slate-700")}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  <span className="text-xs font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
                <button 
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <Hash className="w-6 h-6" />
                  <span className="text-xs font-medium">Keypad</span>
                </button>
                <button 
                  onClick={() => setIsOnHold(!isOnHold)}
                  className={cn("flex flex-col items-center gap-2 p-3 rounded-xl transition-colors", isOnHold ? "bg-amber-500 text-white" : "bg-slate-800 hover:bg-slate-700")}
                >
                  <Pause className="w-6 h-6" />
                  <span className="text-xs font-medium">{isOnHold ? 'Resume' : 'Hold'}</span>
                </button>
              </div>
            )}

            <button 
              onClick={handleEndCall}
              className="mt-auto w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <PhoneOff className="w-6 h-6" />
              End Call
            </button>
          </div>
        )}
      </div>
    </div>
  );
}