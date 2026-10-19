import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { mockUsers } from './mockData';

export type Role = 'system_admin' | 'ict_support' | 'employee';

// Explicitly approved non-@malungon.gov.ph office accounts mapped to department IDs
export const SPECIAL_OFFICE_ACCOUNTS: Record<string, string> = {
  'lubatonaganmarygrace@gmail.com': 'a0000000-0000-0000-0000-000000000019', // Mayor's Office - Sports and Youth Hall Section
};

export const isAllowedOfficeEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  return normalized.endsWith('@malungon.gov.ph') || Boolean(SPECIAL_OFFICE_ACCOUNTS[normalized]);
};

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  department_id: string | null;
  status: 'active' | 'inactive' | 'suspended';
  avatar_url?: string;
}

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  mockLogin: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSessionAndProfile = async (currentSession: Session | null) => {
    setSession(currentSession);
    const currentUser = currentSession?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      await fetchProfile(currentUser);
    } else {
      setProfile(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkSessionAndProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkSessionAndProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

    const fetchProfile = async (currentUser: SupabaseUser) => {
    try {
      const userEmail = currentUser.email?.toLowerCase().trim() || '';
      const isMalungonDomain = userEmail.endsWith('@malungon.gov.ph');
      const isGmail = userEmail.endsWith('@gmail.com');
      const isSpecialOfficeAccount = Boolean(SPECIAL_OFFICE_ACCOUNTS[userEmail]);
      const isAuthorizedOfficeEmail = isAllowedOfficeEmail(userEmail);

      // 1. Fetch existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      // CASE A: User already has a profile
      if (data) {
        // RULE: Office / Department employees CANNOT use personal Gmail accounts unless authorized
        if (data.role === 'employee' && !isAuthorizedOfficeEmail) {
          toast.error('Office accounts must use an official @malungon.gov.ph email or an ICT-authorized office account. Personal Gmail accounts are not permitted.');
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // If this is a special office account but department_id is missing or out of sync, update it
        if (isSpecialOfficeAccount && (!data.department_id || data.department_id !== SPECIAL_OFFICE_ACCOUNTS[userEmail])) {
          const targetDeptId = SPECIAL_OFFICE_ACCOUNTS[userEmail];
          await supabase
            .from('profiles')
            .update({ department_id: targetDeptId })
            .eq('id', currentUser.id);
          data.department_id = targetDeptId;
        }

        // Ensure primary system admin role
        if (userEmail === 'systems@malungon.gov.ph' && data.role !== 'system_admin') {
          const { data: updatedData } = await supabase
            .from('profiles')
            .update({ role: 'system_admin' })
            .eq('id', currentUser.id)
            .select()
            .single();
          setProfile(updatedData || { ...data, role: 'system_admin' });
        } else {
          setProfile(data);
        }
        return;
      }

      // CASE B: First-time sign in (no profile yet)
      if (error) {
        if (error.code === 'PGRST116') {
          // Check if pre-assigned by Admin in user_invitations
          const { data: invitation } = await supabase
            .from('user_invitations')
            .select('*')
            .eq('email', userEmail)
            .single();

          let assignedRole: Role = invitation ? invitation.role : 'employee';
          let assignedDept = invitation ? invitation.department_id : null;
          const isInvited = Boolean(invitation);

          if (userEmail === 'systems@malungon.gov.ph') {
            assignedRole = 'system_admin';
          }

          // Auto-link department for registered special office accounts
          if (!assignedDept && isSpecialOfficeAccount) {
            assignedDept = SPECIAL_OFFICE_ACCOUNTS[userEmail];
            assignedRole = 'employee';
          }

          // Auto-link department if email matches an official office email in departments table
          if (!assignedDept && isAuthorizedOfficeEmail) {
            const { data: deptMatch } = await supabase
              .from('departments')
              .select('id')
              .eq('email', userEmail)
              .single();
            if (deptMatch) {
              assignedDept = deptMatch.id;
            }
          }

          // RULE 1: Office / Employee accounts MUST use @malungon.gov.ph or be an authorized office exception
          if (assignedRole === 'employee' && !isAuthorizedOfficeEmail) {
            toast.error('Office accounts must use an official @malungon.gov.ph email or an ICT-authorized office account. Personal Gmail accounts are not permitted.');
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          // RULE 2: Gmail is ONLY permitted if pre-assigned as ICT Support/Admin OR an authorized office exception
          if (isGmail && assignedRole !== 'ict_support' && assignedRole !== 'system_admin' && !isSpecialOfficeAccount) {
            toast.error('This Gmail account is not recognized as authorized ICT Support or an authorized office account. Please contact the administrator.');
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          // Create the profile
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: currentUser.id,
              email: userEmail,
              full_name: currentUser.user_metadata?.full_name || userEmail.split('@')[0] || 'New User',
              role: assignedRole,
              department_id: assignedDept,
              status: 'active'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Failed to create fallback profile:', insertError);
            toast.error('Your profile was not found and could not be created automatically. Make sure the database schema is fully deployed.');
          } else {
            setProfile(newProfile);
            if (isInvited && invitation) {
              await supabase.from('user_invitations').delete().eq('id', invitation.id);
            }
          }
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error(error.message || 'Error loading profile. Check if the database schema is correctly deployed.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Supabase not configured. Use mock login below.');
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account'
          }
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase not configured.') };
    }
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setProfile(null);
      toast.success('Logged out successfully');
      return;
    }
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const mockLogin = (role: Role) => {
    const mockProfile: Profile = {
      id: 'mock-' + role,
      email: role + '@malungon.gov.ph',
      full_name: role === 'system_admin' ? 'Mock Admin' : role === 'ict_support' ? 'Mock ICT' : 'Mock Employee',
      role: role,
      department_id: role === 'employee' ? 'off-1' : null,
      status: 'active'
    };
    setUser({ id: mockProfile.id, email: mockProfile.email } as SupabaseUser);
    setProfile(mockProfile);
    toast.success('Mock login successful');
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signInWithGoogle, signInWithEmail, signOut, mockLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
