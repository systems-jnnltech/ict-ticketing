-- =========================================================
-- Special-Case Office Email Authorization
-- Department: Mayor's Office - Sports and Youth Hall Section
-- Office ID:  a0000000-0000-0000-0000-000000000019
-- Authorized Email: lubatonaganmarygrace@gmail.com
--
-- Instructions: Run this script in Supabase Dashboard > SQL Editor
-- =========================================================

-- 1. Update the official email for Mayor's Office - Sports and Youth Hall Section
UPDATE public.departments
SET email = 'lubatonaganmarygrace@gmail.com'
WHERE id = 'a0000000-0000-0000-0000-000000000019'
   OR LOWER(TRIM(name)) = LOWER(TRIM('Mayor''s Office - Sports and Youth Hall Section'))
   OR acronym = 'MO-Sports';

-- 2. Ensure user_invitations table exists and pre-assign the employee role
CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role user_role DEFAULT 'Department User' NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pre-assign lubatonaganmarygrace@gmail.com to Sports and Youth Hall Section
INSERT INTO public.user_invitations (email, role, department_id)
VALUES (
    'lubatonaganmarygrace@gmail.com',
    'employee',
    'a0000000-0000-0000-0000-000000000019'
)
ON CONFLICT (email) DO UPDATE 
SET role = 'employee',
    department_id = 'a0000000-0000-0000-0000-000000000019';

-- 3. If a profile already exists for this email, ensure role and department are set properly
UPDATE public.profiles
SET role = 'employee',
    department_id = 'a0000000-0000-0000-0000-000000000019',
    status = 'active'
WHERE LOWER(email) = 'lubatonaganmarygrace@gmail.com';

-- 4. Verification Check
SELECT id, name, acronym, office_head, email 
FROM public.departments 
WHERE id = 'a0000000-0000-0000-0000-000000000019'
   OR LOWER(TRIM(name)) = LOWER(TRIM('Mayor''s Office - Sports and Youth Hall Section'));

SELECT * 
FROM public.user_invitations 
WHERE LOWER(email) = 'lubatonaganmarygrace@gmail.com';
