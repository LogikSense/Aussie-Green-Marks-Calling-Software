import React from 'react';
import { StatsCards } from '../components/dashboard/StatsCards';
import { CallsTrendChart, AgentPerformanceChart } from '../components/dashboard/Charts';
import { CallFunnel } from '../components/dashboard/CallFunnel';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { Filter, Calendar, Download, RefreshCcw } from 'lucide-react';

export default function DashboardView() {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time performance metrics and AI calling analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-accent/20 px-3 py-2 rounded-xl border border-border">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer">
              <option>Last 30 Days</option>
              <option>Today</option>
              <option>Yesterday</option>
              <option>Last 7 Days</option>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Custom Range</option>
            </select>
          </div>
          <button className="p-2.5 rounded-xl border border-border hover:bg-accent transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2.5 rounded-xl border border-border hover:bg-accent transition-colors">
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <StatsCards />

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CallsTrendChart />
        </div>
        <div className="lg:col-span-1">
          <CallFunnel />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AgentPerformanceChart />
        <RecentActivity />
      </div>
    </div>
  );
}
