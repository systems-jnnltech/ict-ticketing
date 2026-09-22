import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
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
  const [referralData, setReferralData] = useState({
    reason: 'Hardware repair requires specialized technician',
  });

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
          
          {/* Discussion / Comments */}
          <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-border bg-bg/50 flex justify-between items-center flex-wrap gap-3">
                  <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest">Discussion & Activity</h3>
                  <div className="flex items-center gap-2">
                    {/* View Technician Details Button - Only visible for Admin and ICT Support roles */}
                    {isAdminOrICT && hasReferralDetails && (
                      <button
                        onClick={() => setShowDispatchModal(true)}
                        className="text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-600 border border-purple-500/20 hover:bg-purple-500/20 px-3 py-1 rounded-md shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Technician Details
                      </button>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-bg border border-border text-ink-muted px-3 py-1 rounded-md shadow-sm">
                      {ticket.comments?.filter(isPublicDiscussionComment).length || 0} Events
                    </span>
                  </div>
              </div>
              <div className="p-8 space-y-8 flex-1">
                  {ticket.comments && ticket.comments.filter(isPublicDiscussionComment).length > 0 ? (
                      ticket.comments.filter(isPublicDiscussionComment).map(comment => {
                          const commentUser = users.find(u => u.id === comment.userId);
                          const isOwn = comment.userId === currentUser?.id;
                          const isAction = comment.text.startsWith('Action:');
                          const rawText = isAction ? comment.text.replace('Action: ', '') : comment.text;
                          const displayText = rawText.replace(/<!--[\s\S]*?-->/g, '').trim();
                          
                          if (isAction) {
                              return (
                                  <div key={comment.id} className="flex justify-center my-6">
                                      <div className="bg-surface border border-border px-4 py-3 rounded-xl flex items-center gap-3 w-full shadow-sm max-w-xl">
                                          <div className="w-7 h-7 rounded-full bg-bg border border-border text-ink-muted flex items-center justify-center shrink-0">
                                              <Activity className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="text-left flex-1 flex flex-wrap items-center gap-1.5">
                                              <span className="text-[11px] font-bold text-ink uppercase tracking-widest">{commentUser?.name}</span>
                                              <span className="text-[12px] font-medium text-ink-muted whitespace-pre-wrap text-left">{displayText}</span>
                                          </div>
                                          <div className="text-[9px] font-bold text-ink-muted uppercase tracking-widest shrink-0">
                                              {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                                          </div>
                                      </div>
                                  </div>
                              );
                          }
                          
                          return (
                              <div key={comment.id} className={`flex gap-4 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold shadow-sm ${
                                      commentUser?.role === 'Admin' ? 'bg-ink' :
                                      commentUser?.role === 'ICT Support' ? 'bg-accent' : 'bg-slate-500'
                                  }`}>
                                      {commentUser?.name.split(' ').map(n => n[0]).join('').substring(0,2)}
                                  </div>
                                  <div className={`max-w-[85%] ${isOwn ? 'text-right' : 'text-left'}`}>
                                      <div className={`flex items-baseline gap-3 mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                          <span className="text-xs font-bold text-ink">{commentUser?.name}</span>
                                          <span className="text-[10px] text-ink-muted uppercase tracking-widest font-bold">{format(new Date(comment.createdAt), 'MMM d, h:mm a')}</span>
                                      </div>
                                      <div className={`px-5 py-3.5 rounded-2xl text-sm font-medium shadow-sm inline-block whitespace-pre-wrap text-left ${
                                          isOwn 
                                              ? 'bg-accent text-white rounded-tr-none' 
                                              : 'bg-bg border border-border text-ink rounded-tl-none'
                                      }`}>
                                          {displayText}
                                      </div>
                                  </div>
                              </div>
                          );
                      })
                  ) : (
                      <div className="text-center text-sm font-medium text-ink-muted py-12 bg-bg/50 rounded-xl border border-dashed border-border">No comments yet. Start the discussion below.</div>
                  )}
              </div>
              
              <div className="p-6 border-t border-border bg-bg/50">
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
                          className={`flex-1 bg-surface border border-border rounded-xl pl-5 pr-14 py-3.5 text-sm font-medium outline-none shadow-sm transition-all ${
                              (isTicketCompleted || isWorkNotStarted) 
                                  ? 'opacity-60 cursor-not-allowed bg-bg text-ink-muted placeholder:text-ink-muted/60' 
                                  : 'focus:ring-2 focus:ring-accent/50 focus:border-accent'
                          }`}
                      />
                      <button 
                          type="submit"
                          disabled={isTicketCompleted || isWorkNotStarted || !newCommentText.trim()}
                          className="absolute right-2 top-2 bottom-2 bg-accent text-white px-4 rounded-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-sm active:scale-95"
                          title={isTicketCompleted ? 'Messaging is disabled' : isWorkNotStarted ? "Click 'Start Work' first" : 'Send message'}
                      >
                          <Send className="w-4 h-4" />
                      </button>
                  </form>
                  {isTicketCompleted && (
                      <p className="text-[11px] text-ink-muted italic text-center mt-2.5">
                          This ticket is {ticket.status.toLowerCase()}. Discussion and message updates are closed.
                      </p>
                  )}
                  {isWorkNotStarted && !isTicketCompleted && (
                      <p className="text-[11px] text-accent font-medium text-center mt-2.5 flex items-center justify-center gap-1.5">
                          <span>Please click <strong>Start Work</strong> in Ticket Actions to begin working and enable discussion updates.</span>
                      </p>
                  )}
              </div>
          </div>

          {/* Service & Audit Timeline for Linked Asset */}
          <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="px-6 py-5 border-b border-border bg-bg/50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-bg border border-border text-accent flex items-center justify-center shadow-xs shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest flex items-center gap-2">
                    Service & Audit Timeline
                  </h3>
                  {asset && (
                    <p className="text-[11px] text-ink-muted font-medium mt-0.5">
                      {asset.equipmentType} - {asset.brand} {asset.model} {asset.propertyNumber ? `• Property: ${asset.propertyNumber}` : asset.assetCode ? `• Code: ${asset.assetCode}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                  {asset ? `RECORDS: ${combinedTimeline.length}` : 'NO ASSET'}
                </span>
              </div>
            </div>

            <div className="divide-y divide-border">
              {!asset ? (
                <div className="p-8 text-center bg-bg/30">
                  <div className="w-10 h-10 rounded-xl bg-bg border border-border text-ink-muted flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-1">No Equipment Linked</h4>
                  <p className="text-xs text-ink-muted max-w-md mx-auto">
                    This ticket has no tagged property or asset code. Once an asset is linked, previous repair interventions and audit trails will appear here automatically.
                  </p>
                </div>
              ) : combinedTimeline.length === 0 ? (
                <div className="p-8 text-center bg-bg/30">
                  <p className="text-xs font-medium text-ink-muted">
                    No service tickets or audit records found for this equipment.
                  </p>
                </div>
              ) : (
                <>
                  {/* Notice if this is the first service on this equipment */}
                  {pastTicketsCount === 0 && (
                    <div className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/10 text-emerald-600 flex items-center gap-2 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span><strong>First Recorded Service:</strong> No prior repair tickets were found for this equipment.</span>
                    </div>
                  )}

                  {combinedTimeline.map((item) => {
                    if (item.type === 'ticket' && item.ticket) {
                      const tkt = item.ticket;
                      const isCurrent = tkt.id === ticket.id;

                      return (
                        <div
                          key={item.id}
                          className={`p-6 md:p-7 transition-colors ${
                            isCurrent ? 'bg-accent/[0.03] border-l-4 border-l-accent' : 'hover:bg-bg/40'
                          }`}
                        >
                          <div className="mb-2.5 space-y-1.5">
                            <div>
                              {isCurrent ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase bg-blue-500/10 border border-blue-500/20 text-blue-600 inline-block">
                                  Current Ticket
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase bg-purple-500/10 border border-purple-500/20 text-purple-600 inline-block">
                                  Past Repair
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-xs text-accent font-mono tracking-wider bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                #{tkt.ticketNumber}
                              </span>
                              <span className="font-bold text-sm text-ink">{tkt.subject}</span>
                            </div>
                          </div>

                          <p className="text-xs font-medium text-ink-muted leading-relaxed mb-4 max-w-4xl line-clamp-2">
                            {tkt.description}
                          </p>

                          {/* Compact Timeline Flow */}
                          <div className="relative border-l-2 border-border ml-2 md:ml-3 space-y-6 py-1 mt-3">
                            {/* Ticket Created Node */}
                            <div className="relative pl-5">
                              <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-border ring-4 ring-surface" />
                              <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-ink uppercase tracking-widest">Ticket Created</span>
                                <span className="text-xs text-ink-muted">{format(new Date(tkt.createdAt), "MMM d, yyyy • h:mm a")}</span>
                              </div>
                            </div>

                            {(() => {
                              const actions = tkt.ictRecommendation ? tkt.ictRecommendation.split(/(?=Taken \d+:)/).filter(Boolean) : [];

                              const parsedActions = actions.map(action => {
                                const match = action.match(/Taken (\d+):\s+(.*?)\s+by:\s+(.*?)\n(.*)/s);
                                if (match) {
                                  return {
                                    type: 'ict_action',
                                    attemptNumber: match[1],
                                    dateStr: match[2],
                                    date: new Date(match[2]).getTime(),
                                    by: match[3],
                                    text: match[4].trim()
                                  };
                                }
                                return {
                                  type: 'ict_action',
                                  attemptNumber: '?',
                                  dateStr: '',
                                  date: 0,
                                  by: 'Unknown',
                                  text: action.trim()
                                };
                              });

                              const problemReports = tkt.comments
                                ?.filter(c => c.text.includes('Problem Still Exists Report:'))
                                .map(c => {
                                  const reasonMatch = c.text.match(/Reason: (.*)/);
                                  const detailsMatch = c.text.match(/Details: (.*)/);
                                  const isEscalation = c.text.includes('escalated to ICT Head') || c.text.includes('Escalated');

                                  return {
                                    type: 'problem_report',
                                    date: new Date(c.createdAt).getTime(),
                                    dateStr: format(new Date(c.createdAt), "MMM d, yyyy • h:mm a"),
                                    reason: reasonMatch ? reasonMatch[1] : 'Unknown',
                                    details: detailsMatch ? detailsMatch[1] : '',
                                    isEscalation,
                                    text: c.text
                                  };
                                }) || [];

                              const escalatedLog = tkt.comments?.find(c => c.text === 'System: Status changed to ESCALATED' || (c.text.includes('Escalated') && !c.text.includes('Problem Still Exists Report:')));
                              const manualEscalations = [];
                              if (escalatedLog && !problemReports.some(pr => Math.abs(pr.date - new Date(escalatedLog.createdAt).getTime()) < 5000)) {
                                manualEscalations.push({
                                  type: 'manual_escalation',
                                  date: new Date(escalatedLog.createdAt).getTime(),
                                  dateStr: format(new Date(escalatedLog.createdAt), "MMM d, yyyy • h:mm a")
                                });
                              } else if (!escalatedLog && tkt.status === 'ESCALATED' && problemReports.filter(pr => pr.isEscalation).length === 0) {
                                manualEscalations.push({
                                  type: 'manual_escalation',
                                  date: new Date(tkt.updatedAt).getTime(),
                                  dateStr: format(new Date(tkt.updatedAt), "MMM d, yyyy • h:mm a")
                                });
                              }

                              const referrals = tkt.comments?.filter(c => c.text.includes('Referred to External Technician')).map(c => {
                                const reasonMatch = c.text.match(/Reason: (.*)/);
                                const providerComment = tkt.comments?.find(pc => pc.text.includes('EXT_TECH_DETAILS'));
                                let provider = '';
                                if (providerComment) {
                                  const extMatch = providerComment.text.match(/<!-- EXT_TECH_DETAILS: (.*?) -->/);
                                  if (extMatch) {
                                    try { provider = JSON.parse(extMatch[1]).serviceProvider || ''; } catch(e){}
                                  }
                                }
                                return {
                                  type: 'referral',
                                  date: new Date(c.createdAt).getTime(),
                                  dateStr: format(new Date(c.createdAt), "MMM d, yyyy • h:mm a"),
                                  reason: reasonMatch ? reasonMatch[1] : 'Unknown',
                                  provider
                                };
                              }) || [];

                              const dispatches = tkt.comments?.filter(c => c.text.includes('DISPATCH_INFO')).map(c => {
                                let dispatchData = null;
                                const match = c.text.match(/<!-- DISPATCH_INFO: (.*?) -->/);
                                if (match) {
                                  try { dispatchData = JSON.parse(match[1]); } catch(e){}
                                }
                                return {
                                  type: 'dispatch',
                                  date: new Date(c.createdAt).getTime(),
                                  dateStr: format(new Date(c.createdAt), "MMM d, yyyy • h:mm a"),
                                  dispatchData
                                };
                              }) || [];

                              const repairs = tkt.comments?.filter(c => c.text.includes('REPAIR_INFO')).map(c => {
                                let repairData = null;
                                const match = c.text.match(/<!-- REPAIR_INFO: (.*?) -->/);
                                if (match) {
                                  try { repairData = JSON.parse(match[1]); } catch(e){}
                                }
                                return {
                                  type: 'repair',
                                  date: new Date(c.createdAt).getTime(),
                                  dateStr: format(new Date(c.createdAt), "MMM d, yyyy • h:mm a"),
                                  repairData
                                };
                              }) || [];

                              const allEvents = [...parsedActions, ...problemReports, ...manualEscalations, ...referrals, ...dispatches, ...repairs].sort((a, b) => a.date - b.date);

                              return (
                                <>
                                  {allEvents.map((ev, i) => (
                                    <React.Fragment key={i}>
                                      {ev.type === 'ict_action' && (
                                        <div className="relative pl-5">
                                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-accent ring-4 ring-surface" />
                                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-ink uppercase tracking-widest">Attempt #{ev.attemptNumber}</span>
                                            <span className="text-xs text-ink-muted">{ev.dateStr}</span>
                                          </div>
                                          <div className="text-xs text-ink-muted leading-relaxed">
                                            <span className="font-semibold text-ink">
                                              {(ev.by as string).includes('ICT Head') || (ev.by as string).includes('Admin') ? 'ICT Head' : 'ICT'}:
                                            </span>{' '}
                                            {ev.text as string}
                                          </div>
                                          <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-ink-muted">
                                            By: {ev.by as string}
                                          </div>
                                        </div>
                                      )}

                                      {ev.type === 'problem_report' && (
                                        <div className="relative pl-5">
                                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-surface" />
                                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Problem Still Exists</span>
                                            <span className="text-xs text-red-500/70">{ev.dateStr}</span>
                                          </div>
                                          <div className="text-xs text-ink-muted leading-relaxed">
                                            <span className="font-semibold text-ink">Reason:</span> {ev.reason as string}
                                            {ev.details && (
                                              <div className="mt-0.5">
                                                <span className="font-semibold text-ink">Details:</span> {ev.details as string}
                                              </div>
                                            )}
                                          </div>
                                          {ev.isEscalation && (
                                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-600 rounded text-[9px] font-bold uppercase tracking-widest">
                                              <span>🚨</span> Escalated to ICT Head
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {ev.type === 'manual_escalation' && (
                                        <div className="relative pl-5">
                                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-surface" />
                                          <div className="flex flex-wrap items-baseline gap-2">
                                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-1">
                                              <span>🚨</span> Escalated to ICT Head
                                            </span>
                                            <span className="text-xs text-red-500/70">{ev.dateStr}</span>
                                          </div>
                                        </div>
                                      )}

                                      {ev.type === 'referral' && (
                                        <div className="relative pl-5">
                                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-surface" />
                                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Referred to Ext. Tech</span>
                                            <span className="text-xs text-purple-600/70">{ev.dateStr}</span>
                                          </div>
                                          <div className="text-xs text-ink-muted leading-relaxed">
                                            {ev.provider && (
                                              <div><span className="font-semibold text-ink">Provider:</span> {ev.provider as string}</div>
                                            )}
                                            <div><span className="font-semibold text-ink">Reason:</span> {ev.reason as string}</div>
                                          </div>
                                        </div>
                                      )}

                                      {ev.type === 'dispatch' && (
                                        <div className="relative pl-5">
                                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-surface" />
                                          <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Dispatch Information</span>
                                            <span className="text-xs text-blue-600/70">{ev.dateStr}</span>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-muted bg-bg/50 p-3 rounded-xl border border-border">
                                            <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Released</span>{(ev.dispatchData as any)?.dateReleased ? format(new Date((ev.dispatchData as any).dateReleased), 'MMM d, yyyy h:mm a') : '-'}</div>
                                            <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">By</span>{(ev.dispatchData as any)?.releasedBy || '-'}</div>
                                            <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Received By (Tech)</span>{(ev.dispatchData as any)?.receivedBy || '-'}</div>
                                            <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Contact No.</span>{(ev.dispatchData as any)?.technicianContact || '-'}</div>
                                          </div>
                                        </div>
                                      )}

                                      {ev.type === 'repair' && (
                                        <div className="relative pl-5">
                                          <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-green-500 ring-4 ring-surface" />
                                          <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Repair / Return Information</span>
                                            <span className="text-xs text-green-600/70">{ev.dateStr}</span>
                                          </div>
                                          <div className="bg-bg/50 p-3 rounded-xl border border-border">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-muted mb-2">
                                              <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Returned</span>{(ev.repairData as any)?.dateReturned ? format(new Date((ev.repairData as any).dateReturned), 'MMM d, yyyy h:mm a') : '-'}</div>
                                              <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Status</span>{(ev.repairData as any)?.repairStatus || '-'}</div>
                                            </div>
                                            <div className="space-y-1.5 text-xs text-ink-muted border-t border-border pt-2">
                                              {((ev.repairData as any)?.technicianFindings) && <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Findings</span>{(ev.repairData as any)?.technicianFindings}</div>}
                                              {((ev.repairData as any)?.actionPerformed) && <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Action Performed</span>{(ev.repairData as any)?.actionPerformed}</div>}
                                              {((ev.repairData as any)?.partsReplaced) && <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Parts Replaced</span>{(ev.repairData as any)?.partsReplaced}</div>}
                                              {((ev.repairData as any)?.finalRemarks) && <div><span className="font-bold text-ink block text-[9px] uppercase tracking-widest mb-0.5">Remarks</span>{(ev.repairData as any)?.finalRemarks}</div>}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </>
                              );
                            })()}

                            {/* Resolved / Closed Node */}
                            {['RESOLVED', 'CLOSED'].includes(tkt.status) && (
                              <div className="relative pl-5">
                                <div className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ring-4 ring-surface ${tkt.status === 'CLOSED' ? 'bg-ink-muted' : 'bg-green-500'}`} />
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest ${tkt.status === 'CLOSED' ? 'text-ink-muted' : 'text-green-600'}`}>
                                    Ticket {tkt.status === 'CLOSED' ? 'Closed' : 'Resolved'}
                                  </span>
                                  <span className="text-xs text-ink-muted">{format(new Date(tkt.updatedAt), "MMM d, yyyy • h:mm a")}</span>
                                </div>
                              </div>
                            )}
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
                      const diffs = parsedChanges.diffs || [];
                      const actorName = parsedChanges.performedByName || history.performedByName || 'Admin';

                      return (
                        <div key={item.id} className="p-6 md:p-7 hover:bg-bg/40 transition-colors">
                          <div className="flex items-start justify-between mb-2.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className={`font-bold text-xs font-mono tracking-wider px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                                history.action === 'AUDITED'
                                  ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                  : history.action === 'CREATED'
                                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              }`}>
                                {history.action === 'AUDITED' && <ShieldCheck className="w-3.5 h-3.5" />}
                                {history.action === 'CREATED' && <Database className="w-3.5 h-3.5" />}
                                {history.action === 'UPDATED' && <FileCheck className="w-3.5 h-3.5" />}
                                {history.action === 'AUDITED' ? 'PHYSICAL AUDIT' : history.action === 'CREATED' ? 'REGISTRATION' : 'RECORD UPDATE'}
                              </span>
                              <span className="font-bold text-sm text-ink">
                                {history.action === 'AUDITED' 
                                  ? 'Physical Inventory Audit Recorded' 
                                  : history.action === 'CREATED'
                                  ? 'Equipment Registered in Municipal Database'
                                  : 'Asset Specification & Profile Updated'}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded tracking-widest uppercase border bg-surface border-border text-ink-muted">
                              AUDIT LOG
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mb-3">
                            <span>Recorded by: <strong className="text-ink font-semibold">{actorName}</strong></span>
                            <span>•</span>
                            <span>{format(new Date(history.createdAt), "MMM d, yyyy • h:mm a")}</span>
                          </div>

                          {diffs.length > 0 ? (
                            <div className="bg-bg/60 border border-border rounded-xl overflow-hidden shadow-xs">
                              <div className="px-3.5 py-1.5 bg-bg border-b border-border text-[9px] font-bold uppercase tracking-widest text-ink-muted">
                                Documented Changes ({diffs.length})
                              </div>
                              <div className="p-3 divide-y divide-border/60">
                                {diffs.map((diff: any, idx: number) => (
                                  <div key={idx} className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
                                    <span className="font-bold text-ink sm:w-1/3">{diff.field}</span>
                                    <div className="flex items-center gap-2 font-mono sm:w-2/3 flex-wrap">
                                      <span className="text-red-500/80 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 line-through truncate max-w-[200px]" title={diff.from}>
                                        {diff.from}
                                      </span>
                                      <span className="text-ink-muted">➔</span>
                                      <span className="text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold truncate max-w-[200px]" title={diff.to}>
                                        {diff.to}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-bg/50 border border-border rounded-xl p-3 text-xs text-ink-muted italic">
                              {parsedChanges.summary || 'Equipment profile details updated.'}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}
                </>
              )}
            </div>
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
                                                        addComment(ticket.id, 'Action: External repair completed, ticket permanently closed');
                                                        Toast.fire({ icon: 'success', title: 'Ticket Closed' });
                                                    }
                                                } else {
                                                    handleStatusUpdate('RESOLVED', 'Marked ticket as Repaired / Resolved');
                                                }
                                            }}
                                            className="w-full px-5 py-3.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
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
                                <button onClick={() => handleStatusUpdate('RESOLVED', 'Marked ticket as Repaired / Resolved')} className="w-full px-5 py-3.5 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
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

                    return (
                      <div key={index} className="relative">
                        <div className={`absolute -left-[32px] top-0.5 w-4 h-4 rounded-full border-[3px] bg-surface z-10 transition-colors ${
                          isCompleted ? 'border-green-500' : isCurrent ? 'border-accent' : 'border-border'
                        }`}></div>
                        <div>
                          <p className={`text-xs font-bold leading-none ${isCompleted ? 'text-ink' : isCurrent ? 'text-accent' : 'text-ink-muted'}`}>{step.label}</p>
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
    </div>
  );
}
