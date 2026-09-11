import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { Ticket, ServiceReport, FinalServiceStatus, ServiceReportStatus } from '../store/mockData';
import { X, Printer, Save, FileText, CheckCircle2, AlertCircle, Edit3, Eye, ShieldCheck, Sparkles, Building, User, Monitor, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ServiceReportModalProps {
  ticket: Ticket;
  isOpen: boolean;
  onClose: () => void;
  existingReportId?: string;
}

export type PaperSize = 'a4' | 'letter' | 'legal';

const FINAL_STATUS_OPTIONS: FinalServiceStatus[] = [
  'Resolved',
  'Repaired',
  'For Monitoring',
  'For Further Assessment',
  'For Replacement',
  'For Procurement',
  'For Disposal',
  'Referred to Service Provider'
];

const REPORT_STATUS_OPTIONS: ServiceReportStatus[] = [
  'Draft',
  'Generated',
  'Reviewed',
  'Signed',
  'Released'
];

const RECOMMENDATION_PRESETS = [
  'Equipment tested operational and returned in good working condition.',
  'Recommend procurement of replacement components (power supply/storage/RAM).',
  'Recommend unit condemnation and disposal due to unserviceable hardware condition.',
  'Recommend memory (RAM) and SSD upgrade to optimize office productivity.',
  'Recommend connection to AVR/UPS and quarterly preventive maintenance.'
];

const getFinalStatusColor = (status: FinalServiceStatus | string) => {
  switch (status) {
    case 'Repaired':
    case 'Resolved':
      return 'text-green-600 print:text-green-600';
    case 'For Monitoring':
    case 'Referred to Service Provider':
      return 'text-blue-600 print:text-blue-600';
    case 'For Further Assessment':
    case 'For Procurement':
      return 'text-amber-600 print:text-amber-600';
    case 'For Replacement':
    case 'For Disposal':
      return 'text-red-600 print:text-red-600';
    default:
      return 'text-green-600 print:text-green-600';
  }
};

export interface ActionLogEntry {
  timestamp: string;
  action: string;
}

export function getActionLogEntries(
  ticket: Ticket,
  assigneeName?: string,
  finalStatusText?: string
): ActionLogEntry[] {
  const entries: { time: Date; text: string }[] = [];

  // 1. Ticket submitted
  if (ticket.createdAt) {
    entries.push({
      time: new Date(ticket.createdAt),
      text: 'Ticket submitted and logged into ICT Helpdesk system'
    });
  }

  // 2. Assigned
  const assignedHistory = ticket.statusHistory?.find(h => h.status === 'ASSIGNED');
  const assignedComment = ticket.comments?.find(c => c.text?.toLowerCase().includes('assigned'));
  if (ticket.assignedToId || assigneeName) {
    const assignedTime = assignedHistory?.timestamp || assignedComment?.createdAt || ticket.createdAt;
    entries.push({
      time: new Date(assignedTime),
      text: `Assigned ticket to ${assigneeName || 'ICT Technical Personnel'}`
    });
  }

  // 3. In Progress
  const inProgressHistory = ticket.statusHistory?.find(h => h.status === 'IN PROGRESS');
  const inProgressComment = ticket.comments?.find(c => c.text?.toLowerCase().includes('in progress'));
  if (inProgressHistory || inProgressComment || ticket.status === 'IN PROGRESS' || ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    const progTime = inProgressHistory?.timestamp || inProgressComment?.createdAt || ticket.updatedAt || ticket.createdAt;
    entries.push({
      time: new Date(progTime),
      text: 'Started work on the ticket'
    });
  }

  // 4. Ticket Comments / System Activities
  if (ticket.comments && ticket.comments.length > 0) {
    ticket.comments.forEach(c => {
      if (!c.text) return;
      if (c.text.startsWith('System: Status changed to')) return;
      if (c.text.startsWith('{') && c.text.endsWith('}')) return;
      entries.push({
        time: new Date(c.createdAt),
        text: c.text
      });
    });
  }

  // 5. Resolved / Repaired
  const resolvedHistory = ticket.statusHistory?.find(h => h.status === 'RESOLVED');
  const resolvedComment = ticket.comments?.find(c => c.text?.toLowerCase().includes('resolved') || c.text?.toLowerCase().includes('repaired'));
  if (resolvedHistory || resolvedComment || ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    const resTime = resolvedHistory?.timestamp || resolvedComment?.createdAt || ticket.updatedAt;
    entries.push({
      time: new Date(resTime),
      text: `Marked ticket as ${finalStatusText || 'Repaired / Resolved'}`
    });
  }

  // 6. Closed
  const closedHistory = ticket.statusHistory?.find(h => h.status === 'CLOSED');
  const closedComment = ticket.comments?.find(c => c.text?.toLowerCase().includes('closed'));
  if (closedHistory || closedComment || ticket.status === 'CLOSED') {
    const closeTime = closedHistory?.timestamp || closedComment?.createdAt || ticket.updatedAt;
    entries.push({
      time: new Date(closeTime),
      text: 'Confirmed resolution and officially closed ticket'
    });
  }

  // Sort chronologically
  entries.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Deduplicate entries with identical timestamp and text
  const seen = new Set<string>();
  const result: ActionLogEntry[] = [];
  for (const item of entries) {
    const key = `${format(item.time, 'yyyy-MM-dd HH:mm')} - ${item.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        timestamp: format(item.time, 'MMM dd, yyyy • hh:mm a'),
        action: item.text
      });
    }
  }

  return result;
}

export function ServiceReportModal({ ticket, isOpen, onClose, existingReportId }: ServiceReportModalProps) {
  const {
    serviceReports,
    createServiceReport,
    updateServiceReport,
    getNextReportNumber,
    markReportPrinted,
    users,
    assets,
    offices,
    categories,
    currentUser
  } = useAppContext();

  // Find existing report if any
  const existingReport = existingReportId 
    ? serviceReports.find(r => r.id === existingReportId)
    : serviceReports.find(r => r.ticketId === ticket.id);

  const [activeTab, setActiveTab] = useState<'preview' | 'form'>(existingReport ? 'preview' : 'form');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [isSaving, setIsSaving] = useState(false);

  // Associated metadata
  const requester = users.find(u => u.id === ticket.requesterId);
  const assignee = users.find(u => u.id === ticket.assignedToId);
  const asset = assets.find(a => a.id === ticket.assetId || a.assetCode === ticket.assetId);
  const department = offices.find(o => o.id === ticket.officeId);
  const category = categories.find(c => c.id === ticket.categoryId);

  // Form states
  const [reportNumber, setReportNumber] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [technicalFindings, setTechnicalFindings] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [finalStatus, setFinalStatus] = useState<FinalServiceStatus>('Resolved');
  const [recommendation, setRecommendation] = useState('');
  const [ictHeadName, setIctHeadName] = useState('Engr. Kenneth Jones D. Alforque');
  const [officeHeadName, setOfficeHeadName] = useState('');
  const [reportStatus, setReportStatus] = useState<ServiceReportStatus>('Generated');
  const [actionLogText, setActionLogText] = useState('');

  // Initialize or reset form values
  useEffect(() => {
    if (!isOpen) return;

    const defaultLogs = getActionLogEntries(ticket, assignee?.name, existingReport?.finalStatus || 'Resolved');
    const defaultLogString = defaultLogs.map(e => `${e.timestamp} : ${e.action}`).join('\n');

    if (existingReport) {
      setReportNumber(existingReport.reportNumber);
      setReportDate(existingReport.reportDate);
      setDiagnosis(existingReport.diagnosis || ticket.subject);
      setTechnicalFindings(existingReport.technicalFindings);
      setActionTaken(existingReport.actionTaken);
      setFinalStatus(existingReport.finalStatus);
      setRecommendation(existingReport.recommendation);
      setIctHeadName(existingReport.ictHeadName || 'Engr. Kenneth Jones D. Alforque');
      setOfficeHeadName(existingReport.officeHeadName || department?.officeHead || (department?.name ? `${department.name} - Head of Office` : 'Head of Office / Authorized Representative'));
      setReportStatus(existingReport.reportStatus);
      setActionLogText(defaultLogString);
      setActiveTab('preview');
    } else {
      // Auto prefill from ticket and assets
      setReportNumber(getNextReportNumber());
      setReportDate(new Date().toISOString().split('T')[0]);
      setDiagnosis(ticket.subject || 'Hardware/Software Technical Assistance');
      
      // Auto-extract findings from recommendations or problem description
      const prefillFindings = ticket.ictRecommendation 
        ? `Assessment: ${ticket.ictRecommendation}`
        : `Reported issue: ${ticket.description}. Hardware/software diagnostics conducted on ${asset ? `${asset.brand} ${asset.model}` : 'device'}.`;
      setTechnicalFindings(prefillFindings);

      // Auto-extract actions from comments or recommendations
      const techComments = (ticket.comments || [])
        .filter(c => !c.text.startsWith('System: Status changed to'))
        .map(c => c.text)
        .join('; ');
      const prefillActions = techComments || ticket.ictRecommendation || 'Troubleshooting, diagnostic evaluation, system cleaning, and hardware inspection conducted.';
      setActionTaken(prefillActions);

      setFinalStatus(ticket.status === 'CLOSED' ? 'Resolved' : 'Repaired');
      setRecommendation(ticket.ictRecommendation || RECOMMENDATION_PRESETS[0]);
      
      setIctHeadName('Engr. Kenneth Jones D. Alforque');
      setOfficeHeadName(department?.officeHead || (department?.name ? `${department.name} - Head of Office` : 'Head of Office / Authorized Representative'));
      setReportStatus('Generated');
      setActionLogText(defaultLogString);
      setActiveTab('form');
    }
  }, [isOpen, ticket.id, existingReport?.id]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!actionTaken.trim()) {
      toast.error('Action taken details are required.');
      return;
    }
    if (!recommendation.trim()) {
      toast.error('Recommendation is required.');
      return;
    }

    setIsSaving(true);
    const finalFindings = technicalFindings.trim() || 'Technical evaluation and troubleshooting conducted.';
    try {
      if (existingReport) {
        await updateServiceReport(existingReport.id, {
          reportDate,
          diagnosis,
          technicalFindings: finalFindings,
          actionTaken,
          finalStatus,
          recommendation,
          preparedByName: currentUser?.name || 'ICT Support',
          ictHeadName,
          officeHeadName,
          reportStatus,
        });
        toast.success(`Service Report ${reportNumber} updated successfully.`);
      } else {
        await createServiceReport({
          reportNumber: reportNumber || getNextReportNumber(),
          ticketId: ticket.id,
          reportDate: reportDate || new Date().toISOString().split('T')[0],
          diagnosis,
          technicalFindings: finalFindings,
          actionTaken,
          finalStatus,
          recommendation,
          preparedByName: currentUser?.name || 'ICT Support',
          preparedById: currentUser?.id,
          ictHeadName: ictHeadName || 'Engr. Kenneth Jones D. Alforque',
          officeHeadName: officeHeadName || 'Head of Office / Authorized Representative',
          reportStatus: reportStatus || 'Generated'
        });
      }
      setActiveTab('preview');
    } catch (err: any) {
      toast.error('Failed to save service report: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const getPageSizeRule = (_size?: PaperSize) => {
    return '@page { size: auto; margin: 8mm 12mm; }';
  };

  // Robust, single-page isolated-iframe printing for universal paper sizes
  const handlePrint = async () => {
    if (existingReport) {
      await markReportPrinted(existingReport.id);
    }

    const printElement = document.getElementById('official-tsr-printout');
    if (!printElement) {
      window.print();
      return;
    }

    // Create an invisible isolated iframe
    const iframe = document.createElement('iframe');
    iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Collect all loaded CSS rules to preserve Tailwind classes
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>ICT Technical Service Report - ${reportNumber || ticket.ticketNumber}</title>
          ${styles}
          <style>
            @page {
              size: auto;
              margin: 8mm 12mm;
            }
            *, *:before, *:after {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100% !important;
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #official-tsr-printout {
              display: block !important;
              visibility: visible !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            th, td {
              border: 1px solid #000000 !important;
              padding: 5px 8px !important;
              font-size: 11px !important;
              line-height: 1.35 !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .bg-gray-100 {
              background-color: #f3f4f6 !important;
            }
            .bg-gray-50 {
              background-color: #f9fafb !important;
            }
            .bg-black {
              background-color: #000000 !important;
              color: #ffffff !important;
            }
            .border-black {
              border-color: #000000 !important;
            }
            .text-red-600 {
              color: #dc2626 !important;
            }
          </style>
        </head>
        <body class="bg-white text-black">
          ${printElement.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    // Allow browser time to parse DOM, then invoke print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 350);
  };

  const displayedActionLog: ActionLogEntry[] = actionLogText.trim()
    ? actionLogText.split('\n').filter(l => l.trim()).map(line => {
        const parts = line.split(' : ');
        if (parts.length >= 2) {
          return { timestamp: parts[0].trim(), action: parts.slice(1).join(' : ').trim() };
        }
        return { timestamp: format(new Date(ticket.createdAt), 'MMM dd, yyyy • hh:mm a'), action: line.trim() };
      })
    : getActionLogEntries(ticket, assignee?.name, finalStatus);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      
      {/* Fallback Print Specific CSS Rules */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 8mm 12mm;
          }
          html, body {
            height: 100% !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          header, aside, nav, form, .no-print {
            display: none !important;
          }
          .fixed.inset-0 {
            position: static !important;
            height: auto !important;
            overflow: visible !important;
            background: transparent !important;
            padding: 0 !important;
          }
          #official-tsr-printout {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            color: #000 !important;
            background: #fff !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .text-green-600 {
            color: #16a34a !important;
          }
          .text-blue-600 {
            color: #2563eb !important;
          }
          .text-amber-600 {
            color: #d97706 !important;
          }
          .text-red-600 {
            color: #dc2626 !important;
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="bg-surface border border-border w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none">
        
        {/* Modal Header */}
        <header className="px-6 py-4 border-b border-border bg-bg/80 flex items-center justify-between shrink-0 print:hidden flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-ink tracking-tight">ICT Technical Service Report</h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-accent text-white shadow-sm">
                  {reportNumber || 'TSR-NEW'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-surface text-ink-muted">
                  Ticket #{ticket.ticketNumber}
                </span>
              </div>
              <p className="text-xs text-ink-muted font-medium">Official Government Technical Report • Municipality of Malungon</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher Tabs */}
            <div className="flex bg-surface border border-border rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'form' 
                    ? 'bg-accent text-white shadow-sm' 
                    : 'text-ink-muted hover:text-ink hover:bg-bg'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'preview' 
                    ? 'bg-accent text-white shadow-sm' 
                    : 'text-ink-muted hover:text-ink hover:bg-bg'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              type="button"
              className="px-4 py-2 bg-ink text-surface text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Print official document or save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-ink-muted hover:text-ink hover:bg-bg rounded-xl transition-all cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6 print:p-0 print:overflow-visible">
          
          {/* TAB 1: FORM EDITOR */}
          {activeTab === 'form' && (
            <form onSubmit={handleSave} className="space-y-6 print:hidden">
              
              {/* Summary Banner */}
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-accent shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Admin Technical Assessment Form</h4>
                    <p className="text-xs text-ink-muted">
                      Pre-populated from Ticket #{ticket.ticketNumber} and linked Asset data. Verify or enrich findings before printing.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-ink-muted">Ticket Status:</span>
                  <span className="font-bold text-green-600 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                    {ticket.status}
                  </span>
                </div>
              </div>

              {/* Grid 1: Basic Identifiers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                    Control / Report Number
                  </label>
                  <input
                    type="text"
                    value={reportNumber}
                    onChange={e => setReportNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-xs font-mono font-bold text-accent outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                    placeholder="TSR-2026-0001"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                    Date of Report
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={e => setReportDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                    Final Equipment Status
                  </label>
                  <select
                    value={finalStatus}
                    onChange={e => setFinalStatus(e.target.value as FinalServiceStatus)}
                    className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm cursor-pointer"
                  >
                    {FINAL_STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 2: Read-only Ticket & Asset Context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg/50 p-4 rounded-xl border border-border">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" /> Requesting Office
                  </h4>
                  <div className="text-xs font-bold text-ink">{department?.name || 'Municipal Office'}</div>
                  <div className="text-xs text-ink-muted">
                    End-User / Requester: <span className="text-ink font-medium">{requester?.name || 'Staff Member'}</span>
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    Date Filed: {format(new Date(ticket.createdAt), 'MMMM dd, yyyy • hh:mm a')}
                  </div>
                </div>

                <div className="space-y-2 border-t md:border-t-0 md:border-l border-border md:pl-4 pt-2 md:pt-0">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" /> Serviced Equipment
                  </h4>
                  {asset ? (
                    <>
                      <div className="text-xs font-bold text-ink">{asset.equipmentType} - {asset.brand} {asset.model}</div>
                      <div className="text-xs text-ink-muted flex flex-wrap gap-x-4 gap-y-1">
                        <span>Property No: <strong className="text-ink font-mono">{asset.propertyNumber || asset.inventoryNumber || 'N/A'}</strong></span>
                        <span>Serial No: <strong className="text-ink font-mono">{asset.serialNumber || 'N/A'}</strong></span>
                        <span>Asset Code: <strong className="text-accent font-mono">{asset.assetCode || 'N/A'}</strong></span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-ink-muted italic">No specific asset record linked to ticket.</div>
                  )}
                </div>
              </div>

              {/* Field: Diagnosis / Reported Problem */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                  Problem Description / Reported Issue
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  placeholder="e.g. Unit does not power on / Blue screen error"
                  required
                />
              </div>

              {/* Field: Technical Assessment / Findings */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                  Technical Assessment & Diagnostic Findings <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={technicalFindings}
                  onChange={e => setTechnicalFindings(e.target.value)}
                  className="w-full p-3.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  placeholder="Describe technical findings, root cause, hardware/software inspection results..."
                  required
                />
              </div>

              {/* Field: Action Taken */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                  Action Taken / Troubleshooting & Repair Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={actionTaken}
                  onChange={e => setActionTaken(e.target.value)}
                  className="w-full p-3.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  placeholder="Detail all repairs done, parts tested or replaced, OS configuration, drivers updated..."
                  required
                />
              </div>

              {/* Field: IV. Action Log & Activity Timeline */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                    IV. Activity Timeline & Action Log (Timestamped List)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const logs = getActionLogEntries(ticket, assignee?.name, finalStatus);
                      setActionLogText(logs.map(e => `${e.timestamp} : ${e.action}`).join('\n'));
                    }}
                    className="text-[10px] text-accent font-bold uppercase tracking-wider hover:underline"
                  >
                    Reset to Default Timeline
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={actionLogText}
                  onChange={e => setActionLogText(e.target.value)}
                  className="w-full p-3.5 bg-bg border border-border rounded-xl text-xs font-mono text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  placeholder="MMM dd, yyyy • hh:mm a : Action..."
                />
                <p className="text-[10px] text-ink-muted mt-1">Format: <code className="font-mono text-ink">Date/Time : Action Description</code></p>
              </div>

              {/* Field: ICT Recommendation with quick presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                    ICT Recommendation <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-accent font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Quick Presets
                  </span>
                </div>
                
                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {RECOMMENDATION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRecommendation(preset)}
                      className="text-[10px] font-medium bg-bg hover:bg-accent/10 hover:text-accent hover:border-accent/30 border border-border px-2.5 py-1 rounded-lg text-ink-muted transition-all text-left"
                    >
                      + {preset.substring(0, 48)}...
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={recommendation}
                  onChange={e => setRecommendation(e.target.value)}
                  className="w-full p-3.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  placeholder="State official recommendation for the requesting office and property custodian..."
                  required
                />
              </div>

              {/* Signatories Grid (Symmetrically aligned 2 columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                    Reviewed / Approved By (Information System Analyst)
                  </label>
                  <input
                    type="text"
                    value={ictHeadName}
                    onChange={e => setIctHeadName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted block mb-1">
                    Received / Noted By (Head of Office / Custodian)
                  </label>
                  <input
                    type="text"
                    value={officeHeadName}
                    onChange={e => setOfficeHeadName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* Status & Save Button */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                    Report Workflow Status:
                  </label>
                  <select
                    value={reportStatus}
                    onChange={e => setReportStatus(e.target.value as ServiceReportStatus)}
                    className="px-3 py-1.5 bg-bg border border-border rounded-lg text-xs font-bold text-ink outline-none cursor-pointer"
                  >
                    {REPORT_STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className="px-4 py-2.5 bg-bg border border-border text-ink rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-surface transition-all cursor-pointer"
                  >
                    Preview Printout
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-accent text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : (existingReport ? 'Update Report' : 'Save & Generate')}</span>
                  </button>
                </div>
              </div>

            </form>
          )}

          {/* TAB 2: OFFICIAL PRINTOUT PREVIEW & PRINT TARGET (Optimized for Single-Page on Universal Sizes) */}
          <div 
            id="official-tsr-printout" 
            className={`bg-white text-black p-6 sm:p-8 mx-auto border border-gray-300 shadow-lg rounded-sm font-serif print:shadow-none print:border-none print:p-0 print:m-0 max-w-[800px] ${
              activeTab === 'preview' ? 'block' : 'hidden print:block'
            }`}
          >
            {/* LGU Letterhead */}
            <div className="pb-2.5 mb-2.5 border-b-2 border-black text-center">
              <div className="relative inline-block text-center max-w-full">
                {/* Seal positioned at the left edge of INFORMATION */}
                <img 
                  src="/LGU_LOGO1.png" 
                  alt="LGU Malungon Seal" 
                  className="w-16 h-16 object-contain absolute left-0 top-0.5"
                  style={{ width: '64px', height: '64px' }}
                />

                {/* 4 Centered Lines */}
                <div className="space-y-0.5 mb-1.5 px-20">
                  <div className="text-[11.5px] font-sans font-medium text-gray-800 leading-tight">Republic of the Philippines</div>
                  <div className="text-[11.5px] font-sans font-medium text-gray-800 leading-tight">Province of Sarangani</div>
                  <div className="text-[13px] font-sans font-bold text-black leading-tight">Municipality of Malungon</div>
                  <div className="text-[11.5px] font-sans font-medium text-gray-800 leading-tight">Office of the Municipal Mayor</div>
                </div>

                {/* Line 5: INFORMATION & COMMUNICATIONS TECHNOLOGY (ICT) SECTION */}
                <div className="text-[13px] font-sans font-black uppercase text-black pt-1 leading-tight tracking-wider">
                  Information & Communications Technology (ICT) Section
                </div>
              </div>
            </div>

            {/* Document Title & Reference Bar */}
            <div className="text-center my-3">
              <h1 className="text-base font-sans font-black uppercase tracking-wider text-black border-y border-black py-0.5 inline-block px-8">
                ICT TECHNICAL SERVICE REPORT
              </h1>
            </div>

            {/* Metadata Bar */}
            <div className="grid grid-cols-2 text-[11px] font-sans border border-black mb-3.5 bg-gray-50 print:bg-transparent">
              <div className="p-2 border-r border-black space-y-0.5">
                <div><span className="font-bold">REPORT NO:</span> <span className="font-mono font-bold text-xs">{reportNumber || 'TSR-PENDING'}</span></div>
                <div><span className="font-bold">DATE GENERATED:</span> {format(new Date(reportDate || new Date()), 'MMMM dd, yyyy')}</div>
              </div>
              <div className="p-2 space-y-0.5">
                <div><span className="font-bold">REFERENCE TICKET NO:</span> <span className="font-mono font-bold">{ticket.ticketNumber}</span></div>
                <div><span className="font-bold">FINAL SERVICE STATUS:</span> <span className={`font-bold uppercase underline ${getFinalStatusColor(finalStatus)}`}>{finalStatus}</span></div>
              </div>
            </div>

            {/* SECTION I: REQUEST & OFFICE INFORMATION */}
            <div className="mb-3.5">
              <div className="bg-black text-white text-[9.5px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-0.5 print:bg-black print:text-white">
                I. Request & Office Information
              </div>
              <table className="w-full text-[11px] font-sans border-collapse border border-black">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-1/3 p-2 bg-gray-100 font-bold border-r border-black">Requesting Office / Dept:</td>
                    <td className="w-2/3 p-2 font-semibold uppercase">{department?.name || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-2 bg-gray-100 font-bold border-r border-black">Date & Time Requested:</td>
                    <td className="p-2">{format(new Date(ticket.createdAt), 'MMMM dd, yyyy • hh:mm a')}</td>
                  </tr>
                  <tr>
                    <td className="p-2 bg-gray-100 font-bold border-r border-black">Issue Category:</td>
                    <td className="p-2 font-semibold">{category?.name || 'Hardware'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION II: SERVICED EQUIPMENT & PROPERTY DETAILS */}
            <div className="mb-3.5">
              <div className="bg-black text-white text-[9.5px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-0.5 print:bg-black print:text-white">
                II. Serviced Equipment & Property Details
              </div>
              <table className="w-full text-[11px] font-sans border-collapse border border-black">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-1/4 p-2 bg-gray-100 font-bold border-r border-black">Equipment Type:</td>
                    <td className="w-1/4 p-2 border-r border-black font-medium">{asset?.equipmentType || 'Computer Unit'}</td>
                    <td className="w-1/4 p-2 bg-gray-100 font-bold border-r border-black">Brand & Model:</td>
                    <td className="w-1/4 p-2 font-medium">{asset ? `${asset.brand} ${asset.model}` : 'Standard Office Machine'}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-2 bg-gray-100 font-bold border-r border-black">Property No.:</td>
                    <td className="p-2 font-mono border-r border-black">{asset?.propertyNumber || asset?.inventoryNumber || 'N/A'}</td>
                    <td className="p-2 bg-gray-100 font-bold border-r border-black">Serial Number:</td>
                    <td className="p-2 font-mono">{asset?.serialNumber || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 bg-gray-100 font-bold border-r border-black">Asset Code:</td>
                    <td className="p-2 font-mono font-bold border-r border-black">{asset?.assetCode || 'N/A'}</td>
                    <td className="p-2 bg-gray-100 font-bold border-r border-black">Assigned to:</td>
                    <td className="p-2 font-medium">{asset?.assignedTo || requester?.name || 'N/A'}</td>
                  </tr>
                  {(asset?.processor || asset?.memory || asset?.diskStorage || asset?.operatingSystem) && (
                    <tr className="border-t border-black bg-gray-50 print:bg-transparent">
                      <td className="p-2 font-bold border-r border-black">Hardware Specs:</td>
                      <td colSpan={3} className="p-2 font-mono text-[10px]">
                        {[asset.processor, asset.memory, asset.diskStorage, asset.operatingSystem].filter(Boolean).join(' | ')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* SECTION III: REPORTED ISSUE */}
            <div className="mb-3.5">
              <div className="bg-black text-white text-[9.5px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-0.5 print:bg-black print:text-white">
                III. Reported Issue
              </div>
              <div className="border border-black p-2.5 text-[11px] font-sans bg-white">
                <div className="font-bold mb-0.5 uppercase text-[9.5px] text-gray-800">Subject / Symptom:</div>
                <p className="whitespace-pre-wrap leading-relaxed text-black font-semibold">{diagnosis || ticket.subject}</p>
              </div>
            </div>

            {/* SECTION IV: TECHNICAL ASSESSMENT & ACTION TAKEN */}
            <div className="mb-3.5">
              <div className="bg-black text-white text-[9.5px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-0.5 print:bg-black print:text-white">
                IV. Technical Assessment & Action Taken
              </div>
              <div className="border border-black p-2.5 text-[11px] font-sans bg-white">
                <div className="space-y-1.5">
                  {displayedActionLog.length > 0 ? (
                    displayedActionLog.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="font-mono text-[10.5px] font-bold text-gray-900 shrink-0">
                          {item.timestamp} :
                        </span>
                        <span className="font-medium text-black">
                          {item.action}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="italic text-gray-500">
                      {format(new Date(ticket.createdAt), 'MMM dd, yyyy • hh:mm a')} : Service activity completed for Ticket #{ticket.ticketNumber}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION V: RECOMMENDATION */}
            <div className="mb-4">
              <div className="bg-black text-white text-[9.5px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-0.5 print:bg-black print:text-white">
                V. ICT Recommendation
              </div>
              <div className="border border-black p-2.5 text-[11px] font-sans bg-gray-50 print:bg-transparent">
                <p className="font-semibold whitespace-pre-wrap leading-relaxed">
                  {recommendation}
                </p>
              </div>
            </div>

            {/* SECTION VI: CERTIFICATION & SIGNATORIES */}
            <div className="mt-4 pt-1">
              <p className="text-[10px] font-sans italic text-center mb-5 text-gray-800 leading-normal max-w-2xl mx-auto">
                I hereby certify that the technical diagnosis, assessment, repair actions and/or recommendations detailed in this document were officially performed by the assigned technician.
              </p>

              <div className="grid grid-cols-2 gap-10 sm:gap-16 max-w-xl mx-auto text-center font-sans">
                {/* Reviewed & Approved By */}
                <div className="flex flex-col justify-end text-center">
                  <div className="text-[9.5px] uppercase font-bold text-gray-700 mb-10">Reviewed & Approved by:</div>
                  <div className="border-b border-black font-black uppercase text-[11.5px] pb-0.5">
                    {ictHeadName || 'Engr. Kenneth Jones D. Alforque'}
                  </div>
                  <div className="text-[9.5px] font-bold text-gray-800 mt-0.5">Information System Analyst</div>
                  <div className="text-[8.5px] text-gray-500 mt-0.5">Date: ____________________</div>
                </div>

                {/* Received & Noted By */}
                <div className="flex flex-col justify-end text-center">
                  <div className="text-[9.5px] uppercase font-bold text-gray-700 mb-10">Received & Noted by:</div>
                  <div className="border-b border-black font-bold uppercase text-[11.5px] pb-0.5">
                    {officeHeadName || 'Authorized Office Representative'}
                  </div>
                  <div className="text-[9.5px] text-gray-700 mt-0.5">Head of Office / Custodian</div>
                  <div className="text-[8.5px] text-gray-500 mt-0.5">Date: ____________________</div>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="mt-5 pt-2 border-t border-gray-300 flex justify-between items-center text-[8px] font-sans text-gray-500">
              <span>LGU Malungon ICT Help Desk System • Official Technical Documentation</span>
              <span>Generated on: {format(new Date(), 'yyyy-MM-dd HH:mm:ss')} • Page 1 of 1</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
