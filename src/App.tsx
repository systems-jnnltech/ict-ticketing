import React, { useState } from 'react';
import { AppProvider, useAppContext } from './store/AppContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TicketsList } from './components/TicketsList';
import { TicketDetail } from './components/TicketDetail';
import { CreateTicket } from './components/CreateTicket';
import { AssetList, AssetDetail } from './components/AssetModule';
import { CreateAsset } from './components/CreateAsset';
import { EmployeeLogin } from './pages/EmployeeLogin';
import { AdminLogin } from './pages/AdminLogin';
import { SupportLogin } from './pages/SupportLogin';
import { AdminDepartments } from './components/AdminDepartments';
import { AdminAnalytics } from './components/AdminAnalytics';
import { AdminUsers } from './components/AdminUsers';
import { GlobalAuditLogs } from './components/GlobalAuditLogs';
import { AdminServiceReports } from './components/AdminServiceReports';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

function MainApp() {
  const { assets } = useAppContext();
  // Instead of mock user, we use the profile from AuthContext
  const { profile } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
  const [assetToEditId, setAssetToEditId] = useState<string | null>(null);

  // Reset inner views when changing top-level tabs
  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setSelectedTicketId(null);
    setSelectedAssetId(null);
    setIsCreatingTicket(false);
    setIsCreatingAsset(false);
    setAssetToEditId(null);
  };

  const renderContent = () => {
    if (currentTab === 'dashboard') {
      return <Dashboard onViewTicket={(id) => { setSelectedTicketId(id); setCurrentTab('tickets'); }} />;
    }
    
    if (currentTab === 'departments' && profile?.role === 'system_admin') {
      return <AdminDepartments />;
    }

    if (currentTab === 'analytics' && (profile?.role === 'system_admin' || profile?.role === 'ict_support')) {
      return <AdminAnalytics />;
    }

    if (currentTab === 'users' && profile?.role === 'system_admin') {
      return <AdminUsers />;
    }

    if (currentTab === 'service_reports' && profile?.role === 'system_admin') {
      return <AdminServiceReports onViewTicket={(ticketId) => { setSelectedTicketId(ticketId); setCurrentTab('tickets'); }} />;
    }

    if (currentTab === 'audit_logs' && profile?.role === 'system_admin') {
      return <GlobalAuditLogs />;
    }
    
    if (currentTab === 'tickets') {
      if (selectedTicketId) {
        return <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;
      }
      if (isCreatingTicket) {
        return <CreateTicket onBack={() => setIsCreatingTicket(false)} />;
      }
      return (
        <TicketsList 
          onSelectTicket={setSelectedTicketId} 
          onCreateTicket={() => setIsCreatingTicket(true)} 
        />
      );
    }

    if (currentTab === 'assets') {
      if (assetToEditId) {
        const asset = assets.find(a => a.id === assetToEditId);
        return <CreateAsset assetToEdit={asset} onBack={() => setAssetToEditId(null)} />;
      }
      if (selectedAssetId) {
        return <AssetDetail 
          assetId={selectedAssetId} 
          onBack={() => setSelectedAssetId(null)} 
          onEdit={() => {
            setAssetToEditId(selectedAssetId);
            setSelectedAssetId(null);
          }} 
        />;
      }
      if (isCreatingAsset) {
        return <CreateAsset onBack={() => setIsCreatingAsset(false)} />;
      }
      return <AssetList 
        onSelectAsset={setSelectedAssetId} 
        onCreateAsset={() => setIsCreatingAsset(true)} 
      />;
    }
    
    return null;
  };

  return (
    <Layout currentTab={currentTab} setCurrentTab={handleTabChange}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<EmployeeLogin />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/support" element={<SupportLogin />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<MainApp />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
