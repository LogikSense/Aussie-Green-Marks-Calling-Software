import React, { useState, useEffect } from 'react';
import { Activity, PhoneIncoming, Clock, CheckCircle2, XCircle, Clock4, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const RecentActivity = () => {
  const { getAuthHeaders } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/calls/results/completed?limit=5`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setActivities(data.calls || []);
        }
      } catch (err) {
        console.error('Failed to fetch activity:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock4 className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="premium-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
      </div>
      
      {loading && activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Syncing live feed...</p>
        </div>
      ) : activities.length > 0 ? (
        <div className="space-y-6">
          {activities.map((activity, i) => (
            <div key={activity.id} className="flex items-start gap-4 relative">
              {i !== activities.length - 1 && (
                <div className="absolute left-[18px] top-[40px] bottom-[-20px] w-px bg-border" />
              )}
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0 border border-border">
                <PhoneIncoming className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{activity.customer_id}</span>
                  {getStatusIcon(activity.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                  {activity.result?.analysis?.summary || 'Call initiated successfully'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {new Date(activity.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-accent/40" />
          </div>
          <p className="text-muted-foreground font-medium">No activity yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Make a manual call to see it here.</p>
        </div>
      )}
    </div>
  );
};

