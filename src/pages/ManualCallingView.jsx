import React, { useState } from 'react';
import { PhoneCall, MonitorSmartphone } from 'lucide-react';
import SoftphoneWindow from '../components/SoftphoneWindow';

export default function ManualCallingView() {
  const [isSoftphoneOpen, setIsSoftphoneOpen] = useState(false);

  const toggleSoftphone = () => {
    setIsSoftphoneOpen((prev) => !prev);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manual Calling</h1>
        <p className="text-muted-foreground mt-1">Manage your cloud-based softphone experience.</p>
      </div>

      <div className="premium-card overflow-hidden">
        <div className="p-8 flex flex-col items-center justify-center space-y-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MonitorSmartphone className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl font-bold">Desktop Softphone</h3>
            <p className="text-sm text-muted-foreground">
              Launch the floating dialer to make and receive calls, manage your availability status, and access call controls without leaving your workflow.
            </p>
          </div>

          <button
            onClick={toggleSoftphone}
            className="premium-gradient text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg shadow-primary/20 hover:opacity-95 transition-all active:scale-[0.98]"
          >
            <PhoneCall className="w-5 h-5" />
            Launch Dialer
          </button>
        </div>
      </div>

      {isSoftphoneOpen && (
        <SoftphoneWindow onClose={() => setIsSoftphoneOpen(false)} />
      )}
    </div>
  );
}
