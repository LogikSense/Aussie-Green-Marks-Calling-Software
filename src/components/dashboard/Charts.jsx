import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export const CallsTrendChart = () => {
  return (
    <div className="premium-card lg:h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-semibold">Volume Performance</h3>
          <p className="text-xs text-muted-foreground mt-1 text-red-500">Waiting for campaign data...</p>
        </div>
      </div>
      
      <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded-2xl bg-accent/5">
        <p className="text-sm text-muted-foreground">Historical data will appear here.</p>
      </div>
    </div>
  );
};

export const AgentPerformanceChart = () => {
  return (
    <div className="premium-card">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-semibold">AI Assistant Accuracy</h3>
      </div>
      
      <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded-2xl bg-accent/5">
        <p className="text-sm text-muted-foreground">Performance metrics pending first call.</p>
      </div>
    </div>
  );
};

