import React, { useState } from "react";
import { useAppContext } from "../store/AppContext";
import { Office } from "../store/mockData";
import { Building2, Plus, Edit2, Check, X } from "lucide-react";
import { Toast, ConfirmModal } from "../lib/toast";

export function AdminDepartments() {
  const { offices, createNewOffice, updateExistingOffice } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");

  const [isAdding, setIsAdding] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficeHead, setNewOfficeHead] = useState("");
  const [newAcronym, setNewAcronym] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOfficeHead, setEditOfficeHead] = useState("");
  const [editAcronym, setEditAcronym] = useState("");
  const [editEmail, setEditEmail] = useState("");

  let displayedOffices = offices;
  if (searchQuery.trim()) {
    const lowerQuery = searchQuery.toLowerCase();
    displayedOffices = displayedOffices.filter(
      (o) =>
        o.name.toLowerCase().includes(lowerQuery) ||
        o.officeHead?.toLowerCase().includes(lowerQuery) ||
        o.acronym?.toLowerCase().includes(lowerQuery) ||
        o.email?.toLowerCase().includes(lowerQuery) ||
        o.id.toLowerCase().includes(lowerQuery)
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOfficeName.trim()) {
      const result = await ConfirmModal.fire({
        text: "Are you sure you want to add this department?",
      });
      if (result.isConfirmed) {
        await createNewOffice({
          name: newOfficeName.trim(),
          officeHead: newOfficeHead.trim() || undefined,
          acronym: newAcronym.trim() || undefined,
          email: newEmail.trim() || undefined,
        });
        setNewOfficeName("");
        setNewOfficeHead("");
        setNewAcronym("");
        setNewEmail("");
        setIsAdding(false);
        Toast.fire({
          icon: "success",
          title: "Department added",
        });
      }
    }
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingId && editName.trim()) {
      const result = await ConfirmModal.fire({
        text: "Are you sure you want to update this department?",
      });
      if (result.isConfirmed) {
        await updateExistingOffice(editingId, {
          name: editName.trim(),
          officeHead: editOfficeHead.trim() || undefined,
          acronym: editAcronym.trim() || undefined,
          email: editEmail.trim() || undefined,
        });
        cancelEdit();
        Toast.fire({
          icon: "success",
          title: "Department updated",
        });
      }
    }
  };

  const startEdit = (office: Office) => {
    setEditingId(office.id);
    setEditName(office.name);
    setEditOfficeHead(office.officeHead || "");
    setEditAcronym(office.acronym || "");
    setEditEmail(office.email || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditOfficeHead("");
    setEditAcronym("");
    setEditEmail("");
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-2">
        <div>
          <h1 className="font-black text-[2.75rem] leading-none tracking-tighter mb-3 text-ink">
            Departments
          </h1>
          <p className="text-ink-muted text-sm font-medium tracking-wide">
            Manage LGU departments and offices
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2.5 bg-accent text-white px-5 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-sm hover:opacity-90 transition-all active:scale-95 border-none"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </section>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-6 py-5 border-b border-border bg-bg/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-[11px] font-bold flex items-center gap-3 text-ink">
            <div className="w-2 h-4 bg-accent rounded-[1px]"></div>
            <span className="uppercase tracking-widest">LGU Departments</span>
          </div>
          <div className="relative w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search departments or office head..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-bg border border-border rounded-xl text-ink px-4 py-2.5 text-sm font-medium w-full sm:w-[320px] outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Add Department Inline Form */}
        {isAdding && (
          <div className="p-6 border-b border-border bg-bg/30">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-ink">Add New Department</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    type="text"
                    required
                    placeholder="e.g. Municipal Engineering Office"
                    value={newOfficeName}
                    onChange={(e) => setNewOfficeName(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
                    Name of Office Head
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Engr. Juan Dela Cruz"
                    value={newOfficeHead}
                    onChange={(e) => setNewOfficeHead(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
                    Acronym
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MEO"
                    value={newAcronym}
                    onChange={(e) => setNewAcronym(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. meo@malungon.gov.ph"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewOfficeName("");
                    setNewOfficeHead("");
                    setNewAcronym("");
                    setNewEmail("");
                  }}
                  className="bg-surface border border-border text-ink-muted px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-bg hover:text-ink transition-all shadow-sm"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="submit"
                  className="bg-accent text-white px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm active:scale-95"
                >
                  <Check className="w-4 h-4" /> Save Department
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-surface border-b border-border">
              <tr className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
                <th className="px-6 py-4 font-bold">Department Name</th>
                <th className="px-6 py-4 font-bold">Name of Office Head</th>
                <th className="px-6 py-4 font-bold">Acronym</th>
                <th className="px-6 py-4 font-bold">Email</th>
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {displayedOffices.map((office) => {
                const isEditing = editingId === office.id;
                return (
                  <tr
                    key={office.id}
                    className="hover:bg-bg/50 transition-colors group border-b border-border group-last:border-none"
                    onKeyDown={(e) => {
                      if (isEditing) {
                        if (e.key === "Enter") handleUpdate();
                        if (e.key === "Escape") cancelEdit();
                      }
                    }}
                  >
                    {/* Department Name */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Department Name"
                          className="w-full min-w-[200px] bg-bg border border-border rounded-lg text-ink px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                        />
                      ) : (
                        <div className="text-[14px] font-bold text-ink flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center shadow-sm flex-shrink-0">
                            <Building2 className="w-4 h-4 text-ink-muted" />
                          </div>
                          <span>{office.name}</span>
                        </div>
                      )}
                    </td>

                    {/* Name of Office Head */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editOfficeHead}
                          onChange={(e) => setEditOfficeHead(e.target.value)}
                          placeholder="e.g. Engr. Juan Dela Cruz"
                          className="w-full min-w-[180px] bg-bg border border-border rounded-lg text-ink px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                        />
                      ) : (
                        <div className="text-[13px] font-medium">
                          {office.officeHead ? (
                            <span className="font-semibold text-ink">{office.officeHead}</span>
                          ) : (
                            <span className="text-ink-muted italic">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Acronym */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editAcronym}
                          onChange={(e) => setEditAcronym(e.target.value)}
                          placeholder="Acronym"
                          className="w-24 bg-bg border border-border rounded-lg text-ink px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                        />
                      ) : (
                        <span className="text-[13px] font-medium text-ink-muted">
                          {office.acronym || "-"}
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                          className="w-full min-w-[180px] bg-bg border border-border rounded-lg text-ink px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
                        />
                      ) : (
                        <span className="text-[13px] font-medium text-ink-muted">
                          {office.email || "-"}
                        </span>
                      )}
                    </td>

                    {/* ID */}
                    <td className="px-6 py-4 font-mono text-ink-muted text-[11px] tracking-wider">
                      {office.id}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate()}
                            title="Save Changes"
                            className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            title="Cancel"
                            className="p-2 bg-surface border border-border text-ink-muted rounded-lg hover:bg-bg hover:text-ink transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(office)}
                          title="Edit Department"
                          className="text-ink-muted hover:text-accent transition-colors p-2 opacity-0 group-hover:opacity-100 hover:bg-accent/10 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
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
