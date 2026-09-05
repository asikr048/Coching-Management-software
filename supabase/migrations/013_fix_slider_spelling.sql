-- Fix spelling of MedhaSiri / MedhaShiri to MedhaShiree in slider_images table
UPDATE slider_images 
SET 
  title = REGEXP_REPLACE(title, 'Medha\s*sh?ir[ei]+', 'MedhaShiree', 'gi'),
  subtitle = CASE 
    WHEN subtitle IS NOT NULL THEN REGEXP_REPLACE(subtitle, 'Medha\s*sh?ir[ei]+', 'MedhaShiree', 'gi')
    ELSE subtitle 
  END
WHERE 
  title ILIKE '%medhasiri%' 
  OR title ILIKE '%medhashiri%'
  OR subtitle ILIKE '%medhasiri%' 
  OR subtitle ILIKE '%medhashiri%';
