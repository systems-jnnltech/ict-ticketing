import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ArrowLeft } from 'lucide-react';
import { Toast, ConfirmModal } from '../lib/toast';

export function CreateTicket({ onBack }: { onBack: () => void }) {
  const { categories, assets, currentUser, createNewTicket } = useAppContext();
  
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [assetId, setAssetId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Only show assets assigned to this user's office
  const officeAssets = assets.filter(a => a.officeId === currentUser?.officeId);
  const selectedAsset = officeAssets.find(a => a.id === assetId);

  const formatAssetOption = (a: any) => {
    const brandModel = [a.brand, a.model].filter(Boolean).map((s: string) => s.trim()).filter(Boolean).join(' ');
    const cleanSerial = a.serialNumber ? a.serialNumber.replace(/^(sn\s*:?\s*)+/i, '').trim() : '';
    const idPart = a.propertyNumber || (cleanSerial ? `SN: ${cleanSerial}` : a.assetCode || '');
    const userPart = a.assignedTo && a.assignedTo !== 'N/A' && a.assignedTo.trim()
      ? `User: ${a.assignedTo.trim()}`
      : '';

    let label = a.equipmentType;
    if (brandModel) {
      label += ` — ${brandModel}`;
    }
    if (idPart) {
      label += ` (${idPart})`;
    }
    if (userPart) {
      label += ` — ${userPart}`;
    }
    return label;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (officeAssets.length > 0 && !assetId) {
      Toast.fire({
        icon: 'warning',
        title: 'Please select the affected asset'
      });
      return;
    }

    const result = await ConfirmModal.fire({
      text: 'Are you sure you want to submit this ticket?'
    });
    
    if (result.isConfirmed) {
      createNewTicket({
        requesterId: currentUser.id,
        officeId: currentUser.officeId,
        categoryId,
        priority: 'Medium', // Default priority, to be updated by admin later
        assetId: assetId || undefined,
        subject,
        description
      });
      
      Toast.fire({
        icon: 'success',
        title: 'Ticket submitted successfully'
      });
      
      onBack(); // Return to list after submit
    }
  };

  const inputClass = "w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm";

  return (
    <div className="max-w-[800px] mx-auto pb-16 space-y-8">
      <header className="space-y-6">
        <button onClick={onBack} className="flex items-center space-x-2 text-ink-muted hover:text-ink transition-colors text-[11px] font-bold uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets</span>
        </button>
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
            ICT Support Desk
          </p>
          <h1 className="text-[2.75rem] font-black text-ink leading-none tracking-tighter">
            Submit New Ticket
          </h1>
          <p className="text-sm font-medium text-ink-muted mt-2 max-w-2xl leading-relaxed">
            Please describe your technical issue in detail. Provide as much context as possible to help our ICT staff resolve your request quickly.
          </p>
        </div>
      </header>

      <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="px-8 py-5 border-b border-border bg-bg/50">
          <h2 className="text-[11px] font-bold text-ink uppercase tracking-widest">Issue Details</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                Category <span className="text-accent ml-1.5">*</span>
              </label>
              <select 
                required
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className={`${inputClass} appearance-none cursor-pointer`}
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              Affected Asset {officeAssets.length > 0 ? <span className="text-accent ml-1.5">*</span> : <span className="text-ink-muted font-normal lowercase">(optional)</span>}
            </label>
            <select 
              required={officeAssets.length > 0}
              value={assetId}
              onChange={e => setAssetId(e.target.value)}
              className={`${inputClass} appearance-none cursor-pointer`}
            >
              <option value="">-- Select an Asset {officeAssets.length > 0 ? '*' : ''} --</option>
              {officeAssets.map(a => (
                <option key={a.id} value={a.id}>
                  {formatAssetOption(a)}
                </option>
              ))}
            </select>
            {selectedAsset && (
              <div className="p-3.5 bg-bg/70 border border-border rounded-xl text-xs space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-ink">
                    {selectedAsset.equipmentType} {selectedAsset.brand ? `• ${selectedAsset.brand}` : ''} {selectedAsset.model || ''}
                  </span>
                  <span className="font-mono text-[10px] text-accent font-bold px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                    {selectedAsset.propertyNumber || (selectedAsset.serialNumber ? `SN: ${selectedAsset.serialNumber}` : selectedAsset.assetCode)}
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted flex flex-wrap gap-x-4 gap-y-1">
                  {selectedAsset.assignedTo && selectedAsset.assignedTo !== 'N/A' && (
                    <span>Assigned to: <strong className="text-ink">{selectedAsset.assignedTo}</strong></span>
                  )}
                  {selectedAsset.exactLocation && (
                    <span>Location: <strong className="text-ink">{selectedAsset.exactLocation}</strong></span>
                  )}
                  {selectedAsset.condition && (
                    <span>Condition: <strong className="text-ink">{selectedAsset.condition}</strong></span>
                  )}
                </div>
              </div>
            )}
            <p className="text-[11px] text-ink-muted mt-1.5 font-medium">
              Select the specific equipment that requires technical assistance or repair.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              Subject <span className="text-accent ml-1.5">*</span>
            </label>
            <input 
              required
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of the problem"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              Detailed Description <span className="text-accent ml-1.5">*</span>
            </label>
            <textarea 
              required
              rows={6}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Please provide as much detail as possible..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="pt-6 border-t border-border flex justify-end gap-3">
            <button 
              type="button"
              onClick={onBack}
              className="px-6 py-3 border border-border text-ink-muted bg-bg rounded-xl text-[11px] uppercase tracking-widest font-bold hover:text-ink transition-all shadow-sm"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-6 py-3 bg-accent text-white rounded-xl text-[11px] uppercase tracking-widest font-bold hover:opacity-90 transition-all shadow-md active:scale-95"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
