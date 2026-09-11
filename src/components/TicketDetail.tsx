import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ArrowLeft, Clock, User, Monitor, AlertCircle, CheckCircle2, Send, Activity, X, ExternalLink, FileText, Printer, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { getTicketSLA } from '../utils/sla';
import { Toast, ConfirmModal } from '../lib/toast';
import Swal from 'sweetalert2';
import { DispatchFormModal } from './DispatchFormModal';
import { ServiceReportModal } from './ServiceReportModal';

export function TicketDetail({ ticketId, onBack }: { ticketId: string, onBack: () => void }) {
  const { tickets, users, assets, offices, categories, currentUser, changeTicketStatus, updateTicketPriority, addComment, updateRecommendation, serviceReports } = useAppContext();
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
