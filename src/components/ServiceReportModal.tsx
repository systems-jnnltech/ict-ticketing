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

  // Initialize or reset form values
  useEffect(() => {
    if (!isOpen) return;

    if (existingReport) {
      setReportNumber(existingReport.reportNumber);
      setReportDate(existingReport.reportDate);
      setDiagnosis(existingReport.diagnosis || ticket.subject);
      setTechnicalFindings(existingReport.technicalFindings);
      setActionTaken(existingReport.actionTaken);
      setFinalStatus(existingReport.finalStatus);
      setRecommendation(existingReport.recommendation);
      setIctHeadName(existingReport.ictHeadName || 'Engr. Kenneth Jones D. Alforque');
      setOfficeHeadName(existingReport.officeHeadName || (department?.name ? `${department.name} - Head of Office` : 'Head of Office / Authorized Representative'));
      setReportStatus(existingReport.reportStatus);
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
      setOfficeHeadName(department?.name ? `${department.name} - Head of Office` : 'Head of Office / Authorized Representative');
      setReportStatus('Generated');
      setActiveTab('form');
    }
  }, [isOpen, ticket.id, existingReport?.id]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!technicalFindings.trim()) {
      toast.error('Technical findings are required.');
      return;
    }
    if (!actionTaken.trim()) {
      toast.error('Action taken details are required.');
      return;
    }
    if (!recommendation.trim()) {
      toast.error('Recommendation is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (existingReport) {
        await updateServiceReport(existingReport.id, {
          reportDate,
          diagnosis,
          technicalFindings,
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
          technicalFindings,
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

  // Robust, pristine isolated-iframe printing that never shows blank in Chrome/Edge
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

    // Collect all loaded CSS rules to ensure exact styling
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
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            *, *:before, *:after {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
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
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            th, td {
              border: 1px solid #000000 !important;
              padding: 4px 6px !important;
              font-size: 11px !important;
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      
      {/* Fallback Print Specific CSS Rules */}
      <style>{`
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
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
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="bg-surface border border-border w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none">
        
        {/* Modal Header */}
        <header className="px-6 py-4 border-b border-border bg-bg/80 flex items-center justify-between shrink-0 print:hidden">
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

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex bg-surface border border-border rounded-xl p-1 shadow-sm mr-2">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'form' 
                    ? 'bg-accent text-white shadow-sm' 
                    : 'text-ink-muted hover:text-ink hover:bg-bg'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit & Review</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'preview' 
                    ? 'bg-accent text-white shadow-sm' 
                    : 'text-ink-muted hover:text-ink hover:bg-bg'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>A4 Print View</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              type="button"
              className="px-4 py-2 bg-ink text-surface text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Print official document or save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print / Save PDF</span>
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

          {/* TAB 2: A4 OFFICIAL PRINTOUT PREVIEW & PRINT TARGET */}
          <div 
            id="official-tsr-printout" 
            className={`bg-white text-black p-8 sm:p-12 max-w-[800px] mx-auto border border-gray-300 shadow-lg rounded-sm font-serif print:shadow-none print:border-none print:p-0 print:max-w-none print:m-0 ${
              activeTab === 'preview' ? 'block' : 'hidden print:block'
            }`}
            style={{ minHeight: '1050px' }}
          >
            {/* LGU Letterhead */}
            <div className="text-center relative pb-3 border-b-2 border-black">
              <div className="flex items-center justify-center gap-4">
                <img 
                  src="/LGU_LOGO1.png" 
                  alt="LGU Malungon Seal" 
                  className="w-16 h-16 object-contain absolute left-2 top-0 print:left-0"
                />
                <div className="space-y-0.5">
                  <div className="text-[11px] font-sans font-bold tracking-wider uppercase text-gray-700">Republic of the Philippines</div>
                  <div className="text-[11px] font-sans font-bold tracking-wider uppercase text-gray-700">Province of Sarangani</div>
                  <div className="text-xs font-sans font-black tracking-wider uppercase text-black">Municipality of Malungon</div>
                  <div className="text-[11px] font-sans font-bold tracking-wider uppercase text-gray-800">Office of the Municipal Mayor</div>
                  <div className="text-xs font-sans font-black tracking-wider uppercase text-black pt-1">
                    Information & Communications Technology (ICT) Section
                  </div>
                </div>
              </div>
            </div>

            {/* Document Title & Reference Bar */}
            <div className="text-center my-4">
              <h1 className="text-lg font-sans font-black uppercase tracking-wider text-black border-y border-black py-1 inline-block px-8">
                ICT TECHNICAL SERVICE REPORT
              </h1>
            </div>

            {/* Metadata Bar */}
            <div className="grid grid-cols-2 text-xs font-sans border border-black mb-4 bg-gray-50 print:bg-transparent">
              <div className="p-2 border-r border-black space-y-1">
                <div><span className="font-bold">REPORT NO:</span> <span className="font-mono font-bold text-sm">{reportNumber || 'TSR-PENDING'}</span></div>
                <div><span className="font-bold">DATE GENERATED:</span> {format(new Date(reportDate || new Date()), 'MMMM dd, yyyy')}</div>
              </div>
              <div className="p-2 space-y-1">
                <div><span className="font-bold">REFERENCE TICKET NO:</span> <span className="font-mono font-bold">{ticket.ticketNumber}</span></div>
                <div><span className="font-bold">FINAL SERVICE STATUS:</span> <span className="font-bold uppercase underline">{finalStatus}</span></div>
              </div>
            </div>

            {/* SECTION A: REQUESTING OFFICE DETAILS */}
            <div className="mb-4">
              <div className="bg-black text-white text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-1 print:bg-black print:text-white">
                I. Request & Office Information
              </div>
              <table className="w-full text-xs font-sans border-collapse border border-black">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-1/3 p-1.5 bg-gray-100 font-bold border-r border-black">Requesting Office / Dept:</td>
                    <td className="w-2/3 p-1.5 font-semibold uppercase">{department?.name || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1.5 bg-gray-100 font-bold border-r border-black">End-User / Requested By:</td>
                    <td className="p-1.5">{requester?.name || 'Staff'} ({requester?.email || 'N/A'})</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1.5 bg-gray-100 font-bold border-r border-black">Date & Time Requested:</td>
                    <td className="p-1.5">{format(new Date(ticket.createdAt), 'MMMM dd, yyyy • hh:mm a')}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 bg-gray-100 font-bold border-r border-black">Issue Category & Priority:</td>
                    <td className="p-1.5">{category?.name || 'Hardware Support'} • <span className="font-bold uppercase">{ticket.priority} Priority</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION B: EQUIPMENT / ASSET DETAILS */}
            <div className="mb-4">
              <div className="bg-black text-white text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-1 print:bg-black print:text-white">
                II. Serviced Equipment & Property Details
              </div>
              <table className="w-full text-xs font-sans border-collapse border border-black">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-1/4 p-1.5 bg-gray-100 font-bold border-r border-black">Equipment Type:</td>
                    <td className="w-1/4 p-1.5 border-r border-black">{asset?.equipmentType || 'Computer Unit'}</td>
                    <td className="w-1/4 p-1.5 bg-gray-100 font-bold border-r border-black">Brand & Model:</td>
                    <td className="w-1/4 p-1.5">{asset ? `${asset.brand} ${asset.model}` : 'Standard Office Machine'}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1.5 bg-gray-100 font-bold border-r border-black">Property / Inv. No:</td>
                    <td className="p-1.5 font-mono border-r border-black">{asset?.propertyNumber || asset?.inventoryNumber || 'N/A'}</td>
                    <td className="p-1.5 bg-gray-100 font-bold border-r border-black">Serial Number:</td>
                    <td className="p-1.5 font-mono">{asset?.serialNumber || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 bg-gray-100 font-bold border-r border-black">Asset Code / Tag:</td>
                    <td className="p-1.5 font-mono font-bold border-r border-black">{asset?.assetCode || 'N/A'}</td>
                    <td className="p-1.5 bg-gray-100 font-bold border-r border-black">Assigned Location:</td>
                    <td className="p-1.5">{asset?.exactLocation || department?.name || 'LGU Malungon Compound'}</td>
                  </tr>
                  {(asset?.processor || asset?.memory || asset?.diskStorage || asset?.operatingSystem) && (
                    <tr className="border-t border-black bg-gray-50 print:bg-transparent">
                      <td className="p-1.5 font-bold border-r border-black">Hardware Specs:</td>
                      <td colSpan={3} className="p-1.5 font-mono text-[11px]">
                        {[asset.processor, asset.memory, asset.diskStorage, asset.operatingSystem].filter(Boolean).join(' | ')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* SECTION C: REPORTED PROBLEM & DIAGNOSIS */}
            <div className="mb-4">
              <div className="bg-black text-white text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-1 print:bg-black print:text-white">
                III. Reported Issue & Diagnosis
              </div>
              <div className="border border-black p-2 text-xs font-sans space-y-1">
                <div><strong className="font-bold">Subject / Symptom:</strong> {diagnosis}</div>
                <div className="text-gray-700 italic border-t border-gray-300 pt-1 mt-1">
                  "{ticket.description}"
                </div>
              </div>
            </div>

            {/* SECTION D: TECHNICAL ASSESSMENT & ACTION TAKEN */}
            <div className="mb-4">
              <div className="bg-black text-white text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-1 print:bg-black print:text-white">
                IV. Technical Assessment & Action Taken
              </div>
              <div className="border border-black text-xs font-sans">
                <div className="p-2 border-b border-black">
                  <div className="font-bold mb-1 uppercase text-[10px] text-gray-700">A. Diagnostic Findings & Root Cause:</div>
                  <p className="whitespace-pre-wrap leading-relaxed">{technicalFindings}</p>
                </div>
                <div className="p-2">
                  <div className="font-bold mb-1 uppercase text-[10px] text-gray-700">B. Troubleshooting Conducted & Action Taken:</div>
                  <p className="whitespace-pre-wrap leading-relaxed">{actionTaken}</p>
                </div>
              </div>
            </div>

            {/* SECTION E: RECOMMENDATION */}
            <div className="mb-6">
              <div className="bg-black text-white text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 mb-1 print:bg-black print:text-white">
                V. ICT Recommendation
              </div>
              <div className="border border-black p-2.5 text-xs font-sans bg-gray-50 print:bg-transparent">
                <p className="font-semibold whitespace-pre-wrap leading-relaxed">
                  {recommendation}
                </p>
              </div>
            </div>

            {/* SECTION F: CERTIFICATION & SIGNATORIES (Aligned 2 columns) */}
            <div className="mt-8 pt-2">
              <p className="text-[10px] font-sans italic text-center mb-8 text-gray-800">
                I hereby certify that the technical diagnosis, assessment, and repair actions detailed in this document were officially performed in accordance with standard LGU ICT maintenance procedures.
              </p>

              <div className="grid grid-cols-2 gap-12 sm:gap-20 max-w-2xl mx-auto text-center font-sans">
                {/* Reviewed & Approved By */}
                <div className="flex flex-col justify-end text-center">
                  <div className="text-[10px] uppercase font-bold text-gray-700 mb-10">Reviewed & Approved by:</div>
                  <div className="border-b border-black font-black uppercase text-xs pb-0.5">
                    {ictHeadName || 'Engr. Kenneth Jones D. Alforque'}
                  </div>
                  <div className="text-[10px] font-bold text-gray-800 mt-1">Information System Analyst</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Date: ____________________</div>
                </div>

                {/* Received & Noted By */}
                <div className="flex flex-col justify-end text-center">
                  <div className="text-[10px] uppercase font-bold text-gray-700 mb-10">Received & Noted by:</div>
                  <div className="border-b border-black font-bold uppercase text-xs pb-0.5">
                    {officeHeadName || 'Authorized Office Representative'}
                  </div>
                  <div className="text-[10px] text-gray-700 mt-1">Head of Office / Custodian</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Date: ____________________</div>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="mt-12 pt-2 border-t border-gray-300 flex justify-between items-center text-[8px] font-sans text-gray-500">
              <span>LGU Malungon ICT Help Desk System • Official Technical Documentation</span>
              <span>Generated on: {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</span>
              <span>Page 1 of 1</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
