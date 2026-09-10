-- =======================================================
-- LGU ICT Help Desk - ICT Technical Service Report (TSR)
-- =======================================================

-- 1. Create table for Technical Service Reports
CREATE TABLE IF NOT EXISTS public.service_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT UNIQUE NOT NULL, -- e.g. TSR-2026-0001
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  report_date DATE DEFAULT CURRENT_DATE NOT NULL,
  diagnosis TEXT,
  technical_findings TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  final_status TEXT NOT NULL, -- Resolved, Repaired, For Monitoring, For Further Assessment, For Replacement, For Procurement, For Disposal, Referred to Service Provider
  recommendation TEXT NOT NULL,
  prepared_by_name TEXT NOT NULL,
  prepared_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ict_head_name TEXT DEFAULT 'Engr. Kenneth Jones D. Alforque' NOT NULL,
  office_head_name TEXT DEFAULT 'Head of Office / Authorized Representative',
  report_status TEXT DEFAULT 'Generated' NOT NULL, -- Draft, Generated, Reviewed, Signed, Released
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  printed_at TIMESTAMP WITH TIME ZONE
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_reports_ticket_id ON public.service_reports(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_reports_report_number ON public.service_reports(report_number);
CREATE INDEX IF NOT EXISTS idx_service_reports_created_at ON public.service_reports(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;

-- 4. Admin-Only RLS Policies
-- Only system_admin can view and manage service reports
DROP POLICY IF EXISTS "Admins can view service reports" ON public.service_reports;
CREATE POLICY "Admins can view service reports" ON public.service_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin')
  );

DROP POLICY IF EXISTS "Admins can insert service reports" ON public.service_reports;
CREATE POLICY "Admins can insert service reports" ON public.service_reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin')
  );

DROP POLICY IF EXISTS "Admins can update service reports" ON public.service_reports;
CREATE POLICY "Admins can update service reports" ON public.service_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin')
  );

DROP POLICY IF EXISTS "Admins can delete service reports" ON public.service_reports;
CREATE POLICY "Admins can delete service reports" ON public.service_reports
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin')
  );

-- 5. Realtime broadcasting for service_reports
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_reports;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
