import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  PhoneCall, 
  BarChart3, 
  CalendarCheck, 
  Users, 
  Zap, 
  Mic2, 
  FileText, 
  CreditCard, 
  Settings, 
  Bell, 
  LogOut, 
  Menu, 
  X, 
  Search,
  ChevronRight,
  User,
  Activity,
  History,
  Moon,
  Sun
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import { MessageSquare, Radio, ShieldCheck } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Omnichannel Inbox', icon: MessageSquare },
  { id: 'supervisor', label: 'Live Supervisor', icon: Radio },
  { id: 'spam-protection', label: 'Spam Reputation', icon: ShieldCheck },
  { id: 'campaigns', label: 'Campaigns', icon: PhoneCall },
  { id: 'manual-calling', label: 'Manual Calling', icon: PhoneCall },
  { id: 'agents', label: 'AI Agents', icon: Mic2 },
  { id: 'history', label: 'Call History', icon: History },
  { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'insights', label: 'AI Insights', icon: Zap },
  { id: 'recordings', label: 'Call Recordings', icon: Mic2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'admin-numbers', label: 'Phone Numbers', icon: Settings },
  { id: 'settings', label: 'Settings', icon: Settings },
];


export default function DashboardLayout({ activeTab, setActiveTab, children }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "relative z-40 bg-background border-r border-border transition-all duration-300 ease-in-out flex flex-col shrink-0",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="ml-3">
              <span className="font-bold text-base tracking-tight block">AGM Voice CRM</span>
              <span className="text-xs text-muted-foreground font-medium">Call Management</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                activeTab === item.id 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 shrink-0 transition-transform duration-200",
                activeTab === item.id ? "scale-110" : "group-hover:scale-110"
              )} />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            onClick={logout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Sign out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-8">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="max-w-md w-full relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-accent/10 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background" />
            </button>
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="h-8 w-px bg-border mx-2" />
            <div className="flex items-center gap-3 px-2 py-1 rounded-full hover:bg-accent transition-colors cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold leading-tight">{user?.email || 'Admin User'}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{user?.role || 'Administrator'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

