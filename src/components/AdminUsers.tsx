import React, { useState } from 'react';
import { Building2, Plus, Edit2, Mail, Check, X, Shield, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '../store/AppContext';
import { Role } from '../store/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export function AdminUsers() {
  const { offices, users, updateUserRole } = useAppContext();
  const [isInviting, setIsInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'ict_support' as Role,
    departmentId: '',
    status: 'active'
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;

    try {
      const { error } = await supabase.from('user_invitations').insert({
        email: formData.email,
        role: formData.role,
        department_id: formData.departmentId || null
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('An invitation for this email already exists.');
        } else {
          throw error;
        }
      } else {
        toast.success(`User pre-assigned successfully! Have them log in using Continue with Google.`);
        setIsInviting(false);
        setFormData({
          fullName: '',
          email: '',
          role: 'ict_support',
          departmentId: '',
          status: 'active'
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invitation');
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-2">
        <div>
          <h1 className="font-black text-[2.75rem] leading-none tracking-tighter mb-3 text-ink">
            User Management
          </h1>
          <p className="text-ink-muted text-sm font-medium tracking-wide">
            Access control and department assignments
          </p>
        </div>
        {!isInviting && (
          <button 
            onClick={() => setIsInviting(true)}
            className="flex items-center gap-2.5 bg-accent text-white px-5 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-sm hover:opacity-90 transition-all active:scale-95 border-none"
          >
            <Plus className="w-4 h-4" />
            <span>Pre-assign Role</span>
          </button>
        )}
      </section>

      {/* Invite Form */}
      {isInviting && (
        <div className="bg-surface border border-border p-8 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-8 border-b border-border pb-5">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center shadow-sm">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-ink text-lg tracking-tight">Pre-assign Role</h3>
                <p className="text-sm font-medium text-ink-muted mt-1">Assign a role before the user logs in for the first time.</p>
              </div>
            </div>
            <button 
              onClick={() => setIsInviting(false)}
              className="p-2 text-ink-muted hover:bg-bg hover:text-ink rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleInvite} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  placeholder="Juan Dela Cruz"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  placeholder="ict.support1@gmail.com"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Role</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as Role})}
                    className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none transition-all cursor-pointer"
                  >
                    <option value="employee">Department User (Office Staff)</option>
                    <option value="ict_support">ICT Support</option>
                    <option value="system_admin">System Admin</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Department (Optional)</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                    className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none transition-all cursor-pointer"
                  >
                    <option value="">Select Department</option>
                    {offices.map(office => (
                      <option key={office.id} value={office.id}>{office.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none transition-all cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-border mt-8 gap-3">
              <button
                type="button"
                onClick={() => setIsInviting(false)}
                className="px-5 py-2.5 border border-border bg-surface text-ink-muted rounded-xl hover:bg-bg hover:text-ink text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-accent text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-sm flex items-center space-x-2 active:scale-95"
              >
                <Mail className="w-4 h-4" />
                <span>Assign Role</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <div className="bg-surface border border-border p-8 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-8 border-b border-border pb-5">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center shadow-sm">
                <Edit2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-ink text-lg tracking-tight">Edit User Role</h3>
                <p className="text-sm font-medium text-ink-muted mt-1">Update role and department for <span className="font-bold text-ink">{editingUser.name}</span></p>
              </div>
            </div>
            <button 
              onClick={() => setEditingUser(null)}
              className="p-2 text-ink-muted hover:bg-bg hover:text-ink rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            await updateUserRole(editingUser.id, editingUser.rawRole, editingUser.departmentId);
            setEditingUser(null);
          }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Role</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                  <select
                    value={editingUser.rawRole}
                    onChange={(e) => setEditingUser({...editingUser, rawRole: e.target.value})}
                    className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none transition-all cursor-pointer"
                  >
                    <option value="employee">Department User</option>
                    <option value="ict_support">ICT Support</option>
                    <option value="system_admin">System Admin</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Department</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                  <select
                    value={editingUser.departmentId || ''}
                    onChange={(e) => setEditingUser({...editingUser, departmentId: e.target.value || null})}
                    className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none transition-all cursor-pointer"
                  >
                    <option value="">No Department</option>
                    {offices.map(office => (
                      <option key={office.id} value={office.id}>{office.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-6 border-t border-border mt-8 gap-3">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-5 py-2.5 border border-border bg-surface text-ink-muted rounded-xl hover:bg-bg hover:text-ink text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-accent text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-sm flex items-center space-x-2 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-bg/50">
          <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest flex items-center gap-3">
            <div className="w-2 h-4 bg-accent rounded-[1px]"></div>
            Registered Accounts
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-surface border-b border-border">
              <tr className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
                <th className="px-6 py-4 font-bold">User</th>
                <th className="px-6 py-4 font-bold">Role</th>
                <th className="px-6 py-4 font-bold">Department</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {users.map(user => {
                const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
                const officeName = offices.find(o => o.id === user.officeId)?.name || 'N/A';
                
                return (
                  <tr key={user.id} className="hover:bg-bg/50 transition-colors group border-b border-border group-last:border-none">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center font-bold text-[13px] text-accent shadow-sm">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-ink text-[14px]">{user.name}</div>
                          <div className="text-[12px] font-medium text-ink-muted mt-0.5">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2.5 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest rounded-md border border-accent/20">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-ink-muted text-[13px] font-medium">
                      {officeName}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                        <span className="text-[11px] uppercase tracking-widest font-bold text-ink">Active</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => {
                          const rawRole = user.role === 'Admin' ? 'system_admin' : (user.role === 'ICT Support' ? 'ict_support' : 'employee');
                          setEditingUser({ ...user, rawRole, departmentId: user.officeId });
                        }}
                        className="text-ink-muted hover:text-accent transition-colors p-2 opacity-0 group-hover:opacity-100 hover:bg-accent/10 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
