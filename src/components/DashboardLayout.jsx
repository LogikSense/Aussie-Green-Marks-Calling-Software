import React, { useState } from 'react';
import {
  Upload,
  Calendar,
  CheckCircle,
  Archive,
  Shield,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
  Phone,
  Users,
  Activity,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'results', label: 'Results', icon: CheckCircle },
  { id: 'history', label: 'History', icon: Archive },
  { id: 'verification', label: 'Verification', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'api-docs', label: 'API Docs', icon: FileText },
];

const TAB_TITLES = {
  import: 'Import Customers',
  schedule: 'Schedule Calls',
  results: 'Verification Results',
  history: 'History & Archive',
  verification: 'Verification Config',
  settings: 'API Settings',
  'api-docs': 'API Documentation',
};

export default function DashboardLayout({
  activeTab,
  setActiveTab,
  user,
  logout,
  stats = {},
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { customers = 0, scheduledCalls = 0, completedCalls = 0 } = stats;

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-100">Voice CRM</span>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                closeSidebar();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0 opacity-90" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700/50">
          <div className="px-3 py-2 text-xs text-slate-400 truncate" title={user?.email}>
            {user?.email || 'User'}
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-semibold text-slate-900 truncate">
              {TAB_TITLES[activeTab] || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                <Users className="w-3.5 h-3.5" />
                {customers}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 text-xs font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {scheduledCalls}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-xs font-medium">
                <Activity className="w-3.5 h-3.5" />
                {completedCalls}
              </span>
            </div>
            <div className="lg:hidden flex items-center gap-2 text-slate-600 text-sm truncate max-w-[120px]">
              {user?.email?.split('@')[0] || 'User'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
