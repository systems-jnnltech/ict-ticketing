-- =========================================================
-- Batch Update: Populate office_head in public.departments
-- Run this in your Supabase Dashboard > SQL Editor
-- =========================================================

-- 1. Ensure office_head column exists
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS office_head TEXT;

COMMENT ON COLUMN public.departments.office_head IS 'Full name and title of the Office or Department Head';

-- 2. Update office_head for each department by matching name or acronym
UPDATE public.departments AS d
SET office_head = v.office_head
FROM (VALUES
  ('Balay Silangan Reformatory Center', 'Balay Silangan', 'Dollar Yen Son'),
  ('Comelec Malungon', 'Comelec', 'Jose Alvin Ruiz Quiñanola'),
  ('General Services Office', 'GSO', 'Maria Teresa Tapil'),
  ('LIGA ng mga Barangay', 'LIGA', 'Sweetly Mae G. Laguerder'),
  ('Local Youth Development Office', 'LYDO', 'Shiela Manocay'),
  ('MO-Business Permits and Licenses Section', 'MO-BPLS', 'Trinidad Quimado'),
  ('MO-Civil Security Unit', 'MO-CSU', 'Ervic Enojas'),
  ('Mayor''s Office - Civil Security Unit', 'MO-CSU', 'Ervic Enojas'),
  ('Mayor''s Office - Bids and Awards Committee', 'MO-BAC', 'Maria Teresa Tapil'),
  ('Mayor''s Office - Bureau of Internal Revenue', 'MO-BIR', 'Ebnil Sarail'),
  ('Mayor''s Office - Executive Section', 'MO-Exec', 'Cristina Constantino-La Paz'),
  ('Mayor''s Office - Motorpool', 'Motorpool', 'Hamilton Dewata'),
  ('Mayor''s Office - Nutrition Section', 'Nutrition', 'Roselyn D. Constantino'),
  ('Mayor''s Office - PESO', 'MO-PESO', 'Cristina Constantino-La Paz'),
  ('Mayor''s Office - Sports and Youth Hall Section', 'MO-Sports', 'Pronie Lukeña'),
  ('Mayor''s Office - Tourism Section', 'Tourism', 'Cristina Constantino-La Paz'),
  ('Mayors Office - Administrative Section', 'MO-Admin', 'Bienvenida Llego'),
  ('Mayors Office - Personnel Section', 'MO-Personnel', 'John Michael Fernandez'),
  ('Mayor’s Office – Economic Enterprise Management Section', 'MEEDO', 'Marife Cachuela'),
  ('Municipal Accounting Office', 'MACCO', 'Immanuel Figueroa'),
  ('Municipal Assessor''s Office', 'MASSO', 'Gladys Maybel D. Yap'),
  ('Municipal Budget Office', 'MBO', 'Beverly Pactes'),
  ('Municipal Civil Registrar', 'MCR', 'Arlyne G. Del Rosario'),
  ('Municipal Disaster Risk Reduction & Management Office', 'MDRRMO', 'Jessie Dela Cruz'),
  ('Municipal Engineering Office', 'MEO', 'Mark Anthony Zagales'),
  ('Municipal Environment and Natural Resources Office', 'MENRO', 'Perlyn Jean Mestiola'),
  ('Municipal Health Office', 'MHO', 'Rafaida G. Hernandez'),
  ('Municipal Information Office', 'MIO', 'Kenneth Jones Alforque'),
  ('Municipal Local Government Operations Office', 'MLGOO', 'Zorayda Labus'),
  ('Municipal Planning & Development Office', 'MPDO', 'Richard Saranillo'),
  ('Municipal Social Welfare & Development Office', 'MSWDO', 'Ruth Arangote'),
  ('Municipal Treasurer''s Office', 'MTO', 'Leo Operario'),
  ('Office of the Municipal Agriculturist', 'OMAG', 'King Lloyd Abelado'),
  ('People''s Law Enforcement Board', 'PLEB', 'Benjamin Santos'),
  ('Sangguniang Bayan', 'SB', 'Jonathan Alfaro'),
  ('Sangguniang Kabataan', 'SK', 'Jereco Tanduyan'),
  ('Vice Mayor''s Office', 'VM', 'Atty. Maria Theresa D. Constantino')
) AS v(name, acronym, office_head)
WHERE LOWER(TRIM(d.name)) = LOWER(TRIM(v.name))
   OR (d.acronym IS NOT NULL AND LOWER(TRIM(d.acronym)) = LOWER(TRIM(v.acronym)));

-- 3. Check and verify updated rows
SELECT id, name, acronym, office_head, email 
FROM public.departments 
ORDER BY name;
