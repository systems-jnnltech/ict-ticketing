import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { RESOLUTION_OPTIONS, Ticket, getTicketResolution } from '../store/mockData';
import { ArrowLeft, Clock, User, Monitor, AlertCircle, CheckCircle2, Send, Activity, X, ExternalLink, FileText, Printer, Eye, History, ShieldCheck, Database, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
import { getTicketSLA } from '../utils/sla';
import { Toast, ConfirmModal } from '../lib/toast';
import Swal from 'sweetalert2';
import { DispatchFormModal } from './DispatchFormModal';
import { ServiceReportModal } from './ServiceReportModal';

export function TicketDetail({ ticketId, onBack }: { ticketId: string, onBack: () => void }) {
  const { tickets, users, assets, offices, categories, currentUser, changeTicketStatus, updateTicketPriority, addComment, updateRecommendation, serviceReports, assetHistories } = useAppContext();
  const ticket = tickets.find(t => t.id === ticketId);
  const department = offices.find(o => o.id === ticket?.officeId);
  
  const [selectedAssignee, setSelectedAssignee] = useState(ticket?.assignedToId || '');
  const [newCommentText, setNewCommentText] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
  const [isEditingRecommendation, setIsEditingRecommendation] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showServiceReportModal, setShowServiceReportModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState('Repaired');
  const [resolveActionTaken, setResolveActionTaken] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [referralData, setReferralData] = useState({
    reason: 'Hardware repair requires specialized technician',
  });
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'service' | 'discussion'>('all');

  const handleReferralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    
    // Change ticket status to REFERRED
    changeTicketStatus(ticket.id, 'REFERRED', ticket.assignedToId);
    
    // Log system action
    const commentText = `Referred to External Technician\nReason: ${referralData.reason}`;
    
    addComment(ticket.id, commentText);
    
    setShowReferralModal(false);
    Toast.fire({ icon: 'success', title: 'Ticket Referred to External Technician' });
  };
  
  React.useEffect(() => {
    if (ticket && ticket.assignedToId) {
      setSelectedAssignee(ticket.assignedToId);
    }
  }, [ticket?.assignedToId]);

  if (!ticket) return null;

  const requester = users.find(u => u.id === ticket.requesterId);
  const assignee = users.find(u => u.id === ticket.assignedToId);
  const asset = assets.find(a => a.id === ticket.assetId || a.assetCode === ticket.assetId);
  const assetOffice = offices.find(o => o.id === asset?.officeId) || department;
  const category = categories.find(c => c.id === ticket.categoryId);
  const ictStaff = users.filter(u => u.role === 'ICT Support');

  const relatedTickets = asset ? tickets.filter((t) => t.assetId === asset.id || (asset.assetCode && t.assetId === asset.assetCode)) : [];
  const pastTicketsCount = relatedTickets.filter(t => t.id !== ticket.id).length;
  const relatedHistories = asset ? (assetHistories || []).filter((h) => h.assetId === asset.id) : [];

  const combinedTimeline = [
    ...relatedTickets.map((t) => ({
      id: `ticket-${t.id}`,
      type: 'ticket' as const,
      date: new Date(t.createdAt).getTime(),
      ticket: t
    })),
    ...relatedHistories.map((h) => ({
      id: `history-${h.id}`,
      type: 'audit' as const,
      date: new Date(h.createdAt).getTime(),
      history: h
    }))
  ].sort((a, b) => b.date - a.date);

  const isAdminOrICT = currentUser?.role === 'Admin' || currentUser?.role === 'ICT Support';
  const hasReferralDetails = ticket.status === 'REFERRED' || (ticket.comments || []).some(c => c.text.includes('referred to external technician') || c.text.includes('DISPATCH_INFO'));
  const existingServiceReport = serviceReports?.find(r => r.ticketId === ticket.id);
  const isTicketCompleted = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const isICTSupport = currentUser?.role === 'ICT Support';
  const isWorkNotStarted = isICTSupport && (ticket.status === 'NEW' || ticket.status === 'ASSIGNED');

  // Filter helper to exclude system status changes and hidden dispatch JSON metadata
  const isPublicDiscussionComment = (c: { text: string }) => 
    !c.text.startsWith('System: Status changed to') && !c.text.includes('DISPATCH_INFO');

  // Helper to extract specific resolution outcome (e.g. For Equipment Replacement) with semantic styling
  const getTicketResolutionMeta = (t: Ticket) => getTicketResolution(t, serviceReports);

  // Unified events list for current ticket in Service & Activity Timeline
  const currentTicketEvents = React.useMemo(() => {
    const events: Array<{
      id: string;
      type: 'created' | 'action' | 'comment' | 'ict_action' | 'problem_report' | 'manual_escalation' | 'referral' | 'service_report' | 'resolved';
      date: number;
      data: any;
    }> = [];

    // 1. Ticket Created Node
    events.push({
      id: `created-${ticket.id}`,
      type: 'created',
      date: new Date(ticket.createdAt).getTime(),
      data: {
        createdAt: ticket.createdAt,
        requesterName: requester?.name,
        departmentName: department?.name
      }
    });

    // 2. Comments and Actions from ticket.comments
    (ticket.comments || []).filter(isPublicDiscussionComment).forEach((c) => {
      const isAction = c.text.startsWith('Action:');
      const rawText = isAction ? c.text.replace('Action: ', '') : c.text;
      const displayText = rawText.replace(/<!--[\s\S]*?-->/g, '').trim();
      const commentUser = users.find(u => u.id === c.userId);

      if (c.text.includes('Problem Still Exists Report:')) {
        const reasonMatch = c.text.match(/Reason: (.*)/);
        const detailsMatch = c.text.match(/Details: (.*)/);
        const isEscalation = c.text.includes('escalated to ICT Head') || c.text.includes('Escalated');
        events.push({
          id: `problem-${c.id}`,
          type: 'problem_report',
          date: new Date(c.createdAt).getTime(),
          data: {
            comment: c,
            dateStr: format(new Date(c.createdAt), "MMM d, yyyy • h:mm a"),
            reason: reasonMatch ? reasonMatch[1] : 'Unknown',
            details: detailsMatch ? detailsMatch[1] : '',
            isEscalation,
            text: c.text
          }
        });
      } else if (c.text.startsWith('Referred to External Technician')) {
        events.push({
          id: `referral-${c.id}`,
          type: 'referral',
          date: new Date(c.createdAt).getTime(),
          data: {
            comment: c,
            dateStr: format(new Date(c.createdAt), "MMM d, yyyy • h:mm a"),
            text: displayText
          }
        });
      } else if (isAction) {
        let actionDisplayText = displayText;
        const lower = displayText.toLowerCase();
        if (
          lower.includes('marked ticket as') ||
          lower.includes('repaired / resolved') ||
          lower.includes('resolved') ||
          lower.includes('repaired') ||
          c.text.includes('<!-- RESOLUTION:')
        ) {
          const resFromComment = c.text.match(/<!-- RESOLUTION:\s*(.+?)\s*-->/)?.[1]?.trim();
          const resFromText = displayText.match(/Marked ticket as Resolved:\s*([^\n]+)/i)?.[1]?.trim()
            || displayText.match(/Marked ticket as\s*([^\n]+)/i)?.[1]?.trim();
          const cleanResFromText = resFromText && !resFromText.toLowerCase().includes('repaired / resolved') ? resFromText : undefined;
          
          const targetCategory = resFromComment || cleanResFromText || getTicketResolutionMeta(ticket)?.category;
          
          if (targetCategory) {
            const targetLabel = targetCategory.toLowerCase() === 'repaired'
              ? 'Marked ticket as Repaired'
              : `Marked ticket as ${targetCategory}`;
            
            const actionTakenMatch = displayText.match(/Action Taken:\s*([\s\S]+)/i);
            if (actionTakenMatch) {
              actionDisplayText = `${targetLabel}\nAction Taken: ${actionTakenMatch[1].trim()}`;
            } else {
              actionDisplayText = targetLabel;
            }
          } else if (displayText.includes('Marked ticket as Repaired / Resolved')) {
            actionDisplayText = displayText.replace('Marked ticket as Repaired / Resolved', 'Marked ticket as Resolved');
          }
        }

        events.push({
          id: `action-${c.id}`,
          type: 'action',
          date: new Date(c.createdAt).getTime(),
          data: {
            comment: c,
            user: commentUser,
            text: actionDisplayText
          }
        });
      } else {
        events.push({
          id: `comment-${c.id}`,
          type: 'comment',
          date: new Date(c.createdAt).getTime(),
          data: {
            comment: c,
            user: commentUser,
            text: displayText,
            isOwn: c.userId === currentUser?.id
          }
        });
      }
    });

    // 3. Troubleshooting Attempts from ticket.ictRecommendation
    const actions = ticket.ictRecommendation ? ticket.ictRecommendation.split(/(?=Taken \d+:)/).filter(Boolean) : [];
    actions.forEach((act, idx) => {
      const match = act.match(/Taken (\d+):\s+(.*?)\s+by:\s+(.*?)\n(.*)/s);
      if (match) {
        const parsedDate = new Date(match[2]).getTime();
        events.push({
          id: `ict-action-${idx}`,
          type: 'ict_action',
          date: isNaN(parsedDate) ? new Date(ticket.updatedAt).getTime() : parsedDate,
          data: {
            attemptNumber: match[1],
            dateStr: match[2],
            by: match[3],
            text: match[4].trim()
          }
        });
      } else {
        events.push({
          id: `ict-action-${idx}`,
          type: 'ict_action',
          date: new Date(ticket.updatedAt).getTime(),
          data: {
            attemptNumber: `${idx + 1}`,
            dateStr: '',
            by: 'ICT Support',
            text: act.trim()
          }
        });
      }
    });

    // 4. Manual Escalations
    const problemReports = ticket.comments?.filter(c => c.text.includes('Problem Still Exists Report:')) || [];
    const escalatedLog = ticket.comments?.find(c => c.text === 'System: Status changed to ESCALATED' || (c.text.includes('Escalated') && !c.text.includes('Problem Still Exists Report:')));
    if (escalatedLog && !problemReports.some(pr => Math.abs(new Date(pr.createdAt).getTime() - new Date(escalatedLog.createdAt).getTime()) < 5000)) {
      events.push({
        id: `escalation-${escalatedLog.id}`,
        type: 'manual_escalation',
        date: new Date(escalatedLog.createdAt).getTime(),
        data: {
          dateStr: format(new Date(escalatedLog.createdAt), "MMM d, yyyy • h:mm a")
        }
      });
    }

    // 5. Service Reports
    (serviceReports || []).filter(r => r.ticketId === ticket.id).forEach(r => {
      events.push({
        id: `tsr-${r.id}`,
        type: 'service_report',
        date: new Date(r.createdAt).getTime(),
        data: { report: r }
      });
    });

    // 6. Resolved / Closed Node
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      const res = getTicketResolutionMeta(ticket);
      events.push({
        id: `resolved-${ticket.id}`,
        type: 'resolved',
        date: new Date(ticket.updatedAt).getTime(),
        data: {
          status: ticket.status,
          updatedAt: ticket.updatedAt,
          res
        }
      });
    }

    return events.sort((a, b) => a.date - b.date);
  }, [ticket, requester, department, users, currentUser, serviceReports]);

  const filteredEvents = React.useMemo(() => {
    if (timelineFilter === 'service') {
      return currentTicketEvents.filter(e => 
        e.type === 'created' || 
        e.type === 'ict_action' || 
        e.type === 'problem_report' || 
        e.type === 'manual_escalation' || 
        e.type === 'referral' || 
        e.type === 'service_report' || 
        e.type === 'resolved'
      );
    }
    if (timelineFilter === 'discussion') {
      return currentTicketEvents.filter(e => 
        e.type === 'comment' || 
        e.type === 'action'
      );
    }
    return currentTicketEvents;
  }, [currentTicketEvents, timelineFilter]);

  const pastRecords = React.useMemo(() => {
    return combinedTimeline.filter(item => !(item.type === 'ticket' && item.ticket?.id === ticket.id));
  }, [combinedTimeline, ticket.id]);

  const handleAssign = async () => {
    if (selectedAssignee) {
      const result = await ConfirmModal.fire({
        text: 'Are you sure you want to assign this ticket?'
      });
      if (result.isConfirmed) {
        changeTicketStatus(ticket.id, 'ASSIGNED', selectedAssignee);
        const assignedUser = users.find(u => u.id === selectedAssignee);
        addComment(ticket.id, `Action: Assigned ticket to ${assignedUser?.name}`);
        Toast.fire({ icon: 'success', title: 'Ticket assigned successfully' });
      }
    }
  };

  const handleStatusUpdate = async (newStatus: any, actionDesc?: string) => {
    const result = await ConfirmModal.fire({
      text: `Are you sure you want to change status to ${newStatus}?`
    });
    if (result.isConfirmed) {
      changeTicketStatus(ticket.id, newStatus, ticket.assignedToId);
      if (actionDesc) {
        addComment(ticket.id, `Action: ${actionDesc}`);
      }
      Toast.fire({ icon: 'success', title: `Status updated to ${newStatus}` });
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTicketCompleted || isWorkNotStarted) return;
    if (newCommentText.trim()) {
      addComment(ticket.id, newCommentText.trim());
      setNewCommentText('');
      Toast.fire({ icon: 'success', title: 'Comment added' });
    }
  };

  const handleUpdateRecommendation = () => {
    if (!recommendationText.trim()) return;
    const existing = ticket.ictRecommendation || '';
    const occurrences = (existing.match(/Taken \d+:/g) || []).length;
    const nextNum = occurrences + 1;
    
    const timestampStr = format(new Date(), 'MMM d, yyyy h:mm a');
    const roleName = currentUser?.role === 'Admin' ? 'ICT Head' : 'ICT Support';
    const header = `Taken ${nextNum}: ${timestampStr} by: ${roleName} (${currentUser?.name || 'Unknown'})`;
    const newEntry = `${header}\n${recommendationText.trim()}`;
    const combined = existing ? `${existing}\n\n${newEntry}` : newEntry;

    updateRecommendation(ticket.id, combined);
    setIsEditingRecommendation(false);
    setRecommendationText('');
    Toast.fire({ icon: 'success', title: 'Recommendation added' });
  };

  const handleConfirmResolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ticket) return;
    setIsResolving(true);
    try {
      changeTicketStatus(ticket.id, 'RESOLVED', ticket.assignedToId);
      
      const resLabel = selectedResolution.toLowerCase() === 'repaired'
        ? 'Marked ticket as Repaired'
        : `Marked ticket as ${selectedResolution}`;
        
      const actionText = resolveActionTaken.trim()
        ? `Action: ${resLabel}\nAction Taken: ${resolveActionTaken.trim()}\n<!-- RESOLUTION: ${selectedResolution} -->\n<!-- ACTION_TAKEN: ${resolveActionTaken.trim()} -->`
        : `Action: ${resLabel}\n<!-- RESOLUTION: ${selectedResolution} -->`;
      
      await addComment(ticket.id, actionText);
      setShowResolveModal(false);
      setResolveActionTaken('');
      Toast.fire({ icon: 'success', title: `Ticket marked as Resolved (${selectedResolution})` });
    } catch (err: any) {
      Toast.fire({ icon: 'error', title: 'Failed to resolve ticket' });
    } finally {
      setIsResolving(false);
    }
  };

  const inProgressCount = ticket.comments?.filter(c => c.text === 'System: Status changed to IN PROGRESS').length || 0;
  const escalatedCount = ticket.comments?.filter(c => c.text === 'System: Status changed to ESCALATED').length || 0;
  const referredCount = ticket.comments?.filter(c => c.text === 'System: Status changed to REFERRED').length || 0;
  
  const occurrences = (ticket.ictRecommendation || '').match(/Taken \d+:/g)?.length || 0;
  
  const hasBeenEscalated = ticket.status === 'ESCALATED' || 
      (ticket.statusHistory || []).some(h => h.status === 'ESCALATED') ||
      (ticket.comments || []).some(c => c.text.includes('Escalated'));
  
  const totalActionableTransitions = inProgressCount + escalatedCount + referredCount;
  const isActionable = ['IN PROGRESS', 'ESCALATED', 'REFERRED'].includes(ticket.status);
  
  const allowedRecommendations = Math.max(totalActionableTransitions, isActionable ? 1 : 0);
  
  const isAdmin = currentUser?.role === 'Admin';
  
  const hasUnusedCycle = occurrences < allowedRecommendations;
  const isAuthorized = (isICTSupport && ticket.assignedToId === currentUser.id) || isAdmin;
  const canAddRecommendation = isAuthorized && hasUnusedCycle && isActionable;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-16">
      <header className="flex flex-col gap-2">
        <button onClick={onBack} className="flex items-center space-x-2 text-ink-muted hover:text-ink transition-colors text-[11px] font-bold uppercase tracking-widest w-fit mb-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets</span>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold text-accent bg-accent/10 px-3 py-1 rounded-md border border-accent/20 font-mono tracking-wider">
            {ticket.ticketNumber}
          </span>
          <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
            ticket.status === 'CLOSED' ? 'bg-surface text-ink-muted border-border' : 
            ticket.status === 'RESOLVED' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
            'bg-orange-500/10 text-orange-500 border-orange-500/20'
          }`}>
              {ticket.status}
          </span>
          <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
            ticket.priority === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
            ticket.priority === 'High' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
            'bg-amber-500/10 text-amber-500 border-amber-500/20'
          }`}>
              {ticket.priority} Priority
          </span>
          {(() => {
            const sla = getTicketSLA(ticket);
            let bg = 'bg-green-500/10 text-green-500 border-green-500/20';
            if (sla.isClosed) {
              bg = sla.isBreached ? 'bg-red-500/10 text-red-500 border-red-500/20' : bg;
            } else {
              if (sla.isBreached) bg = 'bg-red-500/10 text-red-500 border-red-500/20';
              else if (sla.remainingMin < 60) bg = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            }
            return (
              <span className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest font-mono border ${bg}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{sla.label}</span>
              </span>
            );
          })()}
        </div>
        <h1 className="text-[2.75rem] font-black text-ink tracking-tight leading-tight mt-4">
            {asset ? `${asset.equipmentType} - ${asset.brand} ${asset.model} (${ticket.subject})` : ticket.subject}
        </h1>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Main Narrative Column */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Problem Description */}
          <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="px-6 py-5 border-b border-border bg-bg/50">
                  <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-ink-muted" />
                    Problem Description
                  </h3>
              </div>
              <div className="p-8">
                  <p className="text-sm text-ink-muted font-medium whitespace-pre-wrap leading-relaxed max-w-4xl">{ticket.description}</p>
              </div>
          </div>

          {/* ICT Recommendation */}
          {(ticket.ictRecommendation || 
            (currentUser?.role === 'ICT Support' && ticket.assignedToId === currentUser.id && ['IN PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED', 'REFERRED'].includes(ticket.status)) ||
            (currentUser?.role === 'Admin' && ['ESCALATED', 'REFERRED'].includes(ticket.status))
          ) && (
              <div className="bg-surface rounded-2xl shadow-sm border border-orange-500/30 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                  <div className="px-6 py-5 border-b border-orange-500/20 bg-orange-500/5 flex justify-between items-center pl-8">
                      <h3 className="text-[11px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        ICT Action / Recommendation
                      </h3>
                      {canAddRecommendation && !isEditingRecommendation && (
                          <button 
                              onClick={() => {
                                  setRecommendationText('');
                                  setIsEditingRecommendation(true);
                              }} 
                              className="text-[10px] font-bold uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors bg-orange-500/10 px-3 py-1.5 rounded-md"
                          >
                              Add Update
                          </button>
                      )}
                  </div>
                  <div className="p-8 pl-9">
                      <div className="mb-6">
                          <p className="text-sm font-medium text-ink whitespace-pre-wrap leading-relaxed max-w-4xl">
                              {ticket.ictRecommendation ? ticket.ictRecommendation : <span className="text-orange-500/60 italic">No action or recommendation recorded yet.</span>}
                          </p>
                      </div>
                      
                      {isEditingRecommendation && (
                          <div className="space-y-4 pt-6 border-t border-border">
                              <textarea 
                                  className="w-full p-4 bg-bg border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 min-h-[120px] resize-none shadow-sm"
                                  placeholder="Detail the actions taken or recommended repairs..."
                                  value={recommendationText}
                                  onChange={(e) => setRecommendationText(e.target.value)}
                              />
                              <div className="flex justify-end gap-3">
                                  <button 
                                      onClick={() => setIsEditingRecommendation(false)} 
                                      className="px-5 py-2.5 bg-bg border border-border text-ink-muted rounded-xl text-[11px] font-bold uppercase tracking-widest hover:text-ink transition-colors shadow-sm"
                                  >
                                      Cancel
                                  </button>
                                  <button 
                                      onClick={handleUpdateRecommendation}
                                      disabled={!recommendationText.trim()}
                                      className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-colors shadow-md"
                                  >
                                      Save Update
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}
          
          {/* Service & Activity Timeline */}
          <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Card Header */}
            <div className="px-6 py-5 border-b border-border bg-bg/50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-bg border border-border text-accent flex items-center justify-center shadow-xs shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest flex items-center gap-2">
                    Service & Activity Timeline
                  </h3>
                  {asset ? (
                    <p className="text-[11px] text-ink-muted font-medium mt-0.5">
                      {asset.equipmentType} - {asset.brand} {asset.model} {asset.propertyNumber ? `• Property: ${asset.propertyNumber}` : asset.assetCode ? `• Code: ${asset.assetCode}` : ''}
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink-muted font-medium mt-0.5">
                      No linked equipment
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter Pills */}
                <div className="flex items-center bg-bg p-0.5 rounded-lg border border-border text-[10px] font-bold uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${timelineFilter === 'all' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'}`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('service')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${timelineFilter === 'service' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'}`}
                  >
                    Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('discussion')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${timelineFilter === 'discussion' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'}`}
                  >
                    Discussion
                  </button>
                </div>

                {/* View Technician Details Button - Only visible for Admin and ICT Support roles */}
                {isAdminOrICT && hasReferralDetails && (
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(true)}
                    className="text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-600 border border-purple-500/20 hover:bg-purple-500/20 px-3 py-1 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Tech Details
                  </button>
                )}

                {asset && (
                  <button
                    type="button"
                    onClick={() => setShowAssetModal(true)}
                    className="text-[10px] font-bold uppercase tracking-widest bg-bg border border-border hover:border-accent text-accent px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="View asset specifications"
                  >
                    <span>Asset Specs</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}

                <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-bg border border-border text-ink-muted px-2.5 py-1 rounded-md shadow-xs">
                  {currentTicketEvents.length} Events{asset ? ` • ${combinedTimeline.length} Records` : ''}
                </span>
              </div>
            </div>

            {/* Notice if this is the first service on this equipment */}
            {asset && pastTicketsCount === 0 && (
              <div className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/10 text-emerald-600 flex items-center gap-2 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span><strong>First Recorded Service:</strong> No prior repair tickets were found for this equipment.</span>
              </div>
            )}

            {/* Current Ticket Service & Activity Stream */}
            <div className="p-6 md:p-7">
              <div className="mb-2.5 space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase bg-blue-500/10 border border-blue-500/20 text-blue-600 inline-block">
                    Current Ticket
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-xs text-accent font-mono tracking-wider bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                    #{ticket.ticketNumber}
                  </span>
                  <span className="font-bold text-sm text-ink">{ticket.subject}</span>
                </div>
              </div>

              <p className="text-xs font-medium text-ink-muted leading-relaxed mb-4 max-w-4xl line-clamp-2">
                {ticket.description}
              </p>

              {/* Integrated Chronological Flow */}
              <div className="relative border-l-2 border-border ml-2 md:ml-3 space-y-6 py-1 mt-4">
                {filteredEvents.length === 0 ? (
                  <div className="pl-5 text-xs text-ink-muted italic">
                    No events match the selected filter.
                  </div>
                ) : (
                  filteredEvents.map((ev) => {
                    if (ev.type === 'created') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-border ring-4 ring-surface" />
                          <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-ink uppercase tracking-widest">Ticket Created</span>
                            <span className="text-xs text-ink-muted">{format(new Date(ev.data.createdAt), "MMM d, yyyy • h:mm a")}</span>
                          </div>
                          {ev.data.requesterName && (
                            <p className="text-xs text-ink-muted">
                              Requested by <strong className="text-ink font-semibold">{ev.data.requesterName}</strong> {ev.data.departmentName ? `(${ev.data.departmentName})` : ''}
                            </p>
                          )}
                        </div>
                      );
                    }

                    if (ev.type === 'action') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-border ring-4 ring-surface" />
                          <div className="bg-surface border border-border px-3.5 py-2 rounded-xl flex items-center gap-2.5 max-w-xl shadow-xs">
                            <div className="w-6 h-6 rounded-full bg-bg border border-border text-ink-muted flex items-center justify-center shrink-0">
                              <Activity className="w-3 h-3" />
                            </div>
                            <div className="text-left flex-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold text-ink uppercase tracking-widest">{ev.data.user?.name || 'System'}</span>
                              <span className="text-[11px] font-medium text-ink-muted whitespace-pre-wrap">{ev.data.text}</span>
                            </div>
                            <div className="text-[9px] font-bold text-ink-muted uppercase tracking-widest shrink-0">
                              {format(new Date(ev.date), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (ev.type === 'comment') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-surface" />
                          <div className={`flex gap-3 max-w-2xl ${ev.data.isOwn ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-xs ${
                              ev.data.user?.role === 'Admin' ? 'bg-ink' :
                              ev.data.user?.role === 'ICT Support' ? 'bg-accent' : 'bg-slate-500'
                            }`}>
                              {ev.data.user?.name ? ev.data.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : 'U'}
                            </div>
                            <div className={`flex-1 ${ev.data.isOwn ? 'text-right' : 'text-left'}`}>
                              <div className={`flex items-baseline gap-2 mb-1 ${ev.data.isOwn ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-xs font-bold text-ink">{ev.data.user?.name || 'User'}</span>
                                <span className="text-[9px] text-ink-muted uppercase tracking-widest font-bold">{format(new Date(ev.date), 'MMM d, h:mm a')}</span>
                              </div>
                              <div className={`px-4 py-2.5 rounded-2xl text-xs font-medium shadow-xs inline-block whitespace-pre-wrap text-left ${
                                ev.data.isOwn 
                                  ? 'bg-accent text-white rounded-tr-none' 
                                  : 'bg-bg border border-border text-ink rounded-tl-none'
                              }`}>
                                {ev.data.text}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (ev.type === 'ict_action') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-surface" />
                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                              Attempt #{ev.data.attemptNumber}
                            </span>
                            {ev.data.dateStr && (
                              <span className="text-xs text-ink-muted">{ev.data.dateStr}</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-ink bg-bg/60 p-2.5 rounded-lg border border-border inline-block max-w-2xl">
                              <strong className="text-ink">ICT:</strong> {ev.data.text}
                            </p>
                            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-wider">
                              By: {ev.data.by}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (ev.type === 'problem_report') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-surface" />
                          <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                              {ev.data.isEscalation ? 'Problem Still Exists (Escalated)' : 'Problem Still Exists Reported'}
                            </span>
                            <span className="text-xs text-red-600/70">{ev.data.dateStr}</span>
                          </div>
                          <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/20 max-w-xl">
                            <p className="text-xs font-semibold text-red-700 mb-0.5">Reason: {ev.data.reason}</p>
                            {ev.data.details && <p className="text-xs text-ink-muted leading-relaxed">{ev.data.details}</p>}
                          </div>
                        </div>
                      );
                    }

                    if (ev.type === 'manual_escalation') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-surface" />
                          <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Ticket Escalated to ICT Head</span>
                            <span className="text-xs text-red-600/70">{ev.data.dateStr}</span>
                          </div>
                          <p className="text-xs text-ink-muted">Direct escalation recorded.</p>
                        </div>
                      );
                    }

                    if (ev.type === 'referral') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-surface" />
                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Referred to External Technician</span>
                            <span className="text-xs text-purple-600/70">{ev.data.dateStr}</span>
                          </div>
                          <p className="text-xs text-ink-muted">{ev.data.text}</p>
                        </div>
                      );
                    }

                    if (ev.type === 'service_report') {
                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-surface" />
                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Technical Service Report (TSR)</span>
                            <span className="text-xs text-indigo-600/70">{ev.data.report.reportDate}</span>
                          </div>
                          <div className="bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/20 max-w-xl flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-bold text-ink">{ev.data.report.reportNumber}</div>
                              <div className="text-[11px] text-ink-muted">Final Status: {ev.data.report.finalStatus}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowServiceReportModal(true)}
                              className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-2.5 py-1 rounded-md hover:bg-indigo-500/20 transition-colors cursor-pointer"
                            >
                              View TSR
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (ev.type === 'resolved') {
                      const dotColor = ev.data.status === 'CLOSED'
                        ? 'bg-ink-muted'
                        : (ev.data.res?.dotClass || 'bg-green-500');
                      const textColor = ev.data.status === 'CLOSED'
                        ? 'text-ink-muted'
                        : (ev.data.res?.colorClass || 'text-green-600');
                      const labelText = ev.data.status === 'CLOSED'
                        ? (ev.data.res ? `Ticket Closed • ${ev.data.res.category}` : 'Ticket Closed')
                        : (ev.data.res ? `Ticket Resolved: ${ev.data.res.category}` : 'Ticket Resolved');

                      return (
                        <div key={ev.id} className="relative pl-5">
                          <div className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ring-4 ring-surface ${dotColor}`} />
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor}`}>
                              {labelText}
                            </span>
                            <span className="text-xs text-ink-muted">{format(new Date(ev.data.updatedAt), "MMM d, yyyy • h:mm a")}</span>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })
                )}
              </div>

              {/* Message / Discussion Input Box */}
              <div className="mt-8 pt-5 border-t border-border bg-bg/40 -mx-6 md:-mx-7 -mb-6 md:-mb-7 p-6 md:p-7">
                <form onSubmit={handleAddComment} className="flex gap-3 relative">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder={
                      isTicketCompleted 
                        ? `Ticket is ${ticket.status.toLowerCase()} - messaging disabled` 
                        : isWorkNotStarted
                            ? "Click 'Start Work' first to begin discussion and post updates..."
                            : "Type a message or update..."
                    }
                    disabled={isTicketCompleted || isWorkNotStarted}
                    className={`flex-1 bg-surface border border-border rounded-xl pl-4 pr-12 py-3 text-xs font-medium outline-none shadow-xs transition-all ${
                      (isTicketCompleted || isWorkNotStarted) 
                        ? 'opacity-60 cursor-not-allowed bg-bg text-ink-muted placeholder:text-ink-muted/60' 
                        : 'focus:ring-2 focus:ring-accent/50 focus:border-accent'
                    }`}
                  />
                  <button 
                    type="submit"
                    disabled={isTicketCompleted || isWorkNotStarted || !newCommentText.trim()}
                    className="absolute right-1.5 top-1.5 bottom-1.5 bg-accent text-white px-3.5 rounded-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-xs active:scale-95 cursor-pointer"
                    title={isTicketCompleted ? 'Messaging is disabled' : isWorkNotStarted ? "Click 'Start Work' first" : 'Send message'}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                {isTicketCompleted && (
                  <p className="text-[10px] text-ink-muted italic text-center mt-2.5">
                    This ticket is {ticket.status.toLowerCase()}. Discussion and message updates are closed.
                  </p>
                )}
                {isWorkNotStarted && !isTicketCompleted && (
                  <p className="text-[10px] text-accent font-medium text-center mt-2.5 flex items-center justify-center gap-1.5">
                    <span>Please click <strong>Start Work</strong> in Ticket Actions to begin working and enable discussion updates.</span>
                  </p>
                )}
              </div>
            </div>

            {/* Past Equipment Service & Audit History (if records exist) */}
            {pastRecords.length > 0 && (
              <div className="border-t border-border bg-bg/20 p-6 md:p-7">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-bold text-ink uppercase tracking-widest flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-accent" />
                    <span>Prior Equipment Service & Audit Records ({pastRecords.length})</span>
                  </h4>
                </div>
                <div className="space-y-4">
                  {pastRecords.map((item) => {
                    if (item.type === 'ticket' && item.ticket) {
                      const tkt = item.ticket;
                      return (
                        <div key={item.id} className="p-4 bg-surface rounded-xl border border-border shadow-xs">
                          <div className="mb-2 space-y-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase bg-purple-500/10 border border-purple-500/20 text-purple-600 inline-block">
                              Past Repair
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-xs text-accent font-mono tracking-wider bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                #{tkt.ticketNumber}
                              </span>
                              <span className="font-bold text-sm text-ink">{tkt.subject}</span>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-ink-muted leading-relaxed mb-2 line-clamp-2">
                            {tkt.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                            <span>Created: {format(new Date(tkt.createdAt), "MMM d, yyyy")}</span>
                            <span>•</span>
                            <span>Status: <strong className="text-ink font-semibold">{tkt.status}</strong></span>
                          </div>
                        </div>
                      );
                    }
                    if (item.type === 'audit' && item.history) {
                      const history = item.history;
                      let parsedChanges: { performedByName?: string; diffs?: { field: string; from: string; to: string }[]; summary?: string } = {};
                      try {
                        parsedChanges = JSON.parse(history.changes);
                      } catch (e) {
                        parsedChanges = { summary: history.changes };
                      }
                      const actorName = parsedChanges.performedByName || history.performedByName || 'Admin';

                      return (
                        <div key={item.id} className="p-4 bg-surface rounded-xl border border-border shadow-xs">
                          <div className="flex items-start justify-between mb-1.5">
                            <span className={`font-bold text-[10px] font-mono tracking-wider px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                              history.action === 'AUDITED'
                                ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                : history.action === 'CREATED'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            }`}>
                              {history.action === 'AUDITED' && <ShieldCheck className="w-3 h-3" />}
                              {history.action === 'CREATED' && <Database className="w-3 h-3" />}
                              {history.action === 'UPDATED' && <FileCheck className="w-3 h-3" />}
                              {history.action === 'AUDITED' ? 'PHYSICAL AUDIT' : history.action === 'CREATED' ? 'REGISTRATION' : 'RECORD UPDATE'}
                            </span>
                            <span className="text-[10px] text-ink-muted">{format(new Date(history.createdAt), "MMM d, yyyy • h:mm a")}</span>
                          </div>
                          <p className="text-xs text-ink-muted">
                            Recorded by <strong className="text-ink font-semibold">{actorName}</strong>: {parsedChanges.summary || 'Equipment profile details updated.'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Metadata Column */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Metadata Card */}
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col gap-6">
            <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 shadow-sm">
                    <User className="w-5 h-5 text-ink-muted" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Requester</div>
                    <div className="text-[14px] font-bold text-ink leading-tight">{requester?.name}</div>
                    <div className="text-[12px] font-medium text-ink-muted mt-1">{requester?.email}</div>
                </div>
            </div>
            
            <div className="h-px bg-border w-full"></div>

            <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 shadow-sm">
                    <User className="w-5 h-5 text-accent" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Technician</div>
                    {assignee ? (
                        <div className="text-[14px] font-bold text-ink leading-tight">{assignee.name}</div>
                    ) : (
                        <div className="text-[13px] font-bold text-accent italic leading-tight">Unassigned</div>
                    )}
                </div>
            </div>

            <div className="h-px bg-border w-full"></div>

            <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 shadow-sm">
                    <Monitor className="w-5 h-5 text-ink-muted" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Category & Asset</div>
                    <div className="text-[14px] font-bold text-ink leading-tight">{category?.name || 'General'}</div>
                    {asset && (
                      <div className="mt-1 space-y-2">
                        <div className="text-[12px] font-medium text-ink-muted">{asset.equipmentType} - {asset.brand} {asset.model}</div>
                        {(asset.assetCode || asset.propertyNumber) && (
                          <div>
                            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Asset Code</div>
                            <button
                              type="button"
                              onClick={() => setShowAssetModal(true)}
                              className="group mt-0.5 flex items-center gap-1.5 text-[13px] font-bold font-mono text-accent hover:underline focus:outline-none transition-colors cursor-pointer text-left"
                              title="Click to view asset details"
                            >
                              <span>{asset.assetCode || asset.propertyNumber}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </div>
            </div>
            
            <div className="h-px bg-border w-full"></div>
            
            <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 shadow-sm">
                    <Clock className="w-5 h-5 text-ink-muted" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Timestamps</div>
                    <div className="text-[12px] font-medium text-ink mt-1">Submitted: {format(new Date(ticket.createdAt), 'MMM d, h:mm a')}</div>
                    <div className="text-[12px] font-medium text-ink-muted mt-1">Updated: {format(new Date(ticket.updatedAt), 'MMM d, h:mm a')}</div>
                </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border space-y-5">
            <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest">Ticket Actions</h3>
            
            {ticket.status === 'CLOSED' && (
                <div className="px-5 py-3.5 bg-bg border border-border text-ink-muted rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-emerald-600"/> Ticket Closed
                </div>
            )}

            <div className="space-y-4">
                {/* Admin Actions */}
                {currentUser?.role === 'Admin' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Set Priority</label>
                            <select 
                                disabled={isTicketCompleted}
                                className={`w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm font-medium outline-none appearance-none shadow-sm transition-all ${
                                    isTicketCompleted 
                                        ? 'opacity-60 cursor-not-allowed text-ink-muted bg-bg/50' 
                                        : 'cursor-pointer focus:ring-2 focus:ring-accent/50 focus:border-accent'
                                }`}
                                value={ticket.priority}
                                onChange={async (e) => {
                                  const newPriority = e.target.value;
                                  const result = await ConfirmModal.fire({
                                    text: `Change priority to ${newPriority}?`
                                  });
                                  if (result.isConfirmed) {
                                    updateTicketPriority(ticket.id, newPriority);
                                    addComment(ticket.id, `Action: Updated ticket priority to ${newPriority}`);
                                    Toast.fire({ icon: 'success', title: 'Priority updated' });
                                  }
                                }}
                            >
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                            {isTicketCompleted && (
                                <p className="text-[10px] text-ink-muted italic">Priority cannot be modified on {ticket.status.toLowerCase()} tickets.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Assign Technician</label>
                            <div className="flex gap-2">
                              <select 
                                  disabled={isTicketCompleted}
                                  className={`flex-1 px-4 py-3 bg-bg border border-border rounded-xl text-sm font-medium outline-none appearance-none shadow-sm transition-all ${
                                      isTicketCompleted 
                                          ? 'opacity-60 cursor-not-allowed text-ink-muted bg-bg/50' 
                                          : 'cursor-pointer focus:ring-2 focus:ring-accent/50 focus:border-accent'
                                  }`}
                                  value={selectedAssignee}
                                  onChange={(e) => setSelectedAssignee(e.target.value)}
                              >
                                  <option value="">Select Tech...</option>
                                  {ictStaff.map(staff => {
                                      const active = tickets.filter(t => t.assignedToId === staff.id && ['ASSIGNED', 'IN PROGRESS', 'PENDING'].includes(t.status)).length;
                                      return <option key={staff.id} value={staff.id}>{staff.name} ({active} active)</option>;
                                  })}
                              </select>
                              <button 
                                  onClick={handleAssign}
                                  disabled={isTicketCompleted || !selectedAssignee || selectedAssignee === ticket.assignedToId}
                                  className="px-5 py-3 bg-ink text-surface text-[11px] uppercase tracking-widest font-bold rounded-xl shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                              >
                                  {selectedAssignee && selectedAssignee === ticket.assignedToId ? 'Set' : 'Assign'}
                              </button>
                            </div>
                            {isTicketCompleted && (
                                <p className="text-[10px] text-ink-muted italic">Technician assignment disabled on {ticket.status.toLowerCase()} tickets.</p>
                            )}
                        </div>
                            {['ESCALATED', 'REFERRED', 'RESOLVED'].includes(ticket.status) && (
                                <div className="pt-4 border-t border-border space-y-3">
                                    {ticket.status === 'ESCALATED' && (
                                        <button 
                                            onClick={() => setShowReferralModal(true)}
                                            className="w-full px-5 py-3.5 bg-purple-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            Assess & Refer Externally
                                        </button>
                                    )}
                                    {ticket.status === 'REFERRED' && (
                                        <button onClick={() => setShowDispatchModal(true)} className="w-full px-5 py-3.5 bg-purple-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all active:scale-95 mb-3">
                                            External Technician Details
                                        </button>
                                    )}
                                    {['ESCALATED', 'REFERRED'].includes(ticket.status) && (
                                        <button 
                                            onClick={async () => {
                                                if (ticket.status === 'REFERRED') {
                                                    const confirmResult = await Swal.fire({
                                                        title: 'Mark Ticket Resolved & Close?',
                                                        text: 'The external repair has been completed. This will permanently close the ticket. The Department will not need to confirm this resolution.',
                                                        icon: 'warning',
                                                        showCancelButton: true,
                                                        confirmButtonText: 'Mark Resolved & Close',
                                                        cancelButtonText: 'Cancel',
                                                        confirmButtonColor: '#22c55e',
                                                        cancelButtonColor: '#64748b',
                                                        customClass: { popup: 'rounded-2xl', title: 'font-bold' }
                                                    });
                                                    if (confirmResult.isConfirmed) {
                                                        changeTicketStatus(ticket.id, 'CLOSED', ticket.assignedToId);
                                                        addComment(ticket.id, 'Action: External repair completed, ticket permanently closed\n<!-- RESOLUTION: Referred to Technician / Service Center -->');
                                                        Toast.fire({ icon: 'success', title: 'Ticket Closed' });
                                                    }
                                                } else {
                                                    setShowResolveModal(true);
                                                }
                                            }}
                                            className="w-full px-5 py-3.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> {ticket.status === 'REFERRED' ? 'Mark Resolved & Close' : 'Mark Resolved'}
                                        </button>
                                    )}
                                    {ticket.status === 'RESOLVED' && hasBeenEscalated && (
                                        <button 
                                            onClick={() => handleStatusUpdate('CLOSED', 'Closed ticket (Escalation Resolution)')}
                                            className="w-full px-5 py-3.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Close Ticket
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* ICT Technical Service Report Section (Admin Only) */}
                            <div className="pt-4 border-t border-border space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-accent" />
                                        ICT Service Report (TSR)
                                    </label>
                                    {existingServiceReport && (
                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                                            {existingServiceReport.reportNumber}
                                        </span>
                                    )}
                                </div>

                                {isTicketCompleted ? (
                                    existingServiceReport ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowServiceReportModal(true)}
                                            className="w-full px-4 py-3 bg-accent text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                        >
                                            <Eye className="w-4 h-4" />
                                            <span>View / Print Service Report</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowServiceReportModal(true)}
                                            className="w-full px-4 py-3 bg-accent text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                        >
                                            <FileText className="w-4 h-4" />
                                            <span>Generate ICT Service Report</span>
                                        </button>
                                    )
                                ) : (
                                    <div className="space-y-1.5">
                                        <button
                                            type="button"
                                            disabled
                                            className="w-full px-4 py-3 bg-bg border border-dashed border-border text-ink-muted/50 rounded-xl text-[11px] font-bold uppercase tracking-widest cursor-not-allowed flex items-center justify-center gap-2"
                                            title="Complete the technical assessment and service action before generating the official ICT Technical Service Report"
                                        >
                                            <FileText className="w-4 h-4" />
                                            <span>Generate Service Report</span>
                                        </button>
                                        <p className="text-[10px] text-ink-muted italic text-center">
                                            Available once ticket is <strong className="text-ink font-semibold">RESOLVED</strong> or <strong className="text-ink font-semibold">CLOSED</strong>.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* ICT Support Actions */}
                    {currentUser?.role === 'ICT Support' && ticket.assignedToId === currentUser.id && ticket.status !== 'CLOSED' && (
                        <div className="flex flex-col gap-3">
                            {ticket.status === 'ASSIGNED' && (
                                <button onClick={() => handleStatusUpdate('IN PROGRESS', 'Started work on the ticket')} className="w-full px-5 py-3.5 bg-accent text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all active:scale-95">
                                    Start Work
                                </button>
                            )}
                            {ticket.status === 'IN PROGRESS' && (
                                <button onClick={() => setShowResolveModal(true)} className="w-full px-5 py-3.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
                                    <CheckCircle2 className="w-4 h-4"/> Mark Resolved
                                </button>
                            )}
                            {ticket.status === 'REFERRED' && (
                                <>
                                    <button onClick={() => setShowDispatchModal(true)} className="w-full px-5 py-3.5 bg-purple-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all active:scale-95">
                                        External Technician Details
                                    </button>
                                    <button onClick={async () => {
                                        const confirmResult = await Swal.fire({
                                            title: 'Mark Ticket Resolved & Close?',
                                            text: 'The external repair has been completed. This will permanently close the ticket. The Department will not need to confirm this resolution.',
                                            icon: 'warning',
                                            showCancelButton: true,
                                            confirmButtonText: 'Mark Resolved & Close',
                                            cancelButtonText: 'Cancel',
                                            confirmButtonColor: '#22c55e',
                                            cancelButtonColor: '#64748b',
                                            customClass: { popup: 'rounded-2xl', title: 'font-bold' }
                                        });
                                        if (confirmResult.isConfirmed) {
                                            changeTicketStatus(ticket.id, 'CLOSED', ticket.assignedToId);
                                            addComment(ticket.id, 'Action: External repair completed, ticket permanently closed');
                                            Toast.fire({ icon: 'success', title: 'Ticket Closed' });
                                        }
                                    }} className="w-full px-5 py-3.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
                                        <CheckCircle2 className="w-4 h-4"/> Mark Resolved & Close
                                    </button>
                                </>
                            )}
                            {ticket.status === 'RESOLVED' && hasBeenEscalated && (
                                <button onClick={() => handleStatusUpdate('CLOSED', 'Closed ticket (Escalation Resolution)')} className="w-full px-5 py-3.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
                                    <CheckCircle2 className="w-4 h-4"/> Close Ticket
                                </button>
                            )}
                        </div>
                    )}
                    
                    {/* Department User Actions */}
                    {currentUser?.role === 'Department User' && (
                        <div className="flex flex-col gap-3">
                            {ticket.status === 'RESOLVED' && (
                                <>
                                    <button 
                                        disabled={hasBeenEscalated}
                                        onClick={() => handleStatusUpdate('CLOSED', 'Confirmed resolution and closed the ticket')} 
                                        className={`w-full px-5 py-3.5 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2 ${hasBeenEscalated ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-500 hover:opacity-90 active:scale-95'}`}
                                    >
                                        <CheckCircle2 className="w-4 h-4"/> Confirm & Close
                                    </button>
                                    <button 
                                        disabled={hasBeenEscalated}
                                        onClick={async () => {
                                        const result = await Swal.fire({
                                            title: 'Why does the problem still exist?',
                                            html: `
                                                <div class="text-left space-y-4 font-sans mt-2">
                                                    <div>
                                                        <label class="block text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Reason (Required)</label>
                                                        <select id="swal-reason" class="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-accent/50 appearance-none">
                                                            <option value="">Select a reason...</option>
                                                            <option value="Problem still occurs">Problem still occurs</option>
                                                            <option value="Partially resolved">Partially resolved</option>
                                                            <option value="Different problem occurred">Different problem occurred</option>
                                                            <option value="Asset still unusable">Asset still unusable</option>
                                                            <option value="Issue comes back intermittently">Issue comes back intermittently</option>
                                                            <option value="Other">Other</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label class="block text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Additional Details (Optional)</label>
                                                        <textarea id="swal-details" class="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-accent/50 resize-none" rows="3" placeholder="Provide any additional context..."></textarea>
                                                    </div>
                                                </div>
                                            `,
                                            showCancelButton: true,
                                            confirmButtonText: 'Submit Problem Report',
                                            cancelButtonText: 'Cancel',
                                            confirmButtonColor: '#ef4444',
                                            cancelButtonColor: '#64748b',
                                            customClass: { popup: 'rounded-2xl', title: 'font-bold' },
                                            preConfirm: () => {
                                                const reason = (document.getElementById('swal-reason') as HTMLSelectElement).value;
                                                const details = (document.getElementById('swal-details') as HTMLTextAreaElement).value;
                                                if (!reason) {
                                                    Swal.showValidationMessage('Please select a reason');
                                                    return false;
                                                }
                                                return { reason, details };
                                            }
                                        });

                                        if (result.isConfirmed) {
                                            const { reason, details } = result.value;
                                            const attempts = (ticket.ictRecommendation || '').match(/Taken \d+:/g)?.length || 0;
                                            const reportText = `Problem Still Exists Report:\nReason: ${reason}${details ? '\nDetails: ' + details : ''}`;

                                            let confirmResult;
                                            if (attempts >= 2) {
                                                confirmResult = await Swal.fire({
                                                    title: 'Are you sure?',
                                                    text: 'The problem still exists after 2 resolution attempts. Submitting this report will escalate the ticket to ICT Head for further assessment.',
                                                    icon: 'warning',
                                                    showCancelButton: true,
                                                    confirmButtonText: 'Yes, Escalate to ICT Head',
                                                    cancelButtonText: 'Cancel',
                                                    confirmButtonColor: '#ef4444',
                                                    cancelButtonColor: '#64748b',
                                                    customClass: { popup: 'rounded-2xl', title: 'font-bold' }
                                                });
                                            } else {
                                                confirmResult = await Swal.fire({
                                                    title: 'Are you sure?',
                                                    text: 'You are about to report that the problem still exists. This will return the ticket to ICT Support for another resolution attempt.',
                                                    icon: 'warning',
                                                    showCancelButton: true,
                                                    confirmButtonText: 'Yes, Submit Report',
                                                    cancelButtonText: 'Cancel',
                                                    confirmButtonColor: '#ef4444',
                                                    cancelButtonColor: '#64748b',
                                                    customClass: { popup: 'rounded-2xl', title: 'font-bold' }
                                                });
                                            }

                                            if (confirmResult.isConfirmed) {
                                                if (attempts >= 2) {
                                                    changeTicketStatus(ticket.id, 'ESCALATED', ticket.assignedToId);
                                                    addComment(ticket.id, `${reportText}\n\nAction: Ticket escalated to ICT Head after two unsuccessful resolution attempts.`);
                                                    Toast.fire({ icon: 'success', title: 'Ticket Escalated' });
                                                } else {
                                                    changeTicketStatus(ticket.id, 'IN PROGRESS', ticket.assignedToId);
                                                    addComment(ticket.id, `${reportText}\n\nAction: Reopened ticket (Problem still exists)`);
                                                    Toast.fire({ icon: 'success', title: 'Ticket Reopened' });
                                                }
                                            }
                                        }
                                    }} className={`w-full px-5 py-3.5 border rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all ${hasBeenEscalated ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-bg border-red-500/30 text-red-500 hover:bg-red-500/10 active:scale-95'}`}>
                                        Problem Still Exists
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
          </div>

          {/* Progress Tracker Vertical */}
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest mb-6">Timeline</h3>
              <div className="relative pl-6">
                <div className="absolute left-[15px] top-2 bottom-4 w-0.5 bg-border"></div>
                <div className="space-y-6">
                  {[
                    { label: 'Submitted', key: 'NEW' },
                    { label: 'Received', key: 'RECEIVED' },
                    { label: 'Assigned', key: 'ASSIGNED' },
                    { label: 'In Progress', key: 'IN PROGRESS' },
                    { label: 'Resolved', key: 'RESOLVED' },
                    { label: 'Closed', key: 'CLOSED' }
                  ].map((step, index) => {
                    const getTimelineIndex = (status: string) => {
                      switch (status) {
                        case 'NEW': return 1;
                        case 'ASSIGNED': return 2;
                        case 'IN PROGRESS': return 3;
                        case 'PENDING': return 3;
                        case 'ESCALATED': return 3;
                        case 'REFERRED': return 3;
                        case 'RESOLVED': return 4;
                        case 'CLOSED': return 5;
                        default: return 1;
                      }
                    };
                    
                    const currentIndex = getTimelineIndex(ticket.status);
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;

                    let timestampStr = null;
                    let actionBy = null;

                    if (isCompleted || isCurrent) {
                        if (index === 0) {
                            timestampStr = ticket.createdAt;
                            actionBy = requester?.name;
                        } else if (index === 1) {
                            timestampStr = ticket.createdAt;
                        } else {
                            const dbStatus = step.key;
                            if (dbStatus) {
                                const sysComment = ticket.comments?.find((c: any) => c.text === `System: Status changed to ${dbStatus}`);
                                if (sysComment) {
                                    timestampStr = sysComment.createdAt;
                                    const u = users.find(user => user.id === sysComment.userId);
                                    if (u) actionBy = u.name;
                                }
                                else if (ticket.statusHistory) {
                                    const historyItem = ticket.statusHistory.find((h: any) => h.status === dbStatus);
                                    if (historyItem) {
                                        timestampStr = historyItem.timestamp;
                                        const u = users.find(user => user.id === historyItem.userId);
                                        if (u) actionBy = u.name;
                                    }
                                }
                            }
                            if (!timestampStr && isCurrent) timestampStr = ticket.updatedAt;
                        }
                    }

                    const currentResMeta = (step.key === 'RESOLVED' && (isCompleted || isCurrent))
                      ? getTicketResolutionMeta(ticket)
                      : null;

                    const dotBorderClass = currentResMeta
                      ? currentResMeta.borderClass
                      : (isCompleted ? 'border-green-500' : isCurrent ? 'border-accent' : 'border-border');

                    const stepLabelClass = currentResMeta && isCurrent
                      ? currentResMeta.colorClass
                      : (isCompleted ? 'text-ink' : isCurrent ? 'text-accent' : 'text-ink-muted');

                    return (
                      <div key={index} className="relative">
                        <div className={`absolute -left-[32px] top-0.5 w-4 h-4 rounded-full border-[3px] bg-surface z-10 transition-colors ${dotBorderClass}`}></div>
                        <div>
                          <p className={`text-xs font-bold leading-none ${stepLabelClass}`}>{step.label}</p>
                          {currentResMeta && (
                            <div className="mt-1">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border inline-block ${currentResMeta.badgeClass}`}>
                                {currentResMeta.category}
                              </span>
                            </div>
                          )}
                          {timestampStr && (
                             <div className="mt-1">
                               <p className="text-[10px] font-medium text-ink-muted uppercase tracking-widest">{format(new Date(timestampStr), 'MMM d, h:mm a')}</p>
                               {actionBy && <p className="text-[9px] font-bold text-accent uppercase tracking-widest mt-0.5">by {actionBy}</p>}
                             </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>
        </div>

      </div>

      {/* Referral Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-xl border border-border flex flex-col max-h-[95vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-5 md:px-8 border-b border-border flex justify-between items-center bg-bg/50 shrink-0">
              <h3 className="font-bold text-[13px] text-ink uppercase tracking-widest">Assess & Refer Externally</h3>
              <button 
                type="button" 
                onClick={() => setShowReferralModal(false)} 
                className="text-ink-muted hover:text-ink hover:bg-border p-2 rounded-xl transition-colors -mr-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body & Form */}
            <form onSubmit={handleReferralSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Reason for Referral</label>
                  <input required type="text" value={referralData.reason} onChange={e => setReferralData({...referralData, reason: e.target.value})} className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 shadow-sm transition-all" />
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="px-6 py-5 md:px-8 border-t border-border shrink-0 bg-bg/50 flex justify-end gap-3">
                <button type="button" onClick={() => setShowReferralModal(false)} className="px-6 py-3 border border-border bg-surface text-ink-muted text-[11px] font-bold uppercase tracking-widest hover:text-ink rounded-xl transition-all shadow-sm">Cancel</button>
                <button type="submit" className="px-6 py-3 bg-purple-500 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:opacity-90 shadow-sm transition-all active:scale-95">Confirm Referral</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Form Modal */}
      {showDispatchModal && ticket && (
        <DispatchFormModal
          ticket={ticket}
          asset={asset}
          department={department}
          onClose={() => setShowDispatchModal(false)}
          onSave={(commentText: string) => {
            addComment(ticket.id, commentText);
            Toast.fire({ icon: 'success', title: 'Technician details saved' });
          }}
        />
      )}

      {/* Asset Info Modal */}
      {showAssetModal && asset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-bg/50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[14px] text-ink leading-tight">
                    {asset.equipmentType} - {asset.brand} {asset.model}
                  </h3>
                  <p className="text-[11px] font-mono text-accent mt-0.5">
                    {asset.assetCode || asset.propertyNumber}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAssetModal(false)} 
                className="text-ink-muted hover:text-ink hover:bg-border p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  asset.operationalStatus === 'Operational' 
                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  {asset.operationalStatus || 'Operational'}
                </span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-bg border border-border text-ink-muted">
                  Condition: {asset.condition || 'Good'}
                </span>
                {assetOffice && (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
                    {assetOffice.name}
                  </span>
                )}
              </div>

              {/* General & Assignment Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-bg/50 p-4 rounded-xl border border-border">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Assigned To</span>
                  <span className="font-semibold text-ink">{asset.assignedTo || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Office / Department</span>
                  <span className="font-semibold text-ink">{assetOffice?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Exact Location</span>
                  <span className="font-semibold text-ink">{asset.exactLocation || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Serial Number</span>
                  <span className="font-mono font-semibold text-ink">{asset.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Property Number</span>
                  <span className="font-mono font-semibold text-ink">{asset.propertyNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Inventory Number</span>
                  <span className="font-mono font-semibold text-ink">{asset.inventoryNumber || 'N/A'}</span>
                </div>
              </div>

              {/* Technical Specifications (if available) */}
              {(asset.hostname || asset.processor || asset.memory || asset.diskStorage || asset.operatingSystem || asset.microsoftOffice) && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-ink">Technical Specifications</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-bg/50 p-4 rounded-xl border border-border">
                    {asset.hostname && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Hostname</span>
                        <span className="font-mono text-ink">{asset.hostname}</span>
                      </div>
                    )}
                    {asset.processor && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Processor</span>
                        <span className="text-ink">{asset.processor}</span>
                      </div>
                    )}
                    {asset.memory && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Memory (RAM)</span>
                        <span className="text-ink">{asset.memory}</span>
                      </div>
                    )}
                    {asset.diskStorage && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Disk Storage</span>
                        <span className="text-ink">{asset.diskStorage}</span>
                      </div>
                    )}
                    {asset.operatingSystem && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Operating System</span>
                        <span className="text-ink">{asset.operatingSystem}</span>
                      </div>
                    )}
                    {asset.microsoftOffice && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Microsoft Office</span>
                        <span className="text-ink">{asset.microsoftOffice}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Acquisition & Remarks */}
              {(asset.acquisitionCost || asset.dateAcquired || asset.remarks) && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-ink">Acquisition & Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-bg/50 p-4 rounded-xl border border-border">
                    {asset.acquisitionCost && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Acquisition Cost</span>
                        <span className="text-ink">{asset.acquisitionCost}</span>
                      </div>
                    )}
                    {asset.dateAcquired && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Date Acquired</span>
                        <span className="text-ink">{asset.dateAcquired}</span>
                      </div>
                    )}
                    {asset.remarks && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block">Remarks</span>
                        <span className="text-ink text-xs">{asset.remarks}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border bg-bg/50 flex justify-end shrink-0">
              <button 
                type="button" 
                onClick={() => setShowAssetModal(false)} 
                className="px-5 py-2.5 bg-accent text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:opacity-90 shadow-sm transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Report Modal (Admin Only) */}
      {showServiceReportModal && ticket && (
        <ServiceReportModal
          ticket={ticket}
          isOpen={showServiceReportModal}
          onClose={() => setShowServiceReportModal(false)}
          existingReportId={existingServiceReport?.id}
        />
      )}

      {/* Resolve Ticket Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border bg-bg/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 text-green-600 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                    Resolve Ticket #{ticket.ticketNumber}
                  </h3>
                  <p className="text-[11px] text-ink-muted">Select the technical resolution outcome for this service</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="w-7 h-7 rounded-lg bg-bg border border-border text-ink-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmResolve} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1.5">
                  Resolution Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedResolution}
                  onChange={(e) => setSelectedResolution(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm cursor-pointer"
                >
                  {RESOLUTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Criteria Description Box */}
              {(() => {
                const selectedOpt = RESOLUTION_OPTIONS.find(o => o.value === selectedResolution);
                return selectedOpt ? (
                  <div className="p-3.5 bg-bg/70 border border-border rounded-xl text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent block">
                      Description / Criteria:
                    </span>
                    <p className="text-ink-muted leading-relaxed font-medium">
                      {selectedOpt.description}
                    </p>
                  </div>
                ) : null;
              })()}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1.5">
                  Action Taken / Troubleshooting Details
                </label>
                <textarea
                  rows={3}
                  value={resolveActionTaken}
                  onChange={(e) => setResolveActionTaken(e.target.value)}
                  placeholder="Detail the troubleshooting conducted, parts tested or replaced, configuration changes..."
                  className="w-full p-3.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm resize-none"
                />
                <p className="text-[10px] text-ink-muted mt-1 italic">
                  This action taken will be automatically recorded in the activity log and prefilled into Section IV & V of the ICT Technical Service Report.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-5 py-2.5 bg-bg border border-border text-ink-muted rounded-xl text-[11px] font-bold uppercase tracking-widest hover:text-ink transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving}
                  className="px-5 py-2.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isResolving ? 'Resolving...' : 'Confirm Resolution'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
