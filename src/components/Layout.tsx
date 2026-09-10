import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { LayoutDashboard, FileText, Ticket, MonitorSmartphone, LogOut, Menu, UserCircle, Building2, BarChart3, Sun, Moon, Users, ChevronLeft, ChevronRight, FileCheck } from 'lucide-react';

export function Layout({ children, currentTab, setCurrentTab }: { children: React.ReactNode, currentTab: string, setCurrentTab: (tab: string) => void }) {
  const { currentUser, users, login, logout, theme, toggleTheme, tickets } = useAppContext();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'Admin';
  const isTech = currentUser.role === 'ICT Support';
  
  let ticketBadgeCount = 0;
  if (isAdmin) {
    ticketBadgeCount = tickets.filter(t => t.status === 'NEW').length;
  } else if (isTech) {
    ticketBadgeCount = tickets.filter(t => t.assignedToId === currentUser.id && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, disabled: false },
    { id: 'tickets', label: 'Tickets', icon: Ticket, disabled: false, badge: ticketBadgeCount > 0 ? ticketBadgeCount : undefined },
    { id: 'assets', label: 'Assets', icon: MonitorSmartphone, disabled: false },
    ...(isAdmin ? [
      { id: 'service_reports', label: 'Service Reports', icon: FileCheck, disabled: false },
      { id: 'users', label: 'Users', icon: Users, disabled: false },
      { id: 'departments', label: 'Departments', icon: Building2, disabled: false },
      { id: 'audit_logs', label: 'Audit Logs', icon: FileText, disabled: false },
    ] : []),
    ...(isAdmin || isTech ? [
      { id: 'analytics', label: 'Analytics', icon: BarChart3, disabled: false },
    ] : [])
  ];

  return (
    <div className="h-screen bg-bg text-ink flex overflow-hidden">
      {/* MOBILE OVERLAY */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed md:relative z-40 h-full
        transition-all duration-300 ease-in-out 
        ${isCollapsed ? 'md:w-[88px]' : 'md:w-[280px]'} 
        ${isMobileOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full md:translate-x-0'}
        bg-surface border-r border-border flex flex-col py-8 shadow-[4px_0_24px_rgba(0,0,0,0.02)]
      `}>
        <div className={`flex items-center mb-10 px-6 ${isCollapsed && !isMobileOpen ? 'md:justify-center px-0' : 'justify-between'}`}>
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-bg rounded-xl border border-border shadow-sm">
              <img src="/LGU_LOGO1.png" alt="LGU Logo" className="w-8 h-8 object-contain" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[14px] text-ink tracking-tight whitespace-nowrap">ICT Ticket Hub</span>
                <span className="text-[7px] font-bold italic text-accent uppercase tracking-widest whitespace-nowrap">Municipality Of Malungon</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden md:flex items-center justify-center p-2 rounded-xl text-ink-muted hover:text-accent hover:bg-accent/10 transition-all ${isCollapsed ? 'absolute -right-4 bg-surface border border-border rounded-full shadow-md w-8 h-8' : ''}`}
            style={isCollapsed ? { top: '40px' } : {}}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className="flex flex-col gap-2.5 px-4 overflow-y-auto overflow-x-hidden flex-1 scrollbar-hide">
          {navItems.map(item => (
            <div
              key={item.id}
              title={isCollapsed && !isMobileOpen ? item.label : undefined}
              onClick={() => {
                if (!item.disabled) {
                  setCurrentTab(item.id);
                  setIsMobileOpen(false);
                }
              }}
              className={`relative flex items-center gap-4 p-3.5 rounded-xl cursor-pointer transition-all ${
                currentTab === item.id 
                  ? 'text-accent bg-accent/10 border border-accent/20 shadow-sm' 
                  : item.disabled ? 'text-ink-muted/50 cursor-not-allowed' : 'text-ink-muted border border-transparent hover:text-accent hover:bg-bg'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${currentTab === item.id ? 'text-accent' : ''}`} style={isCollapsed && !isMobileOpen ? { margin: '0 auto' } : {}} />
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex items-center justify-between w-full overflow-hidden">
                  <span className={`text-[13px] whitespace-nowrap overflow-hidden ${currentTab === item.id ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-md ml-auto shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
              {isCollapsed && !isMobileOpen && item.badge !== undefined && (
                <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-md bg-accent text-[9px] font-bold text-white shadow-sm ring-2 ring-surface">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-4 px-4 pt-6">
          <div className={`flex items-center gap-3 p-3 w-full transition-all ${isCollapsed && !isMobileOpen ? 'justify-center' : 'bg-bg rounded-2xl border border-border shadow-sm'}`}>
            <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-[13px] font-bold text-accent shadow-sm">
              {currentUser.name.substring(0, 2).toUpperCase()}
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex-1 overflow-hidden">
                <div className="text-[13px] font-bold text-ink truncate">{currentUser.name}</div>
                <div className="text-[10px] text-ink-muted font-bold uppercase tracking-widest mt-0.5 truncate">{currentUser.role}</div>
              </div>
            )}
          </div>
          <div 
            className={`flex items-center gap-3 p-3.5 w-full rounded-xl cursor-pointer text-ink-muted hover:text-red-500 hover:bg-red-500/10 transition-all ${isCollapsed && !isMobileOpen ? 'justify-center' : ''}`}
            title="Sign Out"
            onClick={logout}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" style={isCollapsed && !isMobileOpen ? { margin: '0 auto' } : {}} />
            {(!isCollapsed || isMobileOpen) && <span className="font-bold text-[13px] whitespace-nowrap">Sign Out</span>}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden w-full relative">
        <header className="border-b border-border px-6 md:px-10 h-20 flex items-center justify-between bg-surface/80 backdrop-blur-md flex-shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-ink-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="font-mono text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-ink-muted flex items-center gap-2">
              <span className="hidden sm:inline">System</span> 
              <span className="hidden sm:inline text-border">/</span> 
              <span className="text-ink">{currentTab}</span> 
              <span className="text-border">/</span> 
              <span className="text-ink">Overview</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2.5 text-ink-muted bg-bg border border-border hover:text-accent hover:border-accent/50 rounded-xl transition-all shadow-sm"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 bg-bg border border-border px-3 py-2 rounded-xl shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-ink">Live Server</span>
            </div>
          </div>
        </header>
        <div className="p-6 md:p-10 overflow-y-auto flex-1 bg-bg bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-surface/50 via-bg to-bg relative">
          {children}
        </div>
      </main>
    </div>
  );
}
