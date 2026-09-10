import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ServiceReport, FinalServiceStatus, ServiceReportStatus } from '../store/mockData';
import { ServiceReportModal } from './ServiceReportModal';
import { 
  FileText, Search, Printer, Eye, Edit, Trash2, Filter, 
  CheckCircle2, Clock, Building, User, Monitor, ChevronRight,
  Download, Plus, RefreshCw, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmModal, Toast } from '../lib/toast';

interface AdminServiceReportsProps {
  onViewTicket?: (ticketId: string) => void;
}

export function AdminServiceReports({ onViewTicket }: AdminServiceReportsProps) {
  const { serviceReports, tickets, assets, offices, deleteServiceReport, currentUser } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterFinalStatus, setFilterFinalStatus] = useState<string>('ALL');
  const [filterReportStatus, setFilterReportStatus] = useState<string>('ALL');

  // Modal active state
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    const total = serviceReports.length;
    const resolvedOrRepaired = serviceReports.filter(r => r.finalStatus === 'Resolved' || r.finalStatus === 'Repaired').length;
    const signed = serviceReports.filter(r => r.reportStatus === 'Signed' || r.reportStatus === 'Released').length;
    const forReplacementOrProcurement = serviceReports.filter(r => 
      r.finalStatus === 'For Replacement' || r.finalStatus === 'For Procurement' || r.finalStatus === 'For Disposal'
    ).length;

    return { total, resolvedOrRepaired, signed, forReplacementOrProcurement };
  }, [serviceReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return serviceReports.filter(report => {
      const ticket = tickets.find(t => t.id === report.ticketId);
      const office = offices.find(o => o.id === ticket?.officeId);
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (report.reportNumber && report.reportNumber.toLowerCase().includes(searchLower)) ||
        (ticket && ticket.ticketNumber.toLowerCase().includes(searchLower)) ||
        (office && office.name.toLowerCase().includes(searchLower)) ||
        (report.preparedByName && report.preparedByName.toLowerCase().includes(searchLower)) ||
        (report.recommendation && report.recommendation.toLowerCase().includes(searchLower));

      const matchesFinalStatus = filterFinalStatus === 'ALL' || report.finalStatus === filterFinalStatus;
      const matchesReportStatus = filterReportStatus === 'ALL' || report.reportStatus === filterReportStatus;

      return matchesSearch && matchesFinalStatus && matchesReportStatus;
    });
  }, [serviceReports, tickets, offices, searchTerm, filterFinalStatus, filterReportStatus]);

  const handleOpenReport = (report: ServiceReport) => {
    setSelectedReportId(report.id);
    setSelectedTicketId(report.ticketId);
    setIsModalOpen(true);
  };

  const handleDelete = async (report: ServiceReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await ConfirmModal.fire({
      title: 'Delete Service Report?',
      text: `Are you sure you want to permanently delete report ${report.reportNumber}? This cannot be undone.`
    });

    if (result.isConfirmed) {
      await deleteServiceReport(report.id);
      Toast.fire({ icon: 'success', title: 'Service report deleted' });
    }
  };

  const currentTicketForModal = tickets.find(t => t.id === selectedTicketId);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-ink tracking-tight">ICT Service Reports</h1>
              <p className="text-xs md:text-sm text-ink-muted font-medium">
                Official technical service reports (TSR) generated for completed maintenance & repair tickets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Total Reports</div>
            <div className="text-2xl font-black text-ink mt-1 font-mono">{stats.total}</div>
            <div className="text-[11px] text-ink-muted font-medium mt-0.5">Formal TSRs created</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Resolved / Repaired</div>
            <div className="text-2xl font-black text-green-600 mt-1 font-mono">{stats.resolvedOrRepaired}</div>
            <div className="text-[11px] text-ink-muted font-medium mt-0.5">Units restored to service</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Signed / Released</div>
            <div className="text-2xl font-black text-purple-600 mt-1 font-mono">{stats.signed}</div>
            <div className="text-[11px] text-ink-muted font-medium mt-0.5">Submitted to Offices</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 shadow-sm">
            <Printer className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">For Replacement / Disposal</div>
            <div className="text-2xl font-black text-amber-600 mt-1 font-mono">{stats.forReplacementOrProcurement}</div>
            <div className="text-[11px] text-ink-muted font-medium mt-0.5">Condemned or for procurement</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-sm">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 md:p-5 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search by Report No, Ticket No, Office, or Technician..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 transition-all"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-ink-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Final Status:</span>
            <select
              value={filterFinalStatus}
              onChange={e => setFilterFinalStatus(e.target.value)}
              className="px-3 py-2 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none cursor-pointer"
            >
              <option value="ALL">All Final Statuses</option>
              <option value="Resolved">Resolved</option>
              <option value="Repaired">Repaired</option>
              <option value="For Monitoring">For Monitoring</option>
              <option value="For Further Assessment">For Further Assessment</option>
              <option value="For Replacement">For Replacement</option>
              <option value="For Procurement">For Procurement</option>
              <option value="For Disposal">For Disposal</option>
              <option value="Referred to Service Provider">Referred to Service Provider</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Workflow:</span>
            <select
              value={filterReportStatus}
              onChange={e => setFilterReportStatus(e.target.value)}
              className="px-3 py-2 bg-bg border border-border rounded-xl text-xs font-medium text-ink outline-none cursor-pointer"
            >
              <option value="ALL">All Workflow States</option>
              <option value="Draft">Draft</option>
              <option value="Generated">Generated</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Signed">Signed</option>
              <option value="Released">Released</option>
            </select>
          </div>
        </div>

      </div>

      {/* Reports Table */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        {filteredReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg/60 border-b border-border text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                <tr>
                  <th className="py-4 px-6">Report No.</th>
                  <th className="py-4 px-6">Ticket Reference</th>
                  <th className="py-4 px-6">Requesting Office</th>
                  <th className="py-4 px-6">Equipment</th>
                  <th className="py-4 px-6">Report Date</th>
                  <th className="py-4 px-6">Final Status</th>
                  <th className="py-4 px-6">Workflow</th>
                  <th className="py-4 px-6">Reviewed By</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map(report => {
                  const ticket = tickets.find(t => t.id === report.ticketId);
                  const office = offices.find(o => o.id === ticket?.officeId);
                  const asset = assets.find(a => a.id === ticket?.assetId || a.assetCode === ticket?.assetId);

                  let statusBadgeClass = 'bg-blue-500/10 text-blue-600 border-blue-500/20';
                  if (report.finalStatus === 'Resolved' || report.finalStatus === 'Repaired') {
                    statusBadgeClass = 'bg-green-500/10 text-green-600 border-green-500/20';
                  } else if (report.finalStatus === 'For Disposal' || report.finalStatus === 'For Replacement') {
                    statusBadgeClass = 'bg-red-500/10 text-red-600 border-red-500/20';
                  } else if (report.finalStatus === 'For Procurement' || report.finalStatus === 'For Monitoring') {
                    statusBadgeClass = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                  }

                  let workflowBadgeClass = 'bg-slate-500/10 text-slate-600 border-slate-500/20';
                  if (report.reportStatus === 'Reviewed' || report.reportStatus === 'Signed') {
                    workflowBadgeClass = 'bg-purple-500/10 text-purple-600 border-purple-500/20';
                  } else if (report.reportStatus === 'Released') {
                    workflowBadgeClass = 'bg-green-500/10 text-green-600 border-green-500/20';
                  }

                  return (
                    <tr 
                      key={report.id}
                      onClick={() => handleOpenReport(report)}
                      className="hover:bg-bg/50 transition-colors cursor-pointer group"
                    >
                      {/* Report Number */}
                      <td className="py-4 px-6 font-mono font-bold text-accent whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-accent" />
                          <span>{report.reportNumber}</span>
                        </div>
                      </td>

                      {/* Ticket Reference */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {ticket ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewTicket) onViewTicket(ticket.id);
                            }}
                            className="text-xs font-mono font-bold text-ink hover:text-accent hover:underline flex items-center gap-1"
                          >
                            <span>{ticket.ticketNumber}</span>
                          </button>
                        ) : (
                          <span className="text-ink-muted">Ticket deleted</span>
                        )}
                      </td>

                      {/* Requesting Office */}
                      <td className="py-4 px-6 max-w-[200px] truncate font-medium text-ink">
                        {office?.name || 'Municipal Office'}
                      </td>

                      {/* Equipment */}
                      <td className="py-4 px-6 max-w-[200px] truncate text-ink-muted">
                        {asset ? `${asset.equipmentType} - ${asset.brand}` : (ticket?.subject || 'N/A')}
                      </td>

                      {/* Report Date */}
                      <td className="py-4 px-6 whitespace-nowrap text-ink-muted">
                        {format(new Date(report.reportDate), 'MMM dd, yyyy')}
                      </td>

                      {/* Final Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass}`}>
                          {report.finalStatus}
                        </span>
                      </td>

                      {/* Workflow Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${workflowBadgeClass}`}>
                          {report.reportStatus}
                        </span>
                      </td>

                      {/* Reviewed By */}
                      <td className="py-4 px-6 whitespace-nowrap text-ink">
                        <div className="font-semibold">{report.ictHeadName || 'Engr. Kenneth Jones D. Alforque'}</div>
                        <div className="text-[10px] text-ink-muted">Information System Analyst</div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenReport(report)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent/10 transition-colors"
                            title="View / Print Service Report"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenReport(report)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-bg transition-colors"
                            title="Edit Report Details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDelete(report, e)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-bg border border-border flex items-center justify-center text-ink-muted mx-auto mb-4 shadow-sm">
              <FileText className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-base font-bold text-ink mb-1">No Service Reports Found</h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto mb-6">
              {searchTerm || filterFinalStatus !== 'ALL' || filterReportStatus !== 'ALL'
                ? 'No reports match your current search or filter criteria.'
                : 'Service reports can be generated from any ticket once its status has been marked as RESOLVED or CLOSED by the ICT team.'}
            </p>
          </div>
        )}
      </div>

      {/* Render ServiceReportModal if open */}
      {isModalOpen && currentTicketForModal && (
        <ServiceReportModal
          ticket={currentTicketForModal}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedReportId(null);
            setSelectedTicketId(null);
          }}
          existingReportId={selectedReportId || undefined}
        />
      )}

    </div>
  );
}
