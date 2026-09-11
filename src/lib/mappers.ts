import { ServiceReport, Office } from '../store/mockData';

const parseNumericCost = (val: any) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    if (!val || val.trim() === '' || val.toUpperCase().includes('N/A')) return null;
    const cleaned = val.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

const parseDateValue = (val: any) => {
  if (!val || typeof val !== 'string' || val.toUpperCase().includes('N/A') || val.trim() === '') return null;
  return val.split('T')[0];
};

const isValidUUID = (str: any) => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const sanitizeDepartmentId = (id: any) => {
  if (!id || typeof id !== 'string') return null;
  if (isValidUUID(id)) return id;
  return null;
};

export function findOfficeForAsset(asset: any, offices: { id: string; name: string; acronym?: string }[]) {
  if (!offices || offices.length === 0) return null;

  // 1. Direct match by ID
  if (asset.officeId) {
    const direct = offices.find(o => o.id === asset.officeId);
    if (direct) return direct;
  }

  const textToSearch = `${asset.officeName || ''} ${asset.officeAcronym || ''} ${asset.exactLocation || ''} ${asset.remarks || ''}`.trim().toLowerCase();
  if (!textToSearch) return null;

  // 2. Match by exact office acronym
  for (const office of offices) {
    if (office.acronym && office.acronym.trim()) {
      const acr = office.acronym.trim().toLowerCase();
      const regex = new RegExp(`\\b${acr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
      if (regex.test(textToSearch)) {
        return office;
      }
    }
  }

  // 3. Match by full or partial office name
  for (const office of offices) {
    const nameLower = office.name.toLowerCase();
    if (textToSearch.includes(nameLower) || nameLower.includes(textToSearch)) {
      return office;
    }
  }

  // 4. Keyword match
  for (const office of offices) {
    if (office.acronym) {
      const acr = office.acronym.trim().toLowerCase();
      if (textToSearch.includes(acr)) return office;
    }
  }

  return null;
}

export const mapAssetFromDB = (dbAsset: any) => ({
  id: dbAsset.id,
  assetCode: dbAsset.asset_code || dbAsset.id,
  officeId: dbAsset.department_id,
  equipmentType: dbAsset.equipment_type,
  propertyNumber: dbAsset.property_number || '',
  inventoryNumber: dbAsset.inventory_number,
  brand: dbAsset.brand,
  model: dbAsset.model,
  serialNumber: dbAsset.serial_number,
  hostname: dbAsset.hostname,
  processor: dbAsset.processor,
  memory: dbAsset.memory,
  diskStorage: dbAsset.disk_storage,
  assignedTo: dbAsset.assigned_to,
  exactLocation: dbAsset.exact_location,
  operatingSystem: dbAsset.operating_system,
  microsoftOffice: dbAsset.microsoft_office,
  condition: dbAsset.condition,
  operationalStatus: dbAsset.operational_status,
  acquisitionCost: dbAsset.acquisition_cost != null ? `PHP ${Number(dbAsset.acquisition_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A',
  dateAcquired: dbAsset.date_acquired || 'N/A',
  dateAudited: dbAsset.date_audited || 'N/A',
  auditedBy: dbAsset.audited_by,
  remarks: dbAsset.remarks
});

export const mapAssetToDB = (asset: any) => ({
  department_id: sanitizeDepartmentId(asset.officeId),
  equipment_type: asset.equipmentType,
  asset_code: asset.assetCode || `ICT-AST-${Math.random().toString(36).substring(2, 8)}`,
  property_number: asset.propertyNumber || null,
  inventory_number: asset.inventoryNumber || null,
  brand: asset.brand || null,
  model: asset.model || null,
  serial_number: asset.serialNumber || null,
  hostname: asset.hostname || null,
  processor: asset.processor || null,
  memory: asset.memory || null,
  disk_storage: asset.diskStorage || null,
  assigned_to: asset.assignedTo || null,
  exact_location: asset.exactLocation || null,
  operating_system: asset.operatingSystem || null,
  microsoft_office: asset.microsoftOffice || null,
  condition: asset.condition || 'Good',
  operational_status: asset.operationalStatus || 'Operational',
  acquisition_cost: parseNumericCost(asset.acquisitionCost),
  date_acquired: parseDateValue(asset.dateAcquired),
  date_audited: parseDateValue(asset.dateAudited),
  audited_by: asset.auditedBy || null,
  remarks: asset.remarks || null,
});

export const mapTicketFromDB = (dbTicket: any) => {
  let description = dbTicket.description || '';
  let assetId = undefined;
  
  const assetIdMatch = description.match(/<!-- ASSET_ID:(.+?) -->/);
  if (assetIdMatch) {
    assetId = assetIdMatch[1];
    description = description.replace(assetIdMatch[0], '').trim();
  }

  return {
    id: dbTicket.id,
    ticketNumber: dbTicket.id.split('-')[0].toUpperCase(),
    requesterId: dbTicket.reported_by,
    officeId: dbTicket.department_id,
    categoryId: dbTicket.category,
    priority: dbTicket.priority,
    subject: dbTicket.title,
    description: description,
    assetId: assetId,
    status: dbTicket.status.toUpperCase(),
    assignedToId: dbTicket.assigned_to,
    createdAt: dbTicket.created_at,
    updatedAt: dbTicket.updated_at,
    ictRecommendation: dbTicket.recommendation,
    comments: dbTicket.ticket_comments ? dbTicket.ticket_comments.map((c: any) => ({
      id: c.id,
      userId: c.author_id,
      text: c.content,
      createdAt: c.created_at
    })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [] 
  };
};

export const mapTicketToDB = (ticket: any) => ({
  title: ticket.subject,
  description: ticket.description,
  status: ticket.status || 'NEW',
  priority: ticket.priority,
  category: ticket.categoryId,
  reported_by: ticket.requesterId,
  assigned_to: ticket.assignedToId,
  department_id: sanitizeDepartmentId(ticket.officeId),
  recommendation: ticket.ictRecommendation
});

export const mapUserFromDB = (dbProfile: any) => ({
  id: dbProfile.id,
  name: dbProfile.full_name,
  email: dbProfile.email,
  role: dbProfile.role === 'system_admin' ? 'Admin' : (dbProfile.role === 'ict_support' ? 'ICT Support' : 'Department User'),
  officeId: dbProfile.department_id,
});

export const mapOfficeFromDB = (dbDepartment: any): Office => ({
  id: dbDepartment.id,
  name: dbDepartment.name,
  officeHead: dbDepartment.office_head || dbDepartment.head_of_office || undefined,
  acronym: dbDepartment.acronym,
  email: dbDepartment.email
});

export const mapOfficeToDB = (office: Partial<Office> | { name: string; officeHead?: string; acronym?: string; email?: string }) => ({
  name: office.name,
  office_head: office.officeHead || null,
  acronym: office.acronym || null,
  email: office.email || null,
});

export const mapServiceReportFromDB = (dbReport: any): ServiceReport => ({
  id: dbReport.id,
  reportNumber: dbReport.report_number,
  ticketId: dbReport.ticket_id,
  reportDate: dbReport.report_date ? String(dbReport.report_date).split('T')[0] : new Date().toISOString().split('T')[0],
  diagnosis: dbReport.diagnosis || '',
  technicalFindings: dbReport.technical_findings || '',
  actionTaken: dbReport.action_taken || '',
  finalStatus: dbReport.final_status || 'Resolved',
  recommendation: dbReport.recommendation || '',
  preparedByName: dbReport.prepared_by_name || 'ICT Personnel',
  preparedById: dbReport.prepared_by_id || undefined,
  ictHeadName: dbReport.ict_head_name || 'Engr. Kenneth Jones D. Alforque',
  officeHeadName: dbReport.office_head_name || 'Head of Office / Authorized Representative',
  reportStatus: dbReport.report_status || 'Generated',
  createdAt: dbReport.created_at,
  updatedAt: dbReport.updated_at,
  printedAt: dbReport.printed_at || undefined,
});

export const mapServiceReportToDB = (report: Partial<ServiceReport>) => ({
  report_number: report.reportNumber,
  ticket_id: report.ticketId,
  report_date: report.reportDate,
  diagnosis: report.diagnosis || null,
  technical_findings: report.technicalFindings,
  action_taken: report.actionTaken,
  final_status: report.finalStatus,
  recommendation: report.recommendation,
  prepared_by_name: report.preparedByName,
  prepared_by_id: report.preparedById || null,
  ict_head_name: report.ictHeadName || 'Engr. Kenneth Jones D. Alforque',
  office_head_name: report.officeHeadName || 'Head of Office / Authorized Representative',
  report_status: report.reportStatus || 'Generated',
  printed_at: report.printedAt || null,
});

