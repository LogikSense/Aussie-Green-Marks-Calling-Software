import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const StatsCards = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
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
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const displayStats = [
    { 
      label: 'Total Leads', 
      value: stats?.totalLeads || 0, 
      subValue: `${stats?.totalCampaigns || 0} Campaigns`, 
      icon: Phone, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10' 
    },
    { 
      label: 'Reached Human', 
      value: stats?.reachedHuman || 0, 
      subValue: 'Direct conversations', 
      icon: CheckCircle, 
      color: 'text-green-500', 
      bg: 'bg-green-500/10' 
    },
    { 
      label: 'Voicemails', 
      value: stats?.reachedVoicemail || 0, 
      subValue: 'Messages dropped', 
      icon: Calendar, 
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10' 
    },
    { 
      label: 'Unsuccessful', 
      value: stats?.unsuccessful || 0, 
      subValue: 'No answer/errors', 
      icon: DollarSign, 
      color: 'text-red-500', 
      bg: 'bg-red-500/10' 
    },
  ];

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="premium-card animate-pulse flex items-center justify-center py-12">
            <Loader2 className="w-6 h-8 text-muted-foreground animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {displayStats.map((stat, i) => (
        <div key={i} className="premium-card group hover:border-primary/50 transition-colors">
          <div className="flex items-start justify-between">
            <div className={cn("p-3 rounded-2xl", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <h4 className="text-2xl font-bold mt-1 tabular-nums">
              {stat.value}
            </h4>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] font-semibold text-muted-foreground">{stat.subValue}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

