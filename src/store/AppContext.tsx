import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Ticket, Asset, Office, ServiceReport, AssetHistory, mockCategories, mockTickets, mockAssets, mockOffices, mockUsers, mockServiceReports, mockAssetHistory } from './mockData';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapAssetFromDB, mapAssetToDB, mapTicketFromDB, mapTicketToDB, mapUserFromDB, mapOfficeFromDB, mapServiceReportFromDB, mapServiceReportToDB, sanitizeDepartmentId, findOfficeForAsset } from '../lib/mappers';
import { toast } from 'sonner';

interface AppContextType {
  currentUser: User | null;
  login: (userId: string) => void;
  logout: () => void;
  tickets: Ticket[];
  createNewTicket: (ticket: any) => void;
  changeTicketStatus: (ticketId: string, status: Ticket['status'], assignedToId?: string) => void;
  updateTicketPriority: (ticketId: string, priority: string) => void;
  addComment: (ticketId: string, text: string) => Promise<void>;
  updateRecommendation: (ticketId: string, recommendation: string) => void;
  users: User[];
  updateUserRole: (userId: string, role: string, departmentId: string | null) => Promise<void>;
  assets: Asset[];
  assetHistories: AssetHistory[];
  createNewAsset: (asset: any) => void;
  updateExistingAsset: (id: string, updates: any) => void;
  offices: Office[];
  createNewOffice: (data: { name: string; officeHead?: string; acronym?: string; email?: string } | string) => Promise<void>;
  updateExistingOffice: (id: string, updates: Partial<Office> | string) => Promise<void>;
  serviceReports: ServiceReport[];
  createServiceReport: (report: Omit<ServiceReport, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ServiceReport | null>;
  updateServiceReport: (id: string, updates: Partial<ServiceReport>) => Promise<void>;
  deleteServiceReport: (id: string) => Promise<void>;
  getNextReportNumber: () => string;
  markReportPrinted: (id: string) => Promise<void>;
  categories: typeof mockCategories;
  authError: string | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>(isSupabaseConfigured ? [] : mockTickets);
  const [assets, setAssets] = useState<Asset[]>(isSupabaseConfigured ? [] : mockAssets);
  const [offices, setOffices] = useState<Office[]>(isSupabaseConfigured ? [] : mockOffices);
  const [users, setUsers] = useState<User[]>(isSupabaseConfigured ? [] : mockUsers);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>(() => {
    try {
      const saved = localStorage.getItem('ict_service_reports');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return isSupabaseConfigured ? [] : mockServiceReports;
  });
  const [assetHistories, setAssetHistories] = useState<AssetHistory[]>(() => {
    try {
      const saved = localStorage.getItem('ict_asset_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return isSupabaseConfigured ? [] : mockAssetHistory;
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const currentUser: User | null = profile ? {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    role: profile.role === 'system_admin' ? 'Admin' : (profile.role === 'ict_support' ? 'ICT Support' : 'Department User'),
    officeId: profile.department_id || undefined
  } : null;

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    
    try {
      const [ticketsRes, assetsRes, officesRes, usersRes] = await Promise.all([
        supabase.from('tickets').select('*, ticket_comments(*)').order('created_at', { ascending: false }),
        supabase.from('assets').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('*').order('name'),
        supabase.from('profiles').select('*')
      ]);

      let currentOffices = officesRes.data && officesRes.data.length > 0 ? officesRes.data.map(mapOfficeFromDB) : mockOffices;

      if (officesRes.data && officesRes.data.length > 0) {
        setOffices(currentOffices);
      } else {
        try {
          const officesToInsert = mockOffices.map(o => ({
            name: o.name,
            office_head: o.officeHead || null,
            acronym: o.acronym || null,
            email: o.email || null
          }));
          const { data: inserted } = await supabase.from('departments').insert(officesToInsert).select();
          if (inserted && inserted.length > 0) {
            currentOffices = inserted.map(mapOfficeFromDB);
            setOffices(currentOffices);
          }
        } catch (e) {
          console.warn('Auto-seed departments note:', e);
        }
      }

      if (ticketsRes.data) setTickets(ticketsRes.data.map(mapTicketFromDB));

      if (assetsRes.data) {
        const rawAssets = assetsRes.data.map(mapAssetFromDB);
        const enrichedAssets = rawAssets.map(ast => {
          const hasDirectMatch = currentOffices.some(o => o.id === ast.officeId);
          if (!hasDirectMatch) {
            const matched = findOfficeForAsset(ast, currentOffices);
            if (matched) {
              if (isSupabaseConfigured && ast.id) {
                supabase.from('assets').update({ department_id: matched.id }).eq('id', ast.id).then();
              }
              return { ...ast, officeId: matched.id };
            }
          }
          return ast;
        });
        setAssets(enrichedAssets);
      } else {
        const enrichedMock = mockAssets.map(ast => {
          const matched = findOfficeForAsset(ast, currentOffices);
          return matched ? { ...ast, officeId: matched.id } : ast;
        });
        setAssets(enrichedMock);
      }

      if (usersRes.data) setUsers(usersRes.data.map(mapUserFromDB));

      // Fetch Service Reports
      try {
        const { data: reportsData, error: reportsError } = await supabase
          .from('service_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (!reportsError && reportsData) {
          const mappedReports = reportsData.map(mapServiceReportFromDB);
          setServiceReports(mappedReports);
          try {
            localStorage.setItem('ict_service_reports', JSON.stringify(mappedReports));
          } catch (e) {}
        }
      } catch (reportsErr) {
        console.warn('service_reports table notice:', reportsErr);
      }

      // Fetch Asset History & Audit Logs
      try {
        const { data: historyData, error: historyError } = await supabase
          .from('asset_history')
          .select('*')
          .order('created_at', { ascending: false });

        if (!historyError && historyData) {
          const mappedHistory: AssetHistory[] = historyData.map((h: any) => ({
            id: h.id,
            assetId: h.asset_id,
            action: h.action,
            changes: h.changes,
            performedBy: h.performed_by,
            performedByName: users.find(u => u.id === h.performed_by)?.name || 'Admin',
            createdAt: h.created_at
          }));
          setAssetHistories(mappedHistory);
          try {
            localStorage.setItem('ict_asset_history', JSON.stringify(mappedHistory));
          } catch (e) {}
        }
      } catch (historyErr) {
        console.warn('asset_history table notice:', historyErr);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data from server.');
    }
  };

  useEffect(() => {
    fetchData();
    
    if (isSupabaseConfigured) {
      const ticketsSub = supabase.channel('tickets-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchData).subscribe();
      const assetsSub = supabase.channel('assets-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, fetchData).subscribe();
      const commentsSub = supabase.channel('comments-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments' }, fetchData).subscribe();
      const reportsSub = supabase.channel('service-reports-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'service_reports' }, fetchData).subscribe();
      const historySub = supabase.channel('asset-history-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'asset_history' }, fetchData).subscribe();
      
      return () => {
        ticketsSub.unsubscribe();
        assetsSub.unsubscribe();
        commentsSub.unsubscribe();
        reportsSub.unsubscribe();
        historySub.unsubscribe();
      };
    }
  }, []);

  const login = (userId: string) => {};
  const logout = async () => { await signOut(); };

  const createNewTicket = async (ticket: any) => {
    if (!isSupabaseConfigured) {
      const newId = `TKT-${Math.floor(Math.random() * 1000)}`;
      setTickets(prev => [{ ...ticket, id: newId, ticketNumber: newId, status: 'NEW', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev]);
      return;
    }
    try {
      let ticketToSave = { ...ticket };
      if (ticketToSave.assetId) {
         ticketToSave.description = `${ticketToSave.description || ''}\n\n<!-- ASSET_ID:${ticketToSave.assetId} -->`;
      }

      const { error } = await supabase.from('tickets').insert(mapTicketToDB(ticketToSave));
      if (error) throw error;
      
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create ticket: ' + error.message);
    }
  };

  const changeTicketStatus = async (ticketId: string, status: Ticket['status'], assignedToId?: string) => {
    if (!isSupabaseConfigured) {
      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) {
          const sysComment = { id: Math.random().toString(), userId: currentUser?.id || '', text: `System: Status changed to ${status}`, createdAt: new Date().toISOString() };
          const historyEntry = { status, timestamp: new Date().toISOString() };
          return { ...t, status, assignedToId: assignedToId || t.assignedToId, comments: [...(t.comments || []), sysComment], statusHistory: [...(t.statusHistory || []), historyEntry] as any };
        }
        return t;
      }));
      return;
    }
    try {
      const updates: any = { status };
      if (assignedToId) updates.assigned_to = assignedToId;
      const { error } = await supabase.from('tickets').update(updates).eq('id', ticketId);
      if (error) throw error;
      
      if (currentUser) {
        await supabase.from('ticket_comments').insert({
          ticket_id: ticketId,
          author_id: currentUser.id,
          content: `System: Status changed to ${status}`
        });
      }
      
      if (status === 'RESOLVED' || status === 'CLOSED') {
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
          // Note: asset_history has been removed
        }
      }
      
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update ticket: ' + error.message);
    }
  };

  const updateTicketPriority = async (ticketId: string, priority: string) => {
    if (!isSupabaseConfigured) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, priority } : t));
      return;
    }
    try {
      const { error } = await supabase.from('tickets').update({ priority }).eq('id', ticketId);
      if (error) throw error;
      
      if (currentUser) {
        await supabase.from('ticket_comments').insert({
          ticket_id: ticketId,
          author_id: currentUser.id,
          content: `System: Priority changed to ${priority}`
        });
      }
      
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update priority: ' + error.message);
    }
  };

  const addComment = async (ticketId: string, text: string) => {
    if (!currentUser) return;
    if (!isSupabaseConfigured) {
      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) {
          const newComment = { id: Math.random().toString(), userId: currentUser.id, text, createdAt: new Date().toISOString() };
          return { ...t, comments: [...(t.comments || []), newComment] };
        }
        return t;
      }));
      return;
    }
    try {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        author_id: currentUser.id,
        content: text
      });
      if (error) throw error;
      fetchData(); // Explicitly fetch to update UI immediately
    } catch (error: any) {
      toast.error('Failed to add comment: ' + error.message);
    }
  };

  const updateRecommendation = async (ticketId: string, recommendation: string) => {
    if (!isSupabaseConfigured) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ictRecommendation: recommendation } : t));
      return;
    }
    try {
      const { error } = await supabase.from('tickets').update({ recommendation }).eq('id', ticketId);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update recommendation: ' + error.message);
    }
  };

  const createNewAsset = async (asset: any) => {
    const assetId = asset.id || 'ast_' + Math.random().toString(36).substring(2, 9);
    const initialHistory: AssetHistory = {
      id: crypto.randomUUID ? crypto.randomUUID() : `ah-${Date.now()}`,
      assetId: assetId,
      action: 'CREATED',
      changes: JSON.stringify({
        performedByName: currentUser?.name || 'Administrator',
        diffs: [
          { field: 'Equipment Registered', from: 'None', to: `${asset.equipmentType} - ${asset.brand} ${asset.model}`.trim() }
        ]
      }),
      performedBy: currentUser?.id,
      performedByName: currentUser?.name || 'Administrator',
      createdAt: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const newAsset = { ...asset, id: assetId };
      setAssets(prev => [newAsset, ...prev]);
      setAssetHistories(prev => {
        const updated = [initialHistory, ...prev];
        try { localStorage.setItem('ict_asset_history', JSON.stringify(updated)); } catch(e){}
        return updated;
      });
      toast.success('Asset created locally.');
      return;
    }
    try {
      const { data, error } = await supabase.from('assets').insert(mapAssetToDB(asset)).select();
      if (error) throw error;

      if (data && data[0]) {
        const remoteHistory: AssetHistory = {
          ...initialHistory,
          assetId: data[0].id
        };
        setAssetHistories(prev => {
          const updated = [remoteHistory, ...prev];
          try { localStorage.setItem('ict_asset_history', JSON.stringify(updated)); } catch(e){}
          return updated;
        });

        try {
          await supabase.from('asset_history').insert({
            asset_id: data[0].id,
            action: 'CREATED',
            changes: remoteHistory.changes,
            performed_by: currentUser?.id || null
          });
        } catch (e) {
          console.warn('asset_history insert notice:', e);
        }
      }
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create asset: ' + error.message);
    }
  };
  
  const updateExistingAsset = async (id: string, updates: any) => {
    const oldAsset = assets.find(a => a.id === id);
    
    // Calculate field diffs
    const diffs: { field: string; from: string; to: string }[] = [];
    const FIELD_LABELS: Record<string, string> = {
      assetCode: 'Asset Code',
      officeId: 'Office / Department',
      equipmentType: 'Equipment Type',
      propertyNumber: 'Property Number',
      inventoryNumber: 'Inventory Number',
      brand: 'Brand',
      model: 'Model',
      serialNumber: 'Serial Number',
      hostname: 'Hostname',
      processor: 'Processor',
      memory: 'Memory (RAM)',
      diskStorage: 'Disk Storage',
      assignedTo: 'Assigned Custodian / End-User',
      exactLocation: 'Exact Location',
      operatingSystem: 'Operating System',
      microsoftOffice: 'Microsoft Office',
      condition: 'Physical Condition',
      operationalStatus: 'Operational Status',
      acquisitionCost: 'Acquisition Cost',
      dateAcquired: 'Date Acquired',
      dateAudited: 'Audit Date',
      auditedBy: 'Audited By',
      remarks: 'Remarks'
    };

    if (oldAsset) {
      for (const key of Object.keys(updates)) {
        if (key === 'history' || key === 'id') continue;
        
        let oldVal = (oldAsset as any)[key] ?? '';
        let newVal = updates[key] ?? '';
        
        // Normalize dates (strip time if compared with YYYY-MM-DD)
        if (typeof oldVal === 'string' && oldVal.includes('T') && typeof newVal === 'string' && !newVal.includes('T')) {
          oldVal = oldVal.split('T')[0];
        }
        
        // Clean office name for officeId
        if (key === 'officeId') {
          const oldOfficeName = offices.find(o => o.id === oldVal)?.name || oldVal;
          const newOfficeName = offices.find(o => o.id === newVal)?.name || newVal;
          if (oldOfficeName !== newOfficeName) {
            diffs.push({
              field: FIELD_LABELS[key] || key,
              from: String(oldOfficeName || 'None'),
              to: String(newOfficeName || 'None')
            });
          }
          continue;
        }

        // Compare stringified values
        if (String(oldVal).trim() !== String(newVal).trim()) {
          diffs.push({
            field: FIELD_LABELS[key] || key,
            from: String(oldVal || 'None'),
            to: String(newVal || 'None')
          });
        }
      }
    }

    const hasAuditFields = diffs.some(d => d.field === 'Audit Date' || d.field === 'Audited By');
    const actionType: 'AUDITED' | 'UPDATED' = hasAuditFields ? 'AUDITED' : 'UPDATED';
    
    // Create new history entry if diffs exist
    let newHistoryEntry: AssetHistory | null = null;
    if (diffs.length > 0) {
      newHistoryEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `ah-${Date.now()}`,
        assetId: id,
        action: actionType,
        changes: JSON.stringify({
          performedByName: currentUser?.name || 'Administrator',
          diffs: diffs
        }),
        performedBy: currentUser?.id,
        performedByName: currentUser?.name || 'Administrator',
        createdAt: new Date().toISOString()
      };
    }

    if (!isSupabaseConfigured) {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      if (newHistoryEntry) {
        setAssetHistories(prev => {
          const updated = [newHistoryEntry!, ...prev];
          try { localStorage.setItem('ict_asset_history', JSON.stringify(updated)); } catch(e){}
          return updated;
        });
      }
      toast.success('Asset updated locally.');
      return;
    }

    try {
      const { error } = await supabase.from('assets').update(mapAssetToDB(updates)).eq('id', id);
      if (error) throw error;
      
      if (newHistoryEntry) {
        // Optimistically update local state & localStorage immediately
        setAssetHistories(prev => {
          const updated = [newHistoryEntry!, ...prev];
          try { localStorage.setItem('ict_asset_history', JSON.stringify(updated)); } catch(e){}
          return updated;
        });

        // Insert into Supabase asset_history with error guard
        try {
          await supabase.from('asset_history').insert({
            asset_id: id,
            action: newHistoryEntry.action,
            changes: newHistoryEntry.changes,
            performed_by: currentUser?.id || null
          });
        } catch (histErr) {
          console.warn('Could not record to remote asset_history table:', histErr);
        }
      }
      
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update asset: ' + error.message);
    }
  };
  
  const updateUserRole = async (userId: string, role: string, departmentId: string | null) => {
    try {
      const sanitizedDeptId = sanitizeDepartmentId(departmentId);
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('profiles')
          .update({ role, department_id: sanitizedDeptId })
          .eq('id', userId);
          
        if (error) throw error;
      }
      
      // Update local state
      setUsers(users.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            role: role === 'system_admin' ? 'Admin' : (role === 'ict_support' ? 'ICT Support' : 'Department User'),
            officeId: departmentId || undefined
          };
        }
        return u;
      }));
      
      toast.success('User updated successfully');
    } catch (err: any) {
      console.error('Error updating user:', err);
      toast.error(err.message || 'Failed to update user');
    }
  };

  const createNewOffice = async (data: { name: string; officeHead?: string; acronym?: string; email?: string } | string) => {
    const officeData = typeof data === 'string' ? { name: data } : data;
    if (!isSupabaseConfigured) {
      const newOffice: Office = {
        id: 'off_' + Math.random().toString(36).substring(2, 9),
        name: officeData.name,
        officeHead: officeData.officeHead,
        acronym: officeData.acronym,
        email: officeData.email
      };
      setOffices(prev => [...prev, newOffice]);
      toast.success('Department created locally.');
      return;
    }
    try {
      const dbPayload = {
        name: officeData.name,
        office_head: officeData.officeHead || null,
        acronym: officeData.acronym || null,
        email: officeData.email || null
      };
      const { error } = await supabase.from('departments').insert(dbPayload);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create department: ' + error.message);
    }
  };
  
  const updateExistingOffice = async (id: string, updates: Partial<Office> | string) => {
    const updateData: Partial<Office> = typeof updates === 'string' ? { name: updates } : updates;
    if (!isSupabaseConfigured) {
      setOffices(prev => prev.map(o => o.id === id ? { ...o, ...updateData } : o));
      toast.success('Department updated locally.');
      return;
    }
    try {
      const dbUpdates: Record<string, any> = {};
      if (updateData.name !== undefined) dbUpdates.name = updateData.name;
      if (updateData.officeHead !== undefined) dbUpdates.office_head = updateData.officeHead || null;
      if (updateData.acronym !== undefined) dbUpdates.acronym = updateData.acronym || null;
      if (updateData.email !== undefined) dbUpdates.email = updateData.email || null;

      const { error } = await supabase.from('departments').update(dbUpdates).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update department: ' + error.message);
    }
  };

  const getNextReportNumber = (): string => {
    const currentYear = new Date().getFullYear();
    const prefix = `TSR-${currentYear}-`;
    let maxSeq = 0;

    serviceReports.forEach(r => {
      if (r.reportNumber && r.reportNumber.startsWith(prefix)) {
        const parts = r.reportNumber.split('-');
        if (parts.length >= 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  };

  const createServiceReport = async (reportData: Omit<ServiceReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceReport | null> => {
    const now = new Date().toISOString();
    const newId = 'sr_' + Math.random().toString(36).substring(2, 9);
    const localReport: ServiceReport = {
      ...reportData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    if (!isSupabaseConfigured) {
      setServiceReports(prev => {
        const next = [localReport, ...prev];
        try { localStorage.setItem('ict_service_reports', JSON.stringify(next)); } catch (e) {}
        return next;
      });
      toast.success(`Service Report ${localReport.reportNumber} generated.`);
      return localReport;
    }

    try {
      const dbPayload = mapServiceReportToDB(reportData);
      const { data, error } = await supabase.from('service_reports').insert(dbPayload).select().single();
      if (error) throw error;
      const created = mapServiceReportFromDB(data);
      setServiceReports(prev => [created, ...prev.filter(r => r.id !== created.id)]);
      try {
        const updatedList = [created, ...serviceReports.filter(r => r.id !== created.id)];
        localStorage.setItem('ict_service_reports', JSON.stringify(updatedList));
      } catch (e) {}
      toast.success(`Service Report ${created.reportNumber} generated.`);
      fetchData();
      return created;
    } catch (err: any) {
      console.warn('Failed to save service report to Supabase, saving locally:', err);
      setServiceReports(prev => {
        const next = [localReport, ...prev];
        try { localStorage.setItem('ict_service_reports', JSON.stringify(next)); } catch (e) {}
        return next;
      });
      toast.success(`Service Report ${localReport.reportNumber} created locally.`);
      return localReport;
    }
  };

  const updateServiceReport = async (id: string, updates: Partial<ServiceReport>) => {
    const now = new Date().toISOString();
    setServiceReports(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: now } : r);
      try { localStorage.setItem('ict_service_reports', JSON.stringify(next)); } catch (e) {}
      return next;
    });

    if (isSupabaseConfigured && !id.startsWith('sr_')) {
      try {
        const dbUpdates = mapServiceReportToDB(updates);
        const { error } = await supabase.from('service_reports').update({ ...dbUpdates, updated_at: now }).eq('id', id);
        if (error) throw error;
        toast.success('Service Report updated.');
        fetchData();
      } catch (err: any) {
        console.error('Error updating report in DB:', err);
        toast.error('Failed to update service report on server.');
      }
    } else {
      toast.success('Service Report updated.');
    }
  };

  const deleteServiceReport = async (id: string) => {
    setServiceReports(prev => {
      const next = prev.filter(r => r.id !== id);
      try { localStorage.setItem('ict_service_reports', JSON.stringify(next)); } catch (e) {}
      return next;
    });

    if (isSupabaseConfigured && !id.startsWith('sr_')) {
      try {
        const { error } = await supabase.from('service_reports').delete().eq('id', id);
        if (error) throw error;
        toast.success('Service Report deleted.');
        fetchData();
      } catch (err: any) {
        console.error('Error deleting report from DB:', err);
        toast.error('Failed to delete report on server.');
      }
    } else {
      toast.success('Service Report deleted.');
    }
  };

  const markReportPrinted = async (id: string) => {
    const now = new Date().toISOString();
    await updateServiceReport(id, { printedAt: now, reportStatus: 'Reviewed' });
  };

  return (
    <AppContext.Provider value={{
      currentUser, login, logout, tickets, createNewTicket, changeTicketStatus, updateTicketPriority, addComment, updateRecommendation,
      users, updateUserRole, assets, assetHistories, createNewAsset, updateExistingAsset, offices, createNewOffice, updateExistingOffice,
      serviceReports, createServiceReport, updateServiceReport, deleteServiceReport, getNextReportNumber, markReportPrinted,
      categories: mockCategories, authError, theme, toggleTheme
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
