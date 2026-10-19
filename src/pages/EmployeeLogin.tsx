import React from 'react';
import { useAuth, Role } from '../store/AuthContext';
import { ShieldCheck, ArrowRight, ServerCrash, Layers, Activity, Lock } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';

export function EmployeeLogin() {
  const { signInWithGoogle, user, profile, loading, mockLogin } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-bg"><div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // If already authenticated and has a profile, go to app
  if (user && profile) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col lg:flex-row">
      {/* Left Branding Panel */}
      <div className="lg:flex-1 bg-ink text-surface p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <div className="flex items-center space-x-4 mb-12">
            <div className="w-16 h-16 bg-white rounded-full p-1 flex items-center justify-center shrink-0">
              <img src="/LGU_LOGO1.png" alt="LGU Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Municipality Of Malungon</h1>
              <p className="text-surface-muted text-sm uppercase tracking-wider font-semibold">Sarangani Province</p>
            </div>
          </div>

          <h2 className="text-4xl font-black mb-6 leading-tight">
            Municipal Asset Management System
          </h2>
          <p className="text-lg text-surface-muted mb-12 leading-relaxed">
            A centralized platform for managing government assets, tracking repair and maintenance requests, and monitoring equipment across all LGU departments.
          </p>

          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Centralized Departments</h3>
                <p className="text-surface-muted">Manage requests across all offices</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Efficient Tracking</h3>
                <p className="text-surface-muted">Real-time status of every equipment repair</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Secure Access</h3>
                <p className="text-surface-muted">Role-based permissions and audit logs</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 mt-16 text-sm text-surface-muted/60">
          Malungon ICT Asset Ticketing System. Created by MO-ICTS © 2026. All rights reserved.
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right Login Panel */}
      <div className="lg:w-[480px] shrink-0 flex flex-col justify-center py-12 px-6 sm:px-12 bg-bg relative">
        <div className="mx-auto w-full max-w-sm">
          <div className="text-center mb-8 lg:hidden">
             <div className="w-20 h-20 mx-auto bg-white rounded-full p-1 flex items-center justify-center shadow-sm mb-4">
              <img src="/LGU_LOGO1.png" alt="LGU Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-ink text-center lg:text-left">
            Office Portal
          </h2>
          <p className="mt-2 text-sm text-ink-muted text-center lg:text-left">
            Sign in to access your dashboard
          </p>
        </div>

        <div className="mt-8 mx-auto w-full max-w-sm">
          <div className="bg-surface py-8 px-6 shadow-sm rounded-2xl border border-border">
            
            {!isSupabaseConfigured && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm flex items-start space-x-3">
                <ServerCrash className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">System Error</p>
                  <p className="mt-1">Authentication service is not configured. Please contact the ICT Office.</p>
                </div>
              </div>
            )}

            {user && !profile && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 text-sm">
                <p className="font-bold">Unregistered Account</p>
                <p className="mt-1">Your account is not registered in the LGU ICT Help Desk System. Please contact the ICT Office.</p>
              </div>
            )}

            <div>
              <button
                onClick={signInWithGoogle}
                disabled={!isSupabaseConfigured}
                className="w-full flex justify-center items-center py-3 px-4 border border-border rounded-xl shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
              <p className="mt-4 text-xs text-center text-ink-muted">
                Official @malungon.gov.ph or ICT-authorized office accounts are allowed.
              </p>
            </div>

            {!isSupabaseConfigured && (
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">Mock Login for Dev</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => mockLogin('employee')} className="px-4 py-2 border border-border rounded-lg text-xs font-bold hover:bg-bg">Mock Employee</button>
                  <button onClick={() => mockLogin('system_admin')} className="px-4 py-2 border border-border rounded-lg text-xs font-bold hover:bg-bg">Mock Admin</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
