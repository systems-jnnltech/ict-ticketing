-- =======================================================
-- LGU ICT Help Desk - Asset Service & Audit Timeline
-- =======================================================

-- 1. Create table for Asset History / Audit Logs
CREATE TABLE IF NOT EXISTS public.asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL, -- CREATED, UPDATED, AUDITED
  changes TEXT NOT NULL, -- JSON string or summary of modifications
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id ON public.asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_created_at ON public.asset_history(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow all authenticated / system users to read asset history
DROP POLICY IF EXISTS "Asset history viewable" ON public.asset_history;
CREATE POLICY "Asset history viewable" ON public.asset_history 
  FOR SELECT USING (true);

-- Allow authenticated / admin users to insert history logs
DROP POLICY IF EXISTS "Asset history insert" ON public.asset_history;
CREATE POLICY "Asset history insert" ON public.asset_history 
  FOR INSERT WITH CHECK (true);

-- 5. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_history;
