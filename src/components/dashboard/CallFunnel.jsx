import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export const CallFunnel = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const API_BASE = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/stats`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data.statistics);
        }
      } catch (err) {}
    };
    fetchStats();
  }, []);

  const data = [
    { label: 'Total Leads', value: stats?.totalLeads || 0, width: '100%', color: 'bg-primary/20' },
    { label: 'Calls Attempted', value: stats?.totalLeads || 0, width: '90%', color: 'bg-primary/40' },
    { label: 'Reached Human', value: stats?.reachedHuman || 0, width: '70%', color: 'bg-primary/60' },
    { label: 'Voicemails', value: stats?.reachedVoicemail || 0, width: '50%', color: 'bg-primary/80' },
    { label: 'Unsuccessful', value: stats?.unsuccessful || 0, width: '30%', color: 'bg-red-500/40' },
  ];

  return (
    <div className="premium-card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-6">Call Resolution Funnel</h3>
      <div className="flex-1 flex flex-col gap-4">
        {data.map((item, i) => (
          <div key={i} className="relative">
            <div className="flex justify-between text-xs mb-1 px-1">
              <span className="font-medium">{item.label}</span>
              <span className="font-bold">{item.value}</span>
            </div>
            <div className="h-8 w-full bg-accent/30 rounded-lg overflow-hidden border border-border">
              <div 
                className={`h-full ${item.color} transition-all duration-1000 border-r border-primary/20`}
                style={{ width: item.value === 0 ? '0%' : item.width }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

