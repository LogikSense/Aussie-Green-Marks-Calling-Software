import React, { useState } from 'react';
import DashboardLayout from './DashboardLayout';
import DashboardView from '../pages/DashboardView';
import CampaignsView from '../pages/CampaignsView';
import ManualCallingView from '../pages/ManualCallingView';
import AgentsView from '../pages/AgentsView';
import SettingsView from '../pages/SettingsView';
import CallHistoryView from '../pages/CallHistoryView';
import BillingView from '../pages/BillingView';
import AdminNumbersView from '../pages/AdminNumbersView';
import { 
  History, 
  FileText, 
  CalendarCheck, 
  Users, 
  BarChart3,
  Mic2,
  Zap,
  CreditCard
} from 'lucide-react';

const PlaceholderView = ({ title, icon: Icon }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Icon className="w-8 h-8 text-primary" />
    </div>
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-muted-foreground max-w-sm">
      This section is currently under development for the premium enterprise platform.
    </p>
  </div>
);

export default function OutcallingApp() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'campaigns':
        return <CampaignsView />;
      case 'manual-calling':
        return <ManualCallingView />;
      case 'agents':
        return <AgentsView />;
      case 'history':
        return <CallHistoryView />;
      case 'appointments':
        return <PlaceholderView title="Appointment Scheduler" icon={CalendarCheck} />;
      case 'customers':
        return <PlaceholderView title="Customer CRM" icon={Users} />;
      case 'insights':
        return <PlaceholderView title="AI Insights Engine" icon={Zap} />;
      case 'recordings':
        return <PlaceholderView title="Call Recordings" icon={Mic2} />;
      case 'billing':
        return <BillingView />;
      case 'admin-numbers':
        return <AdminNumbersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

