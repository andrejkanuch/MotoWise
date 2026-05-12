-- OEM model-specific maintenance schedules — all brands
-- Model strings match exactly what is stored in the motorcycles table (sourced from NHTSA vPIC).
-- NHTSA vPIC returns MakeName in ALL CAPS — we match that convention.
-- These are Level-1 rows (make + model NOT NULL).
-- They take precedence over brand-generic (Level-2) rows already seeded in 00022.
-- Existing brand-generic rows are UNTOUCHED — they remain as fallback for any model not listed here.
-- Intervals sourced from official owner's / service manuals.

-- ============================================================
-- FIX: Normalize 00022 brand-generic make names to match NHTSA ALL CAPS
-- The service now uses case-insensitive matching, but keep data consistent.
-- ============================================================
UPDATE public.oem_maintenance_schedules SET make = 'HONDA' WHERE make = 'Honda';
UPDATE public.oem_maintenance_schedules SET make = 'YAMAHA' WHERE make = 'Yamaha';
UPDATE public.oem_maintenance_schedules SET make = 'KAWASAKI' WHERE make = 'Kawasaki';
UPDATE public.oem_maintenance_schedules SET make = 'SUZUKI' WHERE make = 'Suzuki';
UPDATE public.oem_maintenance_schedules SET make = 'HARLEY-DAVIDSON' WHERE make = 'Harley-Davidson';
UPDATE public.oem_maintenance_schedules SET make = 'DUCATI' WHERE make = 'Ducati';
UPDATE public.oem_maintenance_schedules SET make = 'TRIUMPH' WHERE make = 'Triumph';
UPDATE public.oem_maintenance_schedules SET make = 'APRILIA' WHERE make = 'Aprilia';
UPDATE public.oem_maintenance_schedules SET make = 'INDIAN MOTORCYCLE' WHERE make = 'Indian';
UPDATE public.oem_maintenance_schedules SET make = 'MOTO GUZZI' WHERE make = 'Moto Guzzi';
UPDATE public.oem_maintenance_schedules SET make = 'ROYAL ENFIELD' WHERE make = 'Royal Enfield';
UPDATE public.oem_maintenance_schedules SET make = 'HUSQVARNA' WHERE make = 'Husqvarna';
UPDATE public.oem_maintenance_schedules SET make = 'MV AGUSTA' WHERE make = 'MV Agusta';
UPDATE public.oem_maintenance_schedules SET make = 'BENELLI' WHERE make = 'Benelli';
UPDATE public.oem_maintenance_schedules SET make = 'CFMOTO' WHERE make = 'CF Moto';
UPDATE public.oem_maintenance_schedules SET make = 'ZERO MOTORCYCLES' WHERE make = 'Zero';
UPDATE public.oem_maintenance_schedules SET make = 'CAN-AM' WHERE make = 'Can-Am';
UPDATE public.oem_maintenance_schedules SET make = 'PIAGGIO' WHERE make = 'Piaggio';

-- Also normalize the one 'Ducati' (mixed case) row in the motorcycles table
UPDATE public.motorcycles SET make = 'DUCATI' WHERE make = 'Ducati';

-- ============================================================
-- BMW
-- ============================================================

-- R 1250 GS (2019+) — Boxer twin, shaft drive, ShiftCam
-- Valve clearance every 10 000 km (tighter than brand-generic 20 000)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','R 1250 GS',2019,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',10000,365,'high','boxer-twin',1),
  ('BMW','R 1250 GS',2019,'Air Filter','Replace paper air filter element',20000,730,'medium','boxer-twin',2),
  ('BMW','R 1250 GS',2019,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','boxer-twin',3),
  ('BMW','R 1250 GS',2019,'Brake Fluid','Replace DOT 4 brake fluid (front, rear, clutch)',20000,730,'high','boxer-twin',4),
  ('BMW','R 1250 GS',2019,'Coolant','Replace engine coolant',40000,1460,'medium','boxer-twin',5),
  ('BMW','R 1250 GS',2019,'Final Drive Oil','Replace rear shaft drive oil',20000,730,'medium','boxer-twin',6),
  ('BMW','R 1250 GS',2019,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','boxer-twin',7),
  ('BMW','R 1250 GS',2019,'Valve Clearance','Check and adjust boxer head valve clearance',10000,NULL,'high','boxer-twin',8),
  ('BMW','R 1250 GS',2019,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','boxer-twin',9),
  ('BMW','R 1250 GS',2019,'Brake Pads Inspection','Inspect front (4-piston radial) and rear brake pads',10000,365,'high','boxer-twin',10);

-- R 1200 GS (2004–2018) — Boxer twin 1170cc, shaft drive (pre-ShiftCam)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','R 1200 GS',2004,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',10000,365,'high','boxer-twin',1),
  ('BMW','R 1200 GS',2004,'Air Filter','Replace paper air filter element',20000,730,'medium','boxer-twin',2),
  ('BMW','R 1200 GS',2004,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','boxer-twin',3),
  ('BMW','R 1200 GS',2004,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','boxer-twin',4),
  ('BMW','R 1200 GS',2004,'Coolant','Replace engine coolant',40000,1460,'medium','boxer-twin',5),
  ('BMW','R 1200 GS',2004,'Final Drive Oil','Replace rear shaft drive oil',20000,730,'medium','boxer-twin',6),
  ('BMW','R 1200 GS',2004,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','boxer-twin',7),
  ('BMW','R 1200 GS',2004,'Valve Clearance','Check and adjust boxer head valve clearance',10000,NULL,'high','boxer-twin',8),
  ('BMW','R 1200 GS',2004,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','boxer-twin',9),
  ('BMW','R 1200 GS',2004,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','boxer-twin',10);

-- R nineT (2014+) — Boxer twin 1170cc, shaft drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','R nineT',2014,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',10000,365,'high','boxer-twin',1),
  ('BMW','R nineT',2014,'Air Filter','Replace paper air filter element',20000,730,'medium','boxer-twin',2),
  ('BMW','R nineT',2014,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','boxer-twin',3),
  ('BMW','R nineT',2014,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','boxer-twin',4),
  ('BMW','R nineT',2014,'Coolant','Replace engine coolant',40000,1460,'medium','boxer-twin',5),
  ('BMW','R nineT',2014,'Final Drive Oil','Replace rear shaft drive oil',20000,730,'medium','boxer-twin',6),
  ('BMW','R nineT',2014,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','boxer-twin',7),
  ('BMW','R nineT',2014,'Valve Clearance','Check and adjust boxer head valve clearance',10000,NULL,'high','boxer-twin',8),
  ('BMW','R nineT',2014,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','boxer-twin',9),
  ('BMW','R nineT',2014,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','boxer-twin',10);

-- F 900 XR (2020+) — Parallel twin, chain drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','F 900 XR',2020,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',10000,365,'high','parallel-twin',1),
  ('BMW','F 900 XR',2020,'Air Filter','Replace paper air filter element',20000,730,'medium','parallel-twin',2),
  ('BMW','F 900 XR',2020,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','parallel-twin',3),
  ('BMW','F 900 XR',2020,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','parallel-twin',4),
  ('BMW','F 900 XR',2020,'Coolant','Replace engine coolant',40000,1460,'medium','parallel-twin',5),
  ('BMW','F 900 XR',2020,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('BMW','F 900 XR',2020,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('BMW','F 900 XR',2020,'Valve Clearance','Check and adjust valve clearance',20000,NULL,'high','parallel-twin',8),
  ('BMW','F 900 XR',2020,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','parallel-twin',9),
  ('BMW','F 900 XR',2020,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- F 800 GS (2008–2018) — Parallel twin 798cc, chain drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','F 800 GS',2008,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',10000,365,'high','parallel-twin',1),
  ('BMW','F 800 GS',2008,'Air Filter','Replace paper air filter element',20000,730,'medium','parallel-twin',2),
  ('BMW','F 800 GS',2008,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','parallel-twin',3),
  ('BMW','F 800 GS',2008,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','parallel-twin',4),
  ('BMW','F 800 GS',2008,'Coolant','Replace engine coolant',40000,1460,'medium','parallel-twin',5),
  ('BMW','F 800 GS',2008,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('BMW','F 800 GS',2008,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('BMW','F 800 GS',2008,'Valve Clearance','Check and adjust valve clearance',20000,NULL,'high','parallel-twin',8),
  ('BMW','F 800 GS',2008,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','parallel-twin',9),
  ('BMW','F 800 GS',2008,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- F 800 R (2009–2019) — Parallel twin 798cc, chain drive (same engine as F 800 GS)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','F 800 R',2009,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',10000,365,'high','parallel-twin',1),
  ('BMW','F 800 R',2009,'Air Filter','Replace paper air filter element',20000,730,'medium','parallel-twin',2),
  ('BMW','F 800 R',2009,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','parallel-twin',3),
  ('BMW','F 800 R',2009,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','parallel-twin',4),
  ('BMW','F 800 R',2009,'Coolant','Replace engine coolant',40000,1460,'medium','parallel-twin',5),
  ('BMW','F 800 R',2009,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('BMW','F 800 R',2009,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('BMW','F 800 R',2009,'Valve Clearance','Check and adjust valve clearance',20000,NULL,'high','parallel-twin',8),
  ('BMW','F 800 R',2009,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','parallel-twin',9),
  ('BMW','F 800 R',2009,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- S 1000 R (2014+) — Inline-4, chain drive
-- Valve clearance every 10 000 km (high-revving inline-4)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','S 1000 R',2014,'Oil & Filter Change','Replace engine oil (10W-60 full synthetic) and oil filter',10000,365,'high','inline-4',1),
  ('BMW','S 1000 R',2014,'Air Filter','Replace paper air filter element',20000,730,'medium','inline-4',2),
  ('BMW','S 1000 R',2014,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','inline-4',3),
  ('BMW','S 1000 R',2014,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','inline-4',4),
  ('BMW','S 1000 R',2014,'Coolant','Replace engine coolant',40000,1460,'medium','inline-4',5),
  ('BMW','S 1000 R',2014,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','inline-4',6),
  ('BMW','S 1000 R',2014,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('BMW','S 1000 R',2014,'Valve Clearance','Check and adjust valve clearance',10000,NULL,'high','inline-4',8),
  ('BMW','S 1000 R',2014,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','inline-4',9),
  ('BMW','S 1000 R',2014,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','inline-4',10);

-- M 1000 RR (2021+) — Inline-4, chain drive (track-focused, annual brake fluid)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','M 1000 RR',2021,'Oil & Filter Change','Replace engine oil (10W-60 full synthetic) and oil filter',10000,365,'high','inline-4',1),
  ('BMW','M 1000 RR',2021,'Air Filter','Replace high-flow air filter element',20000,730,'medium','inline-4',2),
  ('BMW','M 1000 RR',2021,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','inline-4',3),
  ('BMW','M 1000 RR',2021,'Brake Fluid','Replace DOT 4 brake fluid (annual recommended for track)',20000,365,'high','inline-4',4),
  ('BMW','M 1000 RR',2021,'Coolant','Replace engine coolant',40000,1460,'medium','inline-4',5),
  ('BMW','M 1000 RR',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','inline-4',6),
  ('BMW','M 1000 RR',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('BMW','M 1000 RR',2021,'Valve Clearance','Check and adjust valve clearance',10000,NULL,'high','inline-4',8),
  ('BMW','M 1000 RR',2021,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','inline-4',9),
  ('BMW','M 1000 RR',2021,'Brake Pads Inspection','Inspect front M compound and rear brake pads',10000,365,'high','inline-4',10);

-- C 400 GT (2019+) — Maxi-scooter, single 350cc, CVT belt
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','C 400 GT',2019,'Oil & Filter Change','Replace engine oil (5W-40 full synthetic) and oil filter',6000,365,'high','single',1),
  ('BMW','C 400 GT',2019,'Air Filter','Replace paper air filter element',12000,730,'medium','single',2),
  ('BMW','C 400 GT',2019,'Spark Plug','Replace iridium spark plug',12000,730,'medium','single',3),
  ('BMW','C 400 GT',2019,'Brake Fluid','Replace DOT 4 brake fluid',12000,730,'high','single',4),
  ('BMW','C 400 GT',2019,'Coolant','Replace engine coolant',24000,730,'medium','single',5),
  ('BMW','C 400 GT',2019,'CVT Belt Inspection','Inspect CVT drive belt condition and tension',6000,365,'high','single',6),
  ('BMW','C 400 GT',2019,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('BMW','C 400 GT',2019,'Valve Clearance','Check and adjust valve clearance',12000,NULL,'high','single',8),
  ('BMW','C 400 GT',2019,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','single',9),
  ('BMW','C 400 GT',2019,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','single',10);

-- C 400 X (2019+) — Maxi-scooter, same drivetrain as C 400 GT
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','C 400 X',2019,'Oil & Filter Change','Replace engine oil (5W-40 full synthetic) and oil filter',6000,365,'high','single',1),
  ('BMW','C 400 X',2019,'Air Filter','Replace paper air filter element',12000,730,'medium','single',2),
  ('BMW','C 400 X',2019,'Spark Plug','Replace iridium spark plug',12000,730,'medium','single',3),
  ('BMW','C 400 X',2019,'Brake Fluid','Replace DOT 4 brake fluid',12000,730,'high','single',4),
  ('BMW','C 400 X',2019,'Coolant','Replace engine coolant',24000,730,'medium','single',5),
  ('BMW','C 400 X',2019,'CVT Belt Inspection','Inspect CVT drive belt condition and tension',6000,365,'high','single',6),
  ('BMW','C 400 X',2019,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('BMW','C 400 X',2019,'Valve Clearance','Check and adjust valve clearance',12000,NULL,'high','single',8),
  ('BMW','C 400 X',2019,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','single',9),
  ('BMW','C 400 X',2019,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','single',10);

-- C 600 Sport (2012–2015) — Maxi-scooter, parallel twin 647cc, CVT belt
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BMW','C 600',2012,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',10000,365,'high','parallel-twin',1),
  ('BMW','C 600',2012,'Air Filter','Replace paper air filter element',20000,730,'medium','parallel-twin',2),
  ('BMW','C 600',2012,'Spark Plugs','Replace iridium spark plugs',20000,730,'medium','parallel-twin',3),
  ('BMW','C 600',2012,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','parallel-twin',4),
  ('BMW','C 600',2012,'Coolant','Replace engine coolant',40000,1460,'medium','parallel-twin',5),
  ('BMW','C 600',2012,'CVT Belt Inspection','Inspect CVT drive belt condition and tension',10000,365,'high','parallel-twin',6),
  ('BMW','C 600',2012,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('BMW','C 600',2012,'Valve Clearance','Check and adjust valve clearance',20000,NULL,'high','parallel-twin',8),
  ('BMW','C 600',2012,'Fork Oil','Replace fork oil and inspect seals',40000,730,'medium','parallel-twin',9),
  ('BMW','C 600',2012,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- ============================================================
-- HONDA
-- ============================================================

-- NC750X (2014+) — Parallel twin 745cc, chain/DCT, liquid-cooled
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','NC750X',2014,'Oil & Filter Change','Replace engine oil (0W-30 or 10W-30) and oil filter',12000,365,'high','parallel-twin',1),
  ('HONDA','NC750X',2014,'Air Filter','Replace paper air filter element',24000,730,'medium','parallel-twin',2),
  ('HONDA','NC750X',2014,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','parallel-twin',3),
  ('HONDA','NC750X',2014,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','parallel-twin',4),
  ('HONDA','NC750X',2014,'Coolant','Replace Pro Honda HP Coolant',36000,730,'medium','parallel-twin',5),
  ('HONDA','NC750X',2014,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('HONDA','NC750X',2014,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('HONDA','NC750X',2014,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','parallel-twin',8),
  ('HONDA','NC750X',2014,'Fork Oil','Replace fork oil and inspect seals',36000,730,'medium','parallel-twin',9),
  ('HONDA','NC750X',2014,'Brake Pads Inspection','Inspect front and rear brake pads',12000,365,'high','parallel-twin',10);

-- Rebel 1100 (CMX1100, 2021+) — Parallel twin 1084cc, chain/DCT
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','Rebel 1100',2021,'Oil & Filter Change','Replace engine oil (10W-30 full synthetic) and oil filter',12000,365,'high','parallel-twin',1),
  ('HONDA','Rebel 1100',2021,'Air Filter','Replace paper air filter element',24000,730,'medium','parallel-twin',2),
  ('HONDA','Rebel 1100',2021,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','parallel-twin',3),
  ('HONDA','Rebel 1100',2021,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','parallel-twin',4),
  ('HONDA','Rebel 1100',2021,'Coolant','Replace Pro Honda HP Coolant',36000,730,'medium','parallel-twin',5),
  ('HONDA','Rebel 1100',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('HONDA','Rebel 1100',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('HONDA','Rebel 1100',2021,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','parallel-twin',8),
  ('HONDA','Rebel 1100',2021,'Fork Oil','Replace fork oil and inspect seals',36000,730,'medium','parallel-twin',9),
  ('HONDA','Rebel 1100',2021,'Brake Pads Inspection','Inspect front and rear brake pads',12000,365,'high','parallel-twin',10);

-- NX500 (2024+) — Parallel twin 471cc (CB500 engine), chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','NX500',2024,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',8000,365,'high','parallel-twin',1),
  ('HONDA','NX500',2024,'Air Filter','Replace paper air filter element',16000,730,'medium','parallel-twin',2),
  ('HONDA','NX500',2024,'Spark Plugs','Replace iridium spark plugs',16000,730,'medium','parallel-twin',3),
  ('HONDA','NX500',2024,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','parallel-twin',4),
  ('HONDA','NX500',2024,'Coolant','Replace engine coolant',32000,1095,'medium','parallel-twin',5),
  ('HONDA','NX500',2024,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('HONDA','NX500',2024,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('HONDA','NX500',2024,'Valve Clearance','Check and adjust valve clearance',16000,NULL,'high','parallel-twin',8),
  ('HONDA','NX500',2024,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','parallel-twin',9),
  ('HONDA','NX500',2024,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','parallel-twin',10);

-- CBR650F (2014–2018) — Inline-4 649cc, chain
-- Note: CBR650F (pre-2019) vs CBR650R (2019+) are different engines
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','CBR650F',2014,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',8000,365,'high','inline-4',1),
  ('HONDA','CBR650F',2014,'Air Filter','Replace paper air filter element',12000,730,'medium','inline-4',2),
  ('HONDA','CBR650F',2014,'Spark Plugs','Replace spark plugs',16000,730,'medium','inline-4',3),
  ('HONDA','CBR650F',2014,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','inline-4',4),
  ('HONDA','CBR650F',2014,'Coolant','Replace engine coolant',24000,730,'medium','inline-4',5),
  ('HONDA','CBR650F',2014,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','inline-4',6),
  ('HONDA','CBR650F',2014,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('HONDA','CBR650F',2014,'Valve Clearance','Check and adjust valve clearance',16000,NULL,'high','inline-4',8),
  ('HONDA','CBR650F',2014,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','inline-4',9),
  ('HONDA','CBR650F',2014,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','inline-4',10);

-- CBR600F (1987–2013) — Inline-4 599cc, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','CBR600F',1987,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',6000,365,'high','inline-4',1),
  ('HONDA','CBR600F',1987,'Air Filter','Replace paper air filter element',12000,730,'medium','inline-4',2),
  ('HONDA','CBR600F',1987,'Spark Plugs','Replace spark plugs',12000,730,'medium','inline-4',3),
  ('HONDA','CBR600F',1987,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','inline-4',4),
  ('HONDA','CBR600F',1987,'Coolant','Replace engine coolant',24000,730,'medium','inline-4',5),
  ('HONDA','CBR600F',1987,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','inline-4',6),
  ('HONDA','CBR600F',1987,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('HONDA','CBR600F',1987,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','inline-4',8),
  ('HONDA','CBR600F',1987,'Fork Oil','Replace fork oil and inspect seals',24000,730,'medium','inline-4',9),
  ('HONDA','CBR600F',1987,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','inline-4',10);

-- CBR250R (2011–2014) — Single 249cc, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','CBR250R',2011,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',6000,365,'high','single',1),
  ('HONDA','CBR250R',2011,'Air Filter','Replace paper air filter element',12000,730,'medium','single',2),
  ('HONDA','CBR250R',2011,'Spark Plug','Replace spark plug',12000,730,'medium','single',3),
  ('HONDA','CBR250R',2011,'Brake Fluid','Replace DOT 4 brake fluid',12000,730,'high','single',4),
  ('HONDA','CBR250R',2011,'Coolant','Replace engine coolant',24000,730,'medium','single',5),
  ('HONDA','CBR250R',2011,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','single',6),
  ('HONDA','CBR250R',2011,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('HONDA','CBR250R',2011,'Valve Clearance','Check and adjust valve clearance',12000,NULL,'high','single',8),
  ('HONDA','CBR250R',2011,'Fork Oil','Replace fork oil and inspect seals',24000,730,'medium','single',9),
  ('HONDA','CBR250R',2011,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','single',10);

-- GB350 (2021+) — Single 348cc, air-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','GB350',2021,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',6000,365,'high','single',1),
  ('HONDA','GB350',2021,'Air Filter','Replace paper air filter element',12000,730,'medium','single',2),
  ('HONDA','GB350',2021,'Spark Plug','Replace spark plug',12000,730,'medium','single',3),
  ('HONDA','GB350',2021,'Brake Fluid','Replace DOT 4 brake fluid',12000,730,'high','single',4),
  ('HONDA','GB350',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','single',6),
  ('HONDA','GB350',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('HONDA','GB350',2021,'Valve Clearance','Check and adjust valve clearance',12000,NULL,'high','single',8),
  ('HONDA','GB350',2021,'Fork Oil','Replace fork oil and inspect seals',24000,730,'medium','single',9),
  ('HONDA','GB350',2021,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','single',10);

-- ADV150 (2020+) — Scooter, single 149cc, CVT
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','ADV150',2020,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',4000,365,'high','single',1),
  ('HONDA','ADV150',2020,'Air Filter','Replace air filter element',8000,730,'medium','single',2),
  ('HONDA','ADV150',2020,'Spark Plug','Replace spark plug',8000,730,'medium','single',3),
  ('HONDA','ADV150',2020,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','single',4),
  ('HONDA','ADV150',2020,'CVT Belt Inspection','Inspect CVT drive belt wear and condition',8000,365,'high','single',5),
  ('HONDA','ADV150',2020,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',6),
  ('HONDA','ADV150',2020,'Valve Clearance','Check and adjust valve clearance',8000,NULL,'high','single',7),
  ('HONDA','ADV150',2020,'Fork Oil','Replace front fork oil and inspect seals',20000,730,'medium','single',8),
  ('HONDA','ADV150',2020,'Brake Pads Inspection','Inspect front and rear brake pads',4000,365,'high','single',9);

-- ADV160 (2022+) — Scooter, single 157cc, CVT (successor to ADV150)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','ADV160',2022,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',4000,365,'high','single',1),
  ('HONDA','ADV160',2022,'Air Filter','Replace air filter element',8000,730,'medium','single',2),
  ('HONDA','ADV160',2022,'Spark Plug','Replace iridium spark plug',16000,730,'medium','single',3),
  ('HONDA','ADV160',2022,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','single',4),
  ('HONDA','ADV160',2022,'CVT Belt Inspection','Inspect CVT drive belt wear and condition',8000,365,'high','single',5),
  ('HONDA','ADV160',2022,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',6),
  ('HONDA','ADV160',2022,'Valve Clearance','Check and adjust valve clearance',8000,NULL,'high','single',7),
  ('HONDA','ADV160',2022,'Fork Oil','Replace front fork oil and inspect seals',20000,730,'medium','single',8),
  ('HONDA','ADV160',2022,'Brake Pads Inspection','Inspect front and rear brake pads',4000,365,'high','single',9);

-- VFR800 Interceptor (2002–2013) — V4 782cc, shaft drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','VFR800 (Interceptor 800)',2002,'Oil & Filter Change','Replace engine oil (10W-30 full synthetic) and oil filter',8000,365,'high','v4',1),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Air Filter','Replace paper air filter element',24000,730,'medium','v4',2),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','v4',3),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','v4',4),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Coolant','Replace engine coolant',32000,730,'medium','v4',5),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Final Drive Oil','Replace shaft drive oil',16000,730,'medium','v4',6),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v4',7),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Valve Clearance','Check and adjust V4 valve clearance',24000,NULL,'high','v4',8),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Fork Oil','Replace fork oil and inspect seals',32000,730,'medium','v4',9),
  ('HONDA','VFR800 (Interceptor 800)',2002,'Brake Pads Inspection','Inspect front (dual) and rear brake pads',8000,365,'high','v4',10);

-- VT750 Shadow Aero (2004+) — V-twin 745cc, air-cooled, shaft drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Oil & Filter Change','Replace engine oil (10W-30) and oil filter',8000,365,'high','v-twin',1),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Air Filter','Replace paper air filter element',16000,730,'medium','v-twin',2),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Spark Plugs','Replace spark plugs',16000,730,'medium','v-twin',3),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','v-twin',4),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Final Drive Oil','Replace shaft drive oil',16000,730,'medium','v-twin',5),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',6),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Valve Clearance','Check and adjust valve clearance',16000,NULL,'high','v-twin',7),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Fork Oil','Replace fork oil and inspect seals',32000,730,'medium','v-twin',8),
  ('HONDA','VT750 (Shadow Aero 750)',2004,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','v-twin',9);

-- ============================================================
-- KAWASAKI
-- ============================================================

-- Z900 (2017+) — Inline-4 948cc, chain drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','Z900',2017,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',6000,365,'high','inline-4',1),
  ('KAWASAKI','Z900',2017,'Air Filter','Replace paper air filter element',12000,730,'medium','inline-4',2),
  ('KAWASAKI','Z900',2017,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','inline-4',3),
  ('KAWASAKI','Z900',2017,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','inline-4',4),
  ('KAWASAKI','Z900',2017,'Coolant','Replace engine coolant',36000,1095,'medium','inline-4',5),
  ('KAWASAKI','Z900',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','inline-4',6),
  ('KAWASAKI','Z900',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('KAWASAKI','Z900',2017,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','inline-4',8),
  ('KAWASAKI','Z900',2017,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','inline-4',9),
  ('KAWASAKI','Z900',2017,'Brake Pads Inspection','Inspect front (4-piston) and rear brake pads',6000,365,'high','inline-4',10);

-- Ninja 650 / Z650 (2017+) — Parallel twin 649cc, chain drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','Ninja 650',2017,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,365,'high','parallel-twin',1),
  ('KAWASAKI','Ninja 650',2017,'Air Filter','Replace paper air filter element',12000,730,'medium','parallel-twin',2),
  ('KAWASAKI','Ninja 650',2017,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','parallel-twin',3),
  ('KAWASAKI','Ninja 650',2017,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','parallel-twin',4),
  ('KAWASAKI','Ninja 650',2017,'Coolant','Replace engine coolant',36000,1095,'medium','parallel-twin',5),
  ('KAWASAKI','Ninja 650',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('KAWASAKI','Ninja 650',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('KAWASAKI','Ninja 650',2017,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','parallel-twin',8),
  ('KAWASAKI','Ninja 650',2017,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','parallel-twin',9),
  ('KAWASAKI','Ninja 650',2017,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','parallel-twin',10);

-- Ninja 500 (2024+) — Parallel twin 451cc, chain drive (new generation)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','Ninja 500',2024,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,365,'high','parallel-twin',1),
  ('KAWASAKI','Ninja 500',2024,'Air Filter','Replace paper air filter element',12000,730,'medium','parallel-twin',2),
  ('KAWASAKI','Ninja 500',2024,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','parallel-twin',3),
  ('KAWASAKI','Ninja 500',2024,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','parallel-twin',4),
  ('KAWASAKI','Ninja 500',2024,'Coolant','Replace engine coolant',36000,1095,'medium','parallel-twin',5),
  ('KAWASAKI','Ninja 500',2024,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('KAWASAKI','Ninja 500',2024,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('KAWASAKI','Ninja 500',2024,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','parallel-twin',8),
  ('KAWASAKI','Ninja 500',2024,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','parallel-twin',9),
  ('KAWASAKI','Ninja 500',2024,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','parallel-twin',10);

-- Versys 650 (2015+) — Parallel twin 649cc, chain drive (same engine as Ninja 650)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','Versys 650',2015,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,365,'high','parallel-twin',1),
  ('KAWASAKI','Versys 650',2015,'Air Filter','Replace paper air filter element',12000,730,'medium','parallel-twin',2),
  ('KAWASAKI','Versys 650',2015,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','parallel-twin',3),
  ('KAWASAKI','Versys 650',2015,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','parallel-twin',4),
  ('KAWASAKI','Versys 650',2015,'Coolant','Replace engine coolant',36000,1095,'medium','parallel-twin',5),
  ('KAWASAKI','Versys 650',2015,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('KAWASAKI','Versys 650',2015,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('KAWASAKI','Versys 650',2015,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','parallel-twin',8),
  ('KAWASAKI','Versys 650',2015,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','parallel-twin',9),
  ('KAWASAKI','Versys 650',2015,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','parallel-twin',10);

-- Z400 (2019+) — Parallel twin 399cc, chain drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','Z400',2019,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,365,'high','parallel-twin',1),
  ('KAWASAKI','Z400',2019,'Air Filter','Replace paper air filter element',12000,730,'medium','parallel-twin',2),
  ('KAWASAKI','Z400',2019,'Spark Plugs','Replace iridium spark plugs',24000,730,'medium','parallel-twin',3),
  ('KAWASAKI','Z400',2019,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','parallel-twin',4),
  ('KAWASAKI','Z400',2019,'Coolant','Replace engine coolant',36000,1095,'medium','parallel-twin',5),
  ('KAWASAKI','Z400',2019,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','parallel-twin',6),
  ('KAWASAKI','Z400',2019,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('KAWASAKI','Z400',2019,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','parallel-twin',8),
  ('KAWASAKI','Z400',2019,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','parallel-twin',9),
  ('KAWASAKI','Z400',2019,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','parallel-twin',10);

-- W800 (2011+) — Parallel twin 773cc, air-cooled, belt drive
-- No coolant (air-cooled). Belt drive instead of chain.
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','W800',2011,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,365,'high','parallel-twin',1),
  ('KAWASAKI','W800',2011,'Air Filter','Replace paper air filter element',12000,730,'medium','parallel-twin',2),
  ('KAWASAKI','W800',2011,'Spark Plugs','Replace spark plugs',12000,730,'medium','parallel-twin',3),
  ('KAWASAKI','W800',2011,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','parallel-twin',4),
  ('KAWASAKI','W800',2011,'Belt Inspection','Inspect drive belt tension and condition',6000,365,'medium','parallel-twin',5),
  ('KAWASAKI','W800',2011,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',6),
  ('KAWASAKI','W800',2011,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','parallel-twin',7),
  ('KAWASAKI','W800',2011,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','parallel-twin',8),
  ('KAWASAKI','W800',2011,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','parallel-twin',9);

-- KLR650 (1987+) — Single 651cc, liquid-cooled, chain drive (classic dual-sport)
-- Shorter intervals appropriate for older engine design
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','KLR650',1987,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',4000,365,'high','single',1),
  ('KAWASAKI','KLR650',1987,'Air Filter','Inspect and replace air filter (more frequent off-road)',8000,365,'medium','single',2),
  ('KAWASAKI','KLR650',1987,'Spark Plug','Replace spark plug',8000,730,'medium','single',3),
  ('KAWASAKI','KLR650',1987,'Brake Fluid','Replace DOT 4 brake fluid',16000,730,'high','single',4),
  ('KAWASAKI','KLR650',1987,'Coolant','Replace engine coolant',24000,730,'medium','single',5),
  ('KAWASAKI','KLR650',1987,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,14,'medium','single',6),
  ('KAWASAKI','KLR650',1987,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('KAWASAKI','KLR650',1987,'Valve Clearance','Check and adjust valve clearance',8000,NULL,'high','single',8),
  ('KAWASAKI','KLR650',1987,'Fork Oil','Replace fork oil and inspect seals',24000,730,'medium','single',9),
  ('KAWASAKI','KLR650',1987,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','single',10);

-- KLX140R (2021+) — Off-road single 144cc
-- Short intervals; off-road use means air filter and chain need more attention
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KAWASAKI','KLX140/KLX140R',2021,'Oil Change','Replace engine oil (10W-40)',3000,180,'high','single',1),
  ('KAWASAKI','KLX140/KLX140R',2021,'Air Filter','Clean or replace air filter element (after every muddy ride)',3000,90,'high','single',2),
  ('KAWASAKI','KLX140/KLX140R',2021,'Spark Plug','Replace spark plug',6000,365,'medium','single',3),
  ('KAWASAKI','KLX140/KLX140R',2021,'Brake Fluid','Replace DOT 4 brake fluid',12000,730,'high','single',4),
  ('KAWASAKI','KLX140/KLX140R',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,14,'medium','single',5),
  ('KAWASAKI','KLX140/KLX140R',2021,'Tire Pressure Check','Check and adjust tire pressure',NULL,14,'low','single',6),
  ('KAWASAKI','KLX140/KLX140R',2021,'Valve Clearance','Check and adjust valve clearance',6000,NULL,'high','single',7),
  ('KAWASAKI','KLX140/KLX140R',2021,'Fork Oil','Replace fork oil and inspect seals',NULL,365,'medium','single',8),
  ('KAWASAKI','KLX140/KLX140R',2021,'Brake Pads Inspection','Inspect front and rear brake pads',3000,180,'high','single',9);


-- ============================================================
-- YAMAHA
-- ============================================================

-- MTN690 (MT-07) (2018+) — Parallel twin 689cc (CP2), liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('YAMAHA','MTN690 (MT-07)',2018,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',10000,365,'high','parallel-twin',1),
  ('YAMAHA','MTN690 (MT-07)',2018,'Air Filter','Replace paper air filter element',40000,NULL,'medium','parallel-twin',2),
  ('YAMAHA','MTN690 (MT-07)',2018,'Spark Plugs','Replace NGK LMAR9E-J spark plugs',40000,NULL,'medium','parallel-twin',3),
  ('YAMAHA','MTN690 (MT-07)',2018,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('YAMAHA','MTN690 (MT-07)',2018,'Coolant','Replace engine coolant',NULL,1095,'medium','parallel-twin',5),
  ('YAMAHA','MTN690 (MT-07)',2018,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','parallel-twin',6),
  ('YAMAHA','MTN690 (MT-07)',2018,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('YAMAHA','MTN690 (MT-07)',2018,'Valve Clearance','Check and adjust valve clearance',40000,NULL,'high','parallel-twin',8),
  ('YAMAHA','MTN690 (MT-07)',2018,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','parallel-twin',9),
  ('YAMAHA','MTN690 (MT-07)',2018,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- MTN890 (MT-09) (2021+) — Inline-3 890cc (CP3), liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('YAMAHA','MTN890 (MT-09)',2021,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',10000,365,'high','inline-3',1),
  ('YAMAHA','MTN890 (MT-09)',2021,'Air Filter','Replace paper air filter element',40000,NULL,'medium','inline-3',2),
  ('YAMAHA','MTN890 (MT-09)',2021,'Spark Plugs','Replace spark plugs',20000,NULL,'medium','inline-3',3),
  ('YAMAHA','MTN890 (MT-09)',2021,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','inline-3',4),
  ('YAMAHA','MTN890 (MT-09)',2021,'Coolant','Replace engine coolant',NULL,1095,'medium','inline-3',5),
  ('YAMAHA','MTN890 (MT-09)',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','inline-3',6),
  ('YAMAHA','MTN890 (MT-09)',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-3',7),
  ('YAMAHA','MTN890 (MT-09)',2021,'Valve Clearance','Check and adjust valve clearance',40000,NULL,'high','inline-3',8),
  ('YAMAHA','MTN890 (MT-09)',2021,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','inline-3',9),
  ('YAMAHA','MTN890 (MT-09)',2021,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','inline-3',10);

-- MTM890 (XSR900) (2022+) — Inline-3 890cc (CP3), liquid-cooled, chain (same as MT-09)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('YAMAHA','MTM890 (XSR900)',2022,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',10000,365,'high','inline-3',1),
  ('YAMAHA','MTM890 (XSR900)',2022,'Air Filter','Replace paper air filter element',40000,NULL,'medium','inline-3',2),
  ('YAMAHA','MTM890 (XSR900)',2022,'Spark Plugs','Replace spark plugs',20000,NULL,'medium','inline-3',3),
  ('YAMAHA','MTM890 (XSR900)',2022,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','inline-3',4),
  ('YAMAHA','MTM890 (XSR900)',2022,'Coolant','Replace engine coolant',NULL,1095,'medium','inline-3',5),
  ('YAMAHA','MTM890 (XSR900)',2022,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','inline-3',6),
  ('YAMAHA','MTM890 (XSR900)',2022,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-3',7),
  ('YAMAHA','MTM890 (XSR900)',2022,'Valve Clearance','Check and adjust valve clearance',40000,NULL,'high','inline-3',8),
  ('YAMAHA','MTM890 (XSR900)',2022,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','inline-3',9),
  ('YAMAHA','MTM890 (XSR900)',2022,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','inline-3',10);

-- XTZ690 (Tenere 700) (2019+) — Parallel twin 689cc (CP2), liquid-cooled, chain
-- Shorter air filter interval than MT-07 due to adventure/off-road use
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',10000,365,'high','parallel-twin',1),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Air Filter','Replace paper air filter element (more often off-road)',20000,NULL,'medium','parallel-twin',2),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Spark Plugs','Replace NGK LMAR8A-9 spark plugs',40000,NULL,'medium','parallel-twin',3),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Coolant','Replace engine coolant',NULL,1095,'medium','parallel-twin',5),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Chain Clean & Lube','Clean, lubricate and adjust drive chain (slack 43-48 mm)',1000,NULL,'medium','parallel-twin',6),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Valve Clearance','Check and adjust valve clearance',40000,NULL,'high','parallel-twin',8),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','parallel-twin',9),
  ('YAMAHA','XTZ690 (Tenere 700)',2019,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- XV535 (Virago 535) (1981–2003) — V-twin 535cc, air-cooled, shaft drive
-- No coolant (air-cooled). Shaft drive instead of chain. Shorter intervals for older engine.
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('YAMAHA','XV535 (Virago 535)',1981,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6400,180,'high','v-twin',1),
  ('YAMAHA','XV535 (Virago 535)',1981,'Air Filter','Replace paper air filter element',12800,365,'medium','v-twin',2),
  ('YAMAHA','XV535 (Virago 535)',1981,'Spark Plugs','Replace spark plugs',19200,NULL,'medium','v-twin',3),
  ('YAMAHA','XV535 (Virago 535)',1981,'Brake Fluid','Replace DOT 4 brake fluid',25600,730,'high','v-twin',4),
  ('YAMAHA','XV535 (Virago 535)',1981,'Final Drive Oil','Check and replace shaft drive gear oil (SAE 80W-90 GL4)',6400,180,'medium','v-twin',5),
  ('YAMAHA','XV535 (Virago 535)',1981,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',6),
  ('YAMAHA','XV535 (Virago 535)',1981,'Valve Clearance','Check and adjust valve clearance',6400,180,'high','v-twin',7),
  ('YAMAHA','XV535 (Virago 535)',1981,'Fork Oil','Replace fork oil and inspect seals',25600,730,'medium','v-twin',8),
  ('YAMAHA','XV535 (Virago 535)',1981,'Brake Pads Inspection','Inspect front and rear brake pads',6400,180,'high','v-twin',9);

-- ============================================================
-- KTM
-- ============================================================

-- 390 Duke (2015+) — Single 373cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KTM','390 Duke',2015,'Oil & Filter Change','Replace engine oil and oil filter; clean oil screen',7500,365,'high','single',1),
  ('KTM','390 Duke',2015,'Air Filter','Replace air filter element',7500,365,'medium','single',2),
  ('KTM','390 Duke',2015,'Spark Plug','Replace spark plug',15000,730,'medium','single',3),
  ('KTM','390 Duke',2015,'Brake Fluid','Replace DOT 4 brake fluid',15000,730,'high','single',4),
  ('KTM','390 Duke',2015,'Coolant','Replace engine coolant',30000,1460,'medium','single',5),
  ('KTM','390 Duke',2015,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','single',6),
  ('KTM','390 Duke',2015,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('KTM','390 Duke',2015,'Valve Clearance','Check and adjust valve clearance (shim-under-bucket)',15000,730,'high','single',8),
  ('KTM','390 Duke',2015,'Fork Oil','Replace fork oil and inspect seals',30000,1460,'medium','single',9),
  ('KTM','390 Duke',2015,'Brake Pads Inspection','Inspect front and rear brake pads',7500,365,'high','single',10);

-- Duke (200/250/390 generic, 2020+) — Single, liquid-cooled, chain
-- Covers Duke models stored without displacement in NHTSA data
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KTM','Duke',2020,'Oil & Filter Change','Replace engine oil and oil filter; clean oil screen',7500,365,'high','single',1),
  ('KTM','Duke',2020,'Air Filter','Replace air filter element',7500,365,'medium','single',2),
  ('KTM','Duke',2020,'Spark Plug','Replace spark plug',15000,730,'medium','single',3),
  ('KTM','Duke',2020,'Brake Fluid','Replace DOT 4 brake fluid',15000,730,'high','single',4),
  ('KTM','Duke',2020,'Coolant','Replace engine coolant',30000,1460,'medium','single',5),
  ('KTM','Duke',2020,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','single',6),
  ('KTM','Duke',2020,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('KTM','Duke',2020,'Valve Clearance','Check and adjust valve clearance (shim-under-bucket)',15000,730,'high','single',8),
  ('KTM','Duke',2020,'Fork Oil','Replace fork oil and inspect seals',30000,1460,'medium','single',9),
  ('KTM','Duke',2020,'Brake Pads Inspection','Inspect front and rear brake pads',7500,365,'high','single',10);

-- Super Adventure S (1290, 2017+) — V-twin LC8 1301cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KTM','Super Adventure S',2017,'Oil & Filter Change','Replace engine oil and oil filter; clean oil screens',15000,365,'high','v-twin',1),
  ('KTM','Super Adventure S',2017,'Air Filter','Replace air filter element',15000,365,'medium','v-twin',2),
  ('KTM','Super Adventure S',2017,'Spark Plugs','Replace spark plugs',30000,730,'medium','v-twin',3),
  ('KTM','Super Adventure S',2017,'Brake Fluid','Replace DOT 4 brake fluid (includes hydraulic clutch)',NULL,730,'high','v-twin',4),
  ('KTM','Super Adventure S',2017,'Coolant','Replace engine coolant',30000,1460,'medium','v-twin',5),
  ('KTM','Super Adventure S',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','v-twin',6),
  ('KTM','Super Adventure S',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('KTM','Super Adventure S',2017,'Valve Clearance','Check and adjust valve clearance',30000,730,'high','v-twin',8),
  ('KTM','Super Adventure S',2017,'Fork Oil','Replace fork oil and inspect seals',30000,730,'medium','v-twin',9),
  ('KTM','Super Adventure S',2017,'Brake Pads Inspection','Inspect front and rear brake pads',15000,365,'high','v-twin',10);

-- V-twin LC8 Adventure (990, 2003–2012) — V-twin LC8 999cc, liquid-cooled, chain
-- Shorter intervals than 1290; fork oil notably short at 15 000 km
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KTM','V-twin LC8 Adventure',2003,'Oil & Filter Change','Replace engine oil and oil filter; clean oil screen',7500,365,'high','v-twin',1),
  ('KTM','V-twin LC8 Adventure',2003,'Air Filter','Replace air filter element',7500,365,'medium','v-twin',2),
  ('KTM','V-twin LC8 Adventure',2003,'Spark Plugs','Replace NGK DCPR8E spark plugs (gap 0.8 mm)',15000,730,'medium','v-twin',3),
  ('KTM','V-twin LC8 Adventure',2003,'Brake Fluid','Replace Motorex DOT 5.1 brake fluid',NULL,730,'high','v-twin',4),
  ('KTM','V-twin LC8 Adventure',2003,'Coolant','Replace engine coolant',15000,730,'medium','v-twin',5),
  ('KTM','V-twin LC8 Adventure',2003,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','v-twin',6),
  ('KTM','V-twin LC8 Adventure',2003,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('KTM','V-twin LC8 Adventure',2003,'Valve Clearance','Check and adjust valve clearance',15000,730,'high','v-twin',8),
  ('KTM','V-twin LC8 Adventure',2003,'Fork Oil','Replace fork oil and inspect seals',15000,730,'medium','v-twin',9),
  ('KTM','V-twin LC8 Adventure',2003,'Brake Pads Inspection','Inspect front and rear brake pads',7500,365,'high','v-twin',10);

-- Enduro Four-Stroke (250-500cc EXC, 2019+) — Single, liquid-cooled, chain
-- Very short intervals; off-road competition bike. Hour-based converted to km.
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('KTM','Enduro Four-Stroke',2019,'Oil & Filter Change','Replace engine oil, oil filter, and clean oil screen',750,NULL,'high','single',1),
  ('KTM','Enduro Four-Stroke',2019,'Air Filter','Clean or replace air filter (after every dusty/wet ride)',3000,90,'high','single',2),
  ('KTM','Enduro Four-Stroke',2019,'Spark Plug','Replace spark plug',3000,NULL,'medium','single',3),
  ('KTM','Enduro Four-Stroke',2019,'Brake Fluid','Replace DOT 4 brake fluid',NULL,365,'high','single',4),
  ('KTM','Enduro Four-Stroke',2019,'Coolant','Replace engine coolant',3000,NULL,'medium','single',5),
  ('KTM','Enduro Four-Stroke',2019,'Chain Clean & Lube','Clean, lubricate and adjust drive chain (lube before every ride)',250,NULL,'medium','single',6),
  ('KTM','Enduro Four-Stroke',2019,'Tire Pressure Check','Check and adjust tire pressure',NULL,14,'low','single',7),
  ('KTM','Enduro Four-Stroke',2019,'Valve Clearance','Check and adjust valve clearance',1500,NULL,'high','single',8),
  ('KTM','Enduro Four-Stroke',2019,'Fork Oil','Replace fork oil (WP XPLOR/XACT) and inspect seals',3000,NULL,'medium','single',9),
  ('KTM','Enduro Four-Stroke',2019,'Brake Pads Inspection','Inspect front and rear brake pads',750,NULL,'high','single',10);

-- ============================================================
-- HARLEY-DAVIDSON
-- ============================================================

-- Road Glide (Milwaukee-Eight 114/117, 2017+) — V-twin, air/oil-cooled, belt drive
-- Three separate oils (engine, primary, transmission). No coolant. Hydraulic lifters = no valve service.
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HARLEY-DAVIDSON','Road Glide',2017,'Oil & Filter Change','Replace engine oil (20W-50) and oil filter',8000,365,'high','v-twin',1),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Primary Chaincase Lubricant','Replace primary chaincase lubricant',8000,365,'high','v-twin',2),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Transmission Lubricant','Replace transmission lubricant',16000,365,'medium','v-twin',3),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Air Cleaner','Inspect and clean/replace air cleaner element as needed',8000,365,'medium','v-twin',4),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Spark Plugs','Replace dual-spark iridium spark plugs (4 total)',48000,730,'medium','v-twin',5),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',6),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Drive Belt Inspection','Inspect drive belt tension and condition',8000,365,'medium','v-twin',7),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',8),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Fork Oil','Rebuild forks and replace fork oil',80000,NULL,'medium','v-twin',9),
  ('HARLEY-DAVIDSON','Road Glide',2017,'Brake Pads Inspection','Inspect front and rear brake pads (min 0.4 mm)',8000,365,'high','v-twin',10);

-- Road Glide 3 (Milwaukee-Eight 117 CVO, 2024+) — Same schedule as Road Glide
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Oil & Filter Change','Replace engine oil (20W-50) and oil filter',8000,365,'high','v-twin',1),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Primary Chaincase Lubricant','Replace primary chaincase lubricant',8000,365,'high','v-twin',2),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Transmission Lubricant','Replace transmission lubricant',16000,365,'medium','v-twin',3),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Air Cleaner','Inspect and clean/replace air cleaner element as needed',8000,365,'medium','v-twin',4),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Spark Plugs','Replace dual-spark iridium spark plugs (4 total)',48000,730,'medium','v-twin',5),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',6),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Drive Belt Inspection','Inspect drive belt tension and condition',8000,365,'medium','v-twin',7),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',8),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Fork Oil','Rebuild forks and replace fork oil',80000,NULL,'medium','v-twin',9),
  ('HARLEY-DAVIDSON','Road Glide 3',2024,'Brake Pads Inspection','Inspect front and rear brake pads (min 0.4 mm)',8000,365,'high','v-twin',10);

-- Electra Glide Ultra Limited (Twin Cam 103, 2010–2016) — V-twin, air-cooled, belt drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Oil & Filter Change','Replace engine oil (20W-50) and oil filter',8000,365,'high','v-twin',1),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Primary Chaincase Lubricant','Replace primary chaincase lubricant',16000,365,'high','v-twin',2),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Transmission Lubricant','Replace transmission lubricant',32000,NULL,'medium','v-twin',3),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Air Cleaner','Inspect and clean/replace air cleaner element as needed',8000,365,'medium','v-twin',4),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Spark Plugs','Replace spark plugs',48000,730,'medium','v-twin',5),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',6),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Drive Belt Inspection','Inspect drive belt tension and condition',8000,365,'medium','v-twin',7),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',8),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Fork Oil','Rebuild forks and replace fork oil',80000,NULL,'medium','v-twin',9),
  ('HARLEY-DAVIDSON','Electra Glide Ultra Limited',2010,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','v-twin',10);

-- Pan America Special (Revolution Max 1250, 2021+) — V-twin, liquid-cooled, CHAIN drive
-- Unique HD: liquid-cooled, chain drive, unitized engine/trans (single oil)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Oil & Filter Change','Replace engine/transmission oil and oil filter (unitized)',8000,365,'high','v-twin',1),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Air Cleaner','Inspect and clean/replace air cleaner element as needed',8000,365,'medium','v-twin',2),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Spark Plugs','Replace dual-spark plugs (4 total)',16000,730,'medium','v-twin',3),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',4),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Coolant','Replace engine coolant',NULL,730,'medium','v-twin',5),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','v-twin',6),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Fork Oil','Rebuild forks and replace fork oil',80000,NULL,'medium','v-twin',8),
  ('HARLEY-DAVIDSON','Pan America Special',2021,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','v-twin',9);

-- Softail Deuce (Twin Cam 88B, 2000–2007) — V-twin, air-cooled, belt drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Oil & Filter Change','Replace engine oil (20W-50) and oil filter',8000,365,'high','v-twin',1),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Primary Chaincase Lubricant','Replace primary chaincase lubricant',16000,365,'high','v-twin',2),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Transmission Lubricant','Replace transmission lubricant',32000,NULL,'medium','v-twin',3),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Air Cleaner','Inspect and clean/replace air cleaner element as needed',8000,365,'medium','v-twin',4),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Spark Plugs','Replace spark plugs',24000,730,'medium','v-twin',5),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',6),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Drive Belt Inspection','Inspect drive belt tension and condition',8000,365,'medium','v-twin',7),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',8),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Cam Chain Tensioner Inspection','Inspect spring-loaded cam chain tensioner shoes for wear',48000,NULL,'high','v-twin',9),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Fork Oil','Rebuild forks and replace fork oil',80000,NULL,'medium','v-twin',10),
  ('HARLEY-DAVIDSON','Softail Deuce',2000,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','v-twin',11);

-- Dyna Super Glide (Twin Cam 88/96, 1999–2017) — V-twin, air-cooled, belt drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Oil & Filter Change','Replace engine oil (20W-50) and oil filter',8000,365,'high','v-twin',1),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Primary Chaincase Lubricant','Replace primary chaincase lubricant',16000,365,'high','v-twin',2),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Transmission Lubricant','Replace transmission lubricant',32000,NULL,'medium','v-twin',3),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Air Cleaner','Inspect and clean/replace air cleaner element as needed',8000,365,'medium','v-twin',4),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Spark Plugs','Replace spark plugs',24000,730,'medium','v-twin',5),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',6),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Drive Belt Inspection','Inspect drive belt tension and condition',8000,365,'medium','v-twin',7),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',8),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Fork Oil','Rebuild forks and replace fork oil',80000,NULL,'medium','v-twin',9),
  ('HARLEY-DAVIDSON','Dyna Super Glide',1999,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','v-twin',10);

-- ============================================================
-- TRIUMPH
-- ============================================================

-- Street Triple (765cc inline-3, 2017+) — Shorter intervals than Modern Classics
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('TRIUMPH','Street Triple',2017,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','inline-3',1),
  ('TRIUMPH','Street Triple',2017,'Air Filter','Replace air filter element',20000,NULL,'medium','inline-3',2),
  ('TRIUMPH','Street Triple',2017,'Spark Plugs','Replace spark plugs',20000,NULL,'medium','inline-3',3),
  ('TRIUMPH','Street Triple',2017,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','inline-3',4),
  ('TRIUMPH','Street Triple',2017,'Coolant','Replace engine coolant',40000,NULL,'medium','inline-3',5),
  ('TRIUMPH','Street Triple',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','inline-3',6),
  ('TRIUMPH','Street Triple',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-3',7),
  ('TRIUMPH','Street Triple',2017,'Valve Clearance','Check and adjust valve clearance',20000,NULL,'high','inline-3',8),
  ('TRIUMPH','Street Triple',2017,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','inline-3',9),
  ('TRIUMPH','Street Triple',2017,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','inline-3',10);

-- Speed (Speed Twin 1200 / Speed 400, 2019+) — Parallel-twin or single, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('TRIUMPH','Speed',2019,'Oil & Filter Change','Replace engine oil and oil filter',16000,365,'high','parallel-twin',1),
  ('TRIUMPH','Speed',2019,'Air Filter','Replace air filter element',16000,365,'medium','parallel-twin',2),
  ('TRIUMPH','Speed',2019,'Spark Plugs','Replace spark plugs',32000,NULL,'medium','parallel-twin',3),
  ('TRIUMPH','Speed',2019,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('TRIUMPH','Speed',2019,'Coolant','Replace engine coolant',NULL,1460,'medium','parallel-twin',5),
  ('TRIUMPH','Speed',2019,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','parallel-twin',6),
  ('TRIUMPH','Speed',2019,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('TRIUMPH','Speed',2019,'Valve Clearance','Check and adjust valve clearance',32000,NULL,'high','parallel-twin',8),
  ('TRIUMPH','Speed',2019,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','parallel-twin',9),
  ('TRIUMPH','Speed',2019,'Brake Pads Inspection','Inspect front and rear brake pads',16000,365,'high','parallel-twin',10);

-- Trident (660cc inline-3, 2021+) — Cable clutch, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('TRIUMPH','Trident',2021,'Oil & Filter Change','Replace engine oil and oil filter',16000,365,'high','inline-3',1),
  ('TRIUMPH','Trident',2021,'Air Filter','Replace air filter element',32000,NULL,'medium','inline-3',2),
  ('TRIUMPH','Trident',2021,'Spark Plugs','Replace spark plugs',32000,NULL,'medium','inline-3',3),
  ('TRIUMPH','Trident',2021,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','inline-3',4),
  ('TRIUMPH','Trident',2021,'Coolant','Replace engine coolant',NULL,1460,'medium','inline-3',5),
  ('TRIUMPH','Trident',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','inline-3',6),
  ('TRIUMPH','Trident',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-3',7),
  ('TRIUMPH','Trident',2021,'Valve Clearance','Check and adjust valve clearance',32000,NULL,'high','inline-3',8),
  ('TRIUMPH','Trident',2021,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','inline-3',9),
  ('TRIUMPH','Trident',2021,'Brake Pads Inspection','Inspect front and rear brake pads',16000,365,'high','inline-3',10);

-- Bobber (Bonneville 1200cc parallel-twin, 2017+) — Liquid-cooled HT engine, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('TRIUMPH','Bobber',2017,'Oil & Filter Change','Replace engine oil and oil filter',16000,365,'high','parallel-twin',1),
  ('TRIUMPH','Bobber',2017,'Air Filter','Replace air filter element',16000,365,'medium','parallel-twin',2),
  ('TRIUMPH','Bobber',2017,'Spark Plugs','Replace spark plugs',32000,NULL,'medium','parallel-twin',3),
  ('TRIUMPH','Bobber',2017,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('TRIUMPH','Bobber',2017,'Coolant','Replace engine coolant',NULL,1460,'medium','parallel-twin',5),
  ('TRIUMPH','Bobber',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','parallel-twin',6),
  ('TRIUMPH','Bobber',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('TRIUMPH','Bobber',2017,'Valve Clearance','Check and adjust valve clearance',32000,NULL,'high','parallel-twin',8),
  ('TRIUMPH','Bobber',2017,'Fork Oil','Replace fork oil and inspect seals',40000,NULL,'medium','parallel-twin',9),
  ('TRIUMPH','Bobber',2017,'Brake Pads Inspection','Inspect front and rear brake pads',16000,365,'high','parallel-twin',10);

-- Scrambler (1200cc parallel-twin, 2019+) — Liquid-cooled HT engine, chain
-- Longer fork oil interval (48 000 km) per Scrambler 1200 XC/XE handbook
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('TRIUMPH','Scrambler',2019,'Oil & Filter Change','Replace engine oil and oil filter',16000,365,'high','parallel-twin',1),
  ('TRIUMPH','Scrambler',2019,'Air Filter','Replace air filter element',16000,365,'medium','parallel-twin',2),
  ('TRIUMPH','Scrambler',2019,'Spark Plugs','Replace spark plugs',32000,NULL,'medium','parallel-twin',3),
  ('TRIUMPH','Scrambler',2019,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('TRIUMPH','Scrambler',2019,'Coolant','Replace engine coolant',NULL,1460,'medium','parallel-twin',5),
  ('TRIUMPH','Scrambler',2019,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','parallel-twin',6),
  ('TRIUMPH','Scrambler',2019,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('TRIUMPH','Scrambler',2019,'Valve Clearance','Check and adjust valve clearance',32000,NULL,'high','parallel-twin',8),
  ('TRIUMPH','Scrambler',2019,'Fork Oil','Replace fork oil and inspect seals',48000,NULL,'medium','parallel-twin',9),
  ('TRIUMPH','Scrambler',2019,'Brake Pads Inspection','Inspect front and rear brake pads',16000,365,'high','parallel-twin',10);

-- ============================================================
-- SUZUKI
-- ============================================================

-- SV650 (3rd gen, 2016+) — V-twin 645cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('SUZUKI','SV650',2016,'Oil & Filter Change','Replace engine oil (10W-40 JASO MA) and oil filter',6000,180,'high','v-twin',1),
  ('SUZUKI','SV650',2016,'Air Filter','Replace air filter element',24000,730,'medium','v-twin',2),
  ('SUZUKI','SV650',2016,'Spark Plugs','Replace NGK MR8E-9 spark plugs',12000,730,'medium','v-twin',3),
  ('SUZUKI','SV650',2016,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',4),
  ('SUZUKI','SV650',2016,'Coolant','Replace engine coolant',48000,1460,'medium','v-twin',5),
  ('SUZUKI','SV650',2016,'Chain Clean & Lube','Clean, lubricate and adjust drive chain (slack 20-30 mm)',1000,30,'medium','v-twin',6),
  ('SUZUKI','SV650',2016,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('SUZUKI','SV650',2016,'Valve Clearance','Check and adjust valve clearance',24000,730,'high','v-twin',8),
  ('SUZUKI','SV650',2016,'Fork Oil','Inspect fork oil and seals; replace as needed',24000,730,'medium','v-twin',9),
  ('SUZUKI','SV650',2016,'Brake Pads Inspection','Inspect front and rear brake pads',6000,180,'high','v-twin',10);

-- SV650/SV650S (1st/2nd gen, 1999–2012) — V-twin 645cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('SUZUKI','SV650/SV650S',1999,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,180,'high','v-twin',1),
  ('SUZUKI','SV650/SV650S',1999,'Air Filter','Replace air filter element',24000,730,'medium','v-twin',2),
  ('SUZUKI','SV650/SV650S',1999,'Spark Plugs','Replace spark plugs',12000,730,'medium','v-twin',3),
  ('SUZUKI','SV650/SV650S',1999,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',4),
  ('SUZUKI','SV650/SV650S',1999,'Coolant','Replace engine coolant',48000,1460,'medium','v-twin',5),
  ('SUZUKI','SV650/SV650S',1999,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','v-twin',6),
  ('SUZUKI','SV650/SV650S',1999,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('SUZUKI','SV650/SV650S',1999,'Valve Clearance','Check and adjust valve clearance',24000,730,'high','v-twin',8),
  ('SUZUKI','SV650/SV650S',1999,'Fork Oil','Inspect fork oil and seals; replace as needed',24000,730,'medium','v-twin',9),
  ('SUZUKI','SV650/SV650S',1999,'Brake Pads Inspection','Inspect front and rear brake pads',6000,180,'high','v-twin',10);

-- DL650XAAL9 (V-Strom 650XT Touring) (2017+) — V-twin 645cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,365,'high','v-twin',1),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Air Filter','Replace air filter element',18000,1095,'medium','v-twin',2),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Spark Plugs','Replace spark plugs',12000,730,'medium','v-twin',3),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',4),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Coolant','Replace Suzuki Super Long Life Coolant',48000,1460,'medium','v-twin',5),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','v-twin',6),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Valve Clearance','Check and adjust valve clearance',24000,730,'high','v-twin',8),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Fork Oil','Inspect fork oil and seals',12000,730,'medium','v-twin',9),
  ('SUZUKI','DL650XAAL9 (V-Strom 650XT Touring)',2017,'Brake Pads Inspection','Inspect front and rear brake pads',6000,365,'high','v-twin',10);

-- GSX-R1000 (2001+) — Inline-4 999cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('SUZUKI','GSX-R1000',2001,'Oil & Filter Change','Replace engine oil (10W-40 full synthetic) and oil filter',6000,180,'high','inline-4',1),
  ('SUZUKI','GSX-R1000',2001,'Air Filter','Replace air filter element',18000,540,'medium','inline-4',2),
  ('SUZUKI','GSX-R1000',2001,'Spark Plugs','Replace iridium spark plugs',12000,730,'medium','inline-4',3),
  ('SUZUKI','GSX-R1000',2001,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','inline-4',4),
  ('SUZUKI','GSX-R1000',2001,'Coolant','Replace engine coolant',48000,1460,'medium','inline-4',5),
  ('SUZUKI','GSX-R1000',2001,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','inline-4',6),
  ('SUZUKI','GSX-R1000',2001,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('SUZUKI','GSX-R1000',2001,'Valve Clearance','Check and adjust valve clearance',24000,1460,'high','inline-4',8),
  ('SUZUKI','GSX-R1000',2001,'Fork Oil','Inspect fork oil and seals; replace as needed',12000,365,'medium','inline-4',9),
  ('SUZUKI','GSX-R1000',2001,'Brake Pads Inspection','Inspect front and rear brake pads',6000,180,'high','inline-4',10);

-- GSF600S Bandit (1995–2004) — Inline-4 599cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('SUZUKI','GSF600S',1995,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,180,'high','inline-4',1),
  ('SUZUKI','GSF600S',1995,'Air Filter','Replace air filter element',18000,1095,'medium','inline-4',2),
  ('SUZUKI','GSF600S',1995,'Spark Plugs','Replace spark plugs',12000,730,'medium','inline-4',3),
  ('SUZUKI','GSF600S',1995,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','inline-4',4),
  ('SUZUKI','GSF600S',1995,'Coolant','Replace engine coolant',48000,1460,'medium','inline-4',5),
  ('SUZUKI','GSF600S',1995,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,30,'medium','inline-4',6),
  ('SUZUKI','GSF600S',1995,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('SUZUKI','GSF600S',1995,'Valve Clearance','Check and adjust valve clearance',24000,730,'high','inline-4',8),
  ('SUZUKI','GSF600S',1995,'Fork Oil','Replace fork oil and inspect seals',24000,730,'medium','inline-4',9),
  ('SUZUKI','GSF600S',1995,'Brake Pads Inspection','Inspect front and rear brake pads',6000,180,'high','inline-4',10);

-- VL800/VL800T/VL800Z (Boulevard C50, 2001+) — V-twin 805cc, liquid-cooled, SHAFT drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',6000,180,'high','v-twin',1),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Air Filter','Replace air filter element',18000,1095,'medium','v-twin',2),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Spark Plugs','Replace spark plugs',12000,730,'medium','v-twin',3),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',4),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Coolant','Replace Suzuki Super Long Life Coolant',48000,1460,'medium','v-twin',5),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Final Drive Oil','Replace shaft drive gear oil (SAE 90 hypoid GL-5)',12000,730,'medium','v-twin',6),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Valve Clearance','Check and adjust valve clearance',12000,730,'high','v-twin',8),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Fork Oil','Inspect fork oil and seals',12000,730,'medium','v-twin',9),
  ('SUZUKI','VL800/VL800T/VL800Z',2001,'Brake Pads Inspection','Inspect front and rear brake pads',6000,180,'high','v-twin',10);

-- ============================================================
-- ROYAL ENFIELD
-- ============================================================

-- INT 650 / Continental GT 650 (2018+) — Parallel-twin 648cc, air-oil cooled, chain
-- No liquid coolant system (air-oil cooled)
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('ROYAL ENFIELD','INT 650',2018,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','parallel-twin',1),
  ('ROYAL ENFIELD','INT 650',2018,'Air Filter','Replace air filter element',20000,NULL,'medium','parallel-twin',2),
  ('ROYAL ENFIELD','INT 650',2018,'Spark Plugs','Replace spark plugs',20000,NULL,'medium','parallel-twin',3),
  ('ROYAL ENFIELD','INT 650',2018,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','parallel-twin',4),
  ('ROYAL ENFIELD','INT 650',2018,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','parallel-twin',5),
  ('ROYAL ENFIELD','INT 650',2018,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',6),
  ('ROYAL ENFIELD','INT 650',2018,'Valve Clearance','Check and adjust valve clearance',10000,365,'high','parallel-twin',7),
  ('ROYAL ENFIELD','INT 650',2018,'Fork Oil','Replace fork oil and inspect seals',20000,NULL,'medium','parallel-twin',8),
  ('ROYAL ENFIELD','INT 650',2018,'Brake Pads Inspection','Inspect front and rear brake pads',5000,180,'high','parallel-twin',9);

-- Shotgun 650 (2024+) — Same 648cc twin platform as INT 650
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('ROYAL ENFIELD','Shotgun 650',2024,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','parallel-twin',1),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Air Filter','Replace air filter element',20000,NULL,'medium','parallel-twin',2),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Spark Plugs','Replace spark plugs',20000,NULL,'medium','parallel-twin',3),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','parallel-twin',4),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','parallel-twin',5),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',6),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Valve Clearance','Check and adjust valve clearance',10000,365,'high','parallel-twin',7),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Fork Oil','Replace fork oil and inspect seals',20000,NULL,'medium','parallel-twin',8),
  ('ROYAL ENFIELD','Shotgun 650',2024,'Brake Pads Inspection','Inspect front and rear brake pads',5000,180,'high','parallel-twin',9);

-- Hunter 350 (2022+) — Single 349cc (J-series), air-oil cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('ROYAL ENFIELD','Hunter 350',2022,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','single',1),
  ('ROYAL ENFIELD','Hunter 350',2022,'Air Filter','Replace air filter element',20000,NULL,'medium','single',2),
  ('ROYAL ENFIELD','Hunter 350',2022,'Spark Plug','Replace spark plug',10000,365,'medium','single',3),
  ('ROYAL ENFIELD','Hunter 350',2022,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','single',4),
  ('ROYAL ENFIELD','Hunter 350',2022,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','single',5),
  ('ROYAL ENFIELD','Hunter 350',2022,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',6),
  ('ROYAL ENFIELD','Hunter 350',2022,'Valve Clearance','Check and adjust valve clearance',10000,365,'high','single',7),
  ('ROYAL ENFIELD','Hunter 350',2022,'Fork Oil','Replace fork oil and inspect seals',20000,NULL,'medium','single',8),
  ('ROYAL ENFIELD','Hunter 350',2022,'Brake Pads Inspection','Inspect front and rear brake pads',5000,180,'high','single',9);

-- Classic (350, 2021+) — Single 349cc (J-series), air-oil cooled, chain
-- Same platform as Hunter 350
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('ROYAL ENFIELD','Classic',2021,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','single',1),
  ('ROYAL ENFIELD','Classic',2021,'Air Filter','Replace air filter element',20000,NULL,'medium','single',2),
  ('ROYAL ENFIELD','Classic',2021,'Spark Plug','Replace spark plug',10000,365,'medium','single',3),
  ('ROYAL ENFIELD','Classic',2021,'Brake Fluid','Replace DOT 4 brake fluid',20000,730,'high','single',4),
  ('ROYAL ENFIELD','Classic',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','single',5),
  ('ROYAL ENFIELD','Classic',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',6),
  ('ROYAL ENFIELD','Classic',2021,'Valve Clearance','Check and adjust valve clearance',10000,365,'high','single',7),
  ('ROYAL ENFIELD','Classic',2021,'Fork Oil','Replace fork oil and inspect seals',20000,NULL,'medium','single',8),
  ('ROYAL ENFIELD','Classic',2021,'Brake Pads Inspection','Inspect front and rear brake pads',5000,180,'high','single',9);

-- ============================================================
-- DUCATI
-- ============================================================

-- Panigale (V4 1103cc, 2018+) — V4 Desmosedici Stradale, liquid-cooled, chain
-- Chain-driven cams (no timing belt). Desmodromic valve service at 24 000 km.
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('DUCATI','Panigale',2018,'Oil & Filter Change','Replace engine oil and oil filter',12000,365,'high','v4',1),
  ('DUCATI','Panigale',2018,'Air Filter','Replace air filter element',24000,NULL,'medium','v4',2),
  ('DUCATI','Panigale',2018,'Spark Plugs','Replace spark plugs',24000,NULL,'medium','v4',3),
  ('DUCATI','Panigale',2018,'Brake Fluid','Replace DOT 4 brake and clutch fluid',NULL,730,'high','v4',4),
  ('DUCATI','Panigale',2018,'Coolant','Replace engine coolant',NULL,1460,'medium','v4',5),
  ('DUCATI','Panigale',2018,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','v4',6),
  ('DUCATI','Panigale',2018,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v4',7),
  ('DUCATI','Panigale',2018,'Valve Clearance (Desmo)','Check and adjust Desmodromic valve clearance (opening + closing)',24000,NULL,'high','v4',8),
  ('DUCATI','Panigale',2018,'Fork Oil','Replace fork oil and inspect seals',NULL,1095,'medium','v4',9),
  ('DUCATI','Panigale',2018,'Brake Pads Inspection','Inspect front and rear brake pads',12000,365,'high','v4',10);

-- Supersport (950, L-twin 937cc, 2017+) — Testastretta 11-degree, liquid-cooled, chain
-- Timing belt replacement at Desmo service or every 5 years
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('DUCATI','Supersport',2017,'Oil & Filter Change','Replace engine oil and oil filter',12000,365,'high','l-twin',1),
  ('DUCATI','Supersport',2017,'Air Filter','Replace air filter element',24000,NULL,'medium','l-twin',2),
  ('DUCATI','Supersport',2017,'Spark Plugs','Replace spark plugs',24000,NULL,'medium','l-twin',3),
  ('DUCATI','Supersport',2017,'Brake Fluid','Replace DOT 4 brake and clutch fluid',NULL,730,'high','l-twin',4),
  ('DUCATI','Supersport',2017,'Coolant','Replace engine coolant',NULL,1460,'medium','l-twin',5),
  ('DUCATI','Supersport',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','l-twin',6),
  ('DUCATI','Supersport',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','l-twin',7),
  ('DUCATI','Supersport',2017,'Valve Clearance (Desmo)','Check and adjust Desmodromic valve clearance (opening + closing)',24000,NULL,'high','l-twin',8),
  ('DUCATI','Supersport',2017,'Timing Belt','Replace timing belt',24000,1825,'high','l-twin',9),
  ('DUCATI','Supersport',2017,'Fork Oil','Replace fork oil and inspect seals',NULL,1095,'medium','l-twin',10),
  ('DUCATI','Supersport',2017,'Brake Pads Inspection','Inspect front and rear brake pads',12000,365,'high','l-twin',11);

-- Hypermotard (HYM) (2007+) — L-twin, liquid-cooled, chain
-- Covers both original 1100 air-cooled and newer 821/939/950 liquid-cooled
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('DUCATI','Hypermotard (HYM)',2007,'Oil & Filter Change','Replace engine oil and oil filter',12000,365,'high','l-twin',1),
  ('DUCATI','Hypermotard (HYM)',2007,'Air Filter','Replace air filter element',30000,NULL,'medium','l-twin',2),
  ('DUCATI','Hypermotard (HYM)',2007,'Spark Plugs','Replace spark plugs',30000,NULL,'medium','l-twin',3),
  ('DUCATI','Hypermotard (HYM)',2007,'Brake Fluid','Replace DOT 4 brake and clutch fluid',NULL,730,'high','l-twin',4),
  ('DUCATI','Hypermotard (HYM)',2007,'Coolant','Replace engine coolant',NULL,1460,'medium','l-twin',5),
  ('DUCATI','Hypermotard (HYM)',2007,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','l-twin',6),
  ('DUCATI','Hypermotard (HYM)',2007,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','l-twin',7),
  ('DUCATI','Hypermotard (HYM)',2007,'Valve Clearance (Desmo)','Check and adjust Desmodromic valve clearance (opening + closing)',30000,NULL,'high','l-twin',8),
  ('DUCATI','Hypermotard (HYM)',2007,'Timing Belt','Replace timing belt',30000,1825,'high','l-twin',9),
  ('DUCATI','Hypermotard (HYM)',2007,'Fork Oil','Replace fork oil and inspect seals',42000,NULL,'medium','l-twin',10),
  ('DUCATI','Hypermotard (HYM)',2007,'Brake Pads Inspection','Inspect front and rear brake pads',12000,365,'high','l-twin',11);

-- Monster 821 (2014+) — L-twin 821cc Testastretta 11-degree, liquid-cooled, chain
-- Note: make is 'Ducati' (mixed case) in the motorcycles table
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('DUCATI','Monster 821',2014,'Oil & Filter Change','Replace engine oil and oil filter',15000,365,'high','l-twin',1),
  ('DUCATI','Monster 821',2014,'Air Filter','Replace air filter element',30000,NULL,'medium','l-twin',2),
  ('DUCATI','Monster 821',2014,'Spark Plugs','Replace spark plugs',15000,NULL,'medium','l-twin',3),
  ('DUCATI','Monster 821',2014,'Brake Fluid','Replace DOT 4 brake and clutch fluid',NULL,730,'high','l-twin',4),
  ('DUCATI','Monster 821',2014,'Coolant','Replace engine coolant',NULL,1460,'medium','l-twin',5),
  ('DUCATI','Monster 821',2014,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','l-twin',6),
  ('DUCATI','Monster 821',2014,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','l-twin',7),
  ('DUCATI','Monster 821',2014,'Valve Clearance (Desmo)','Check and adjust Desmodromic valve clearance (opening + closing)',30000,NULL,'high','l-twin',8),
  ('DUCATI','Monster 821',2014,'Timing Belt','Replace timing belt',30000,1825,'high','l-twin',9),
  ('DUCATI','Monster 821',2014,'Fork Oil','Replace fork oil and inspect seals',NULL,1095,'medium','l-twin',10),
  ('DUCATI','Monster 821',2014,'Brake Pads Inspection','Inspect front and rear brake pads',15000,365,'high','l-twin',11);

-- ============================================================
-- APRILIA
-- ============================================================

-- Tuareg (660, 2022+) — Parallel-twin 659cc, liquid-cooled, chain
-- Halve km intervals when used off-road
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('APRILIA','Tuareg',2022,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','parallel-twin',1),
  ('APRILIA','Tuareg',2022,'Air Filter','Replace air filter element',20000,NULL,'medium','parallel-twin',2),
  ('APRILIA','Tuareg',2022,'Spark Plugs','Replace spark plugs',20000,NULL,'medium','parallel-twin',3),
  ('APRILIA','Tuareg',2022,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('APRILIA','Tuareg',2022,'Coolant','Replace engine coolant',NULL,1460,'medium','parallel-twin',5),
  ('APRILIA','Tuareg',2022,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','parallel-twin',6),
  ('APRILIA','Tuareg',2022,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('APRILIA','Tuareg',2022,'Valve Clearance','Check and adjust valve clearance',20000,NULL,'high','parallel-twin',8),
  ('APRILIA','Tuareg',2022,'Fork Oil','Replace fork oil and inspect seals',40000,1460,'medium','parallel-twin',9),
  ('APRILIA','Tuareg',2022,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- Tuono (660, 2021+) — Same 659cc parallel-twin platform as Tuareg
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('APRILIA','Tuono',2021,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','parallel-twin',1),
  ('APRILIA','Tuono',2021,'Air Filter','Replace air filter element',20000,NULL,'medium','parallel-twin',2),
  ('APRILIA','Tuono',2021,'Spark Plugs','Replace spark plugs',20000,NULL,'medium','parallel-twin',3),
  ('APRILIA','Tuono',2021,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('APRILIA','Tuono',2021,'Coolant','Replace engine coolant',NULL,1460,'medium','parallel-twin',5),
  ('APRILIA','Tuono',2021,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','parallel-twin',6),
  ('APRILIA','Tuono',2021,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('APRILIA','Tuono',2021,'Valve Clearance','Check and adjust valve clearance',20000,NULL,'high','parallel-twin',8),
  ('APRILIA','Tuono',2021,'Fork Oil','Replace fork oil and inspect seals',40000,1460,'medium','parallel-twin',9),
  ('APRILIA','Tuono',2021,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','parallel-twin',10);

-- ============================================================
-- HUSQVARNA
-- ============================================================

-- Svartpilen 701 (2018+) — Single 692cc (LC4, shared with KTM 690), liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HUSQVARNA','Svartpilen 701',2018,'Oil & Filter Change','Replace engine oil and oil filter',10000,365,'high','single',1),
  ('HUSQVARNA','Svartpilen 701',2018,'Air Filter','Replace air filter element',10000,NULL,'medium','single',2),
  ('HUSQVARNA','Svartpilen 701',2018,'Spark Plug','Replace spark plug',20000,NULL,'medium','single',3),
  ('HUSQVARNA','Svartpilen 701',2018,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','single',4),
  ('HUSQVARNA','Svartpilen 701',2018,'Coolant','Replace engine coolant',NULL,1460,'medium','single',5),
  ('HUSQVARNA','Svartpilen 701',2018,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','single',6),
  ('HUSQVARNA','Svartpilen 701',2018,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('HUSQVARNA','Svartpilen 701',2018,'Valve Clearance','Check and adjust valve clearance',10000,NULL,'high','single',8),
  ('HUSQVARNA','Svartpilen 701',2018,'Fork Oil','Replace fork oil and inspect seals',20000,NULL,'medium','single',9),
  ('HUSQVARNA','Svartpilen 701',2018,'Brake Pads Inspection','Inspect front and rear brake pads',10000,365,'high','single',10);

-- Svartpilen/Vitpilen (401, 2018+) — Single 373cc (shared with KTM 390), liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Oil & Filter Change','Replace engine oil and oil filter',7500,365,'high','single',1),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Air Filter','Replace air filter element',15000,NULL,'medium','single',2),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Spark Plug','Replace spark plug',15000,NULL,'medium','single',3),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','single',4),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Coolant','Replace engine coolant',NULL,1460,'medium','single',5),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','single',6),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Valve Clearance','Check and adjust valve clearance',15000,NULL,'high','single',8),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Fork Oil','Replace fork oil and inspect seals',15000,NULL,'medium','single',9),
  ('HUSQVARNA','Svartpilen/Vitpilen',2018,'Brake Pads Inspection','Inspect front and rear brake pads',7500,365,'high','single',10);

-- ============================================================
-- CFMOTO
-- ============================================================

-- 450CL (2024+) — Parallel-twin 449cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('CFMOTO','450CL',2024,'Oil & Filter Change','Replace engine oil and oil filter',5000,180,'high','parallel-twin',1),
  ('CFMOTO','450CL',2024,'Air Filter','Replace air filter element',10000,NULL,'medium','parallel-twin',2),
  ('CFMOTO','450CL',2024,'Spark Plugs','Replace spark plugs',10000,NULL,'medium','parallel-twin',3),
  ('CFMOTO','450CL',2024,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('CFMOTO','450CL',2024,'Coolant','Replace engine coolant',NULL,730,'medium','parallel-twin',5),
  ('CFMOTO','450CL',2024,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','parallel-twin',6),
  ('CFMOTO','450CL',2024,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('CFMOTO','450CL',2024,'Valve Clearance','Check and adjust valve clearance',40000,NULL,'high','parallel-twin',8),
  ('CFMOTO','450CL',2024,'Fork Oil','Replace fork oil and inspect seals',20000,NULL,'medium','parallel-twin',9),
  ('CFMOTO','450CL',2024,'Brake Pads Inspection','Inspect front and rear brake pads',5000,180,'high','parallel-twin',10);

-- 450NK (2024+) — Same 449cc parallel-twin platform as 450CL
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('CFMOTO','450NK',2024,'Oil & Filter Change','Replace engine oil and oil filter',5000,180,'high','parallel-twin',1),
  ('CFMOTO','450NK',2024,'Air Filter','Replace air filter element',10000,NULL,'medium','parallel-twin',2),
  ('CFMOTO','450NK',2024,'Spark Plugs','Replace spark plugs',10000,NULL,'medium','parallel-twin',3),
  ('CFMOTO','450NK',2024,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('CFMOTO','450NK',2024,'Coolant','Replace engine coolant',NULL,730,'medium','parallel-twin',5),
  ('CFMOTO','450NK',2024,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','parallel-twin',6),
  ('CFMOTO','450NK',2024,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('CFMOTO','450NK',2024,'Valve Clearance','Check and adjust valve clearance',40000,NULL,'high','parallel-twin',8),
  ('CFMOTO','450NK',2024,'Fork Oil','Replace fork oil and inspect seals',20000,NULL,'medium','parallel-twin',9),
  ('CFMOTO','450NK',2024,'Brake Pads Inspection','Inspect front and rear brake pads',5000,180,'high','parallel-twin',10);

-- ============================================================
-- HONDA (additional uncovered models)
-- ============================================================

-- SCL500 (CL500 Scrambler, 2023+) — Parallel-twin 471cc (CB500 engine), liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','SCL500',2023,'Oil & Filter Change','Replace engine oil and oil filter',12000,365,'high','parallel-twin',1),
  ('HONDA','SCL500',2023,'Air Filter','Replace air filter element',24000,730,'medium','parallel-twin',2),
  ('HONDA','SCL500',2023,'Spark Plugs','Replace spark plugs',24000,730,'medium','parallel-twin',3),
  ('HONDA','SCL500',2023,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','parallel-twin',4),
  ('HONDA','SCL500',2023,'Coolant','Replace engine coolant',NULL,1095,'medium','parallel-twin',5),
  ('HONDA','SCL500',2023,'Chain Clean & Lube','Clean, lubricate and adjust drive chain (slack 30-40 mm)',1000,NULL,'medium','parallel-twin',6),
  ('HONDA','SCL500',2023,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','parallel-twin',7),
  ('HONDA','SCL500',2023,'Valve Clearance','Check and adjust valve clearance',24000,730,'high','parallel-twin',8),
  ('HONDA','SCL500',2023,'Fork Oil','Replace fork oil and inspect seals',24000,NULL,'medium','parallel-twin',9),
  ('HONDA','SCL500',2023,'Brake Pads Inspection','Inspect front and rear brake pads',12000,365,'high','parallel-twin',10);

-- CB750 (Nighthawk 750) (1991+) — Inline-4 748cc, DOHC, liquid-cooled, chain
-- Hydraulic tappets — no scheduled valve clearance adjustment
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','CB750 (Nighthawk 750)',1991,'Oil & Filter Change','Replace engine oil and oil filter',6000,365,'high','inline-4',1),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Air Filter','Replace air filter element',12800,730,'medium','inline-4',2),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Spark Plugs','Replace NGK DPR8EA-9 spark plugs',12800,730,'medium','inline-4',3),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','inline-4',4),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Coolant','Replace engine coolant',NULL,730,'medium','inline-4',5),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','inline-4',6),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Fork Oil','Replace fork oil and inspect seals',24000,NULL,'medium','inline-4',8),
  ('HONDA','CB750 (Nighthawk 750)',1991,'Brake Pads Inspection','Inspect front and rear brake pads',6000,NULL,'high','inline-4',9);

-- CX500 (1978–1983) — V-twin 497cc, OHV, liquid-cooled, shaft drive
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','CX500',1978,'Oil & Filter Change','Replace engine oil and oil filter',12000,365,'high','v-twin',1),
  ('HONDA','CX500',1978,'Air Filter','Replace air filter element',24000,730,'medium','v-twin',2),
  ('HONDA','CX500',1978,'Spark Plugs','Replace spark plugs',24000,730,'medium','v-twin',3),
  ('HONDA','CX500',1978,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','v-twin',4),
  ('HONDA','CX500',1978,'Coolant','Replace engine coolant',NULL,730,'medium','v-twin',5),
  ('HONDA','CX500',1978,'Final Drive Oil','Check and replace shaft drive gear oil (SAE 80W-90 hypoid)',12000,365,'medium','v-twin',6),
  ('HONDA','CX500',1978,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',7),
  ('HONDA','CX500',1978,'Valve Clearance','Check and adjust valve clearance (IN 0.08 mm, EX 0.10 mm)',12000,365,'high','v-twin',8),
  ('HONDA','CX500',1978,'Fork Oil','Replace fork oil and inspect seals',24000,730,'medium','v-twin',9),
  ('HONDA','CX500',1978,'Brake Pads Inspection','Inspect front and rear brake pads',12000,NULL,'high','v-twin',10);

-- cb550 (1974–1978) — Inline-4 544cc, SOHC, air-cooled, chain
-- Very short intervals typical of 1970s engines. No coolant (air-cooled).
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','cb550',1974,'Oil & Filter Change','Replace engine oil; clean centrifugal oil filter',2400,180,'high','inline-4',1),
  ('HONDA','cb550',1974,'Air Filter','Inspect and clean air filter element',8000,365,'medium','inline-4',2),
  ('HONDA','cb550',1974,'Spark Plugs','Inspect, clean, re-gap; replace at 9 600 km',4800,365,'medium','inline-4',3),
  ('HONDA','cb550',1974,'Brake Fluid','Check brake fluid level',NULL,365,'high','inline-4',4),
  ('HONDA','cb550',1974,'Chain Clean & Lube','Clean, lubricate and adjust drive chain (1-2 cm slack)',800,NULL,'medium','inline-4',5),
  ('HONDA','cb550',1974,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',6),
  ('HONDA','cb550',1974,'Valve Clearance','Check and adjust valve clearance (IN 0.05 mm, EX 0.08 mm)',2400,180,'high','inline-4',7),
  ('HONDA','cb550',1974,'Fork Oil','Replace fork oil and inspect seals',8000,365,'medium','inline-4',8),
  ('HONDA','cb550',1974,'Brake Pads Inspection','Inspect brake pads and shoes',4800,NULL,'high','inline-4',9);

-- CB250 (Nighthawk 250, 1991–2008) — Single 234cc, SOHC, air-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','CB250',1991,'Oil & Filter Change','Replace engine oil and oil filter',6400,365,'high','single',1),
  ('HONDA','CB250',1991,'Air Filter','Replace air filter element',12800,730,'medium','single',2),
  ('HONDA','CB250',1991,'Spark Plug','Replace spark plug',12800,730,'medium','single',3),
  ('HONDA','CB250',1991,'Brake Fluid','Replace DOT 4 brake fluid',NULL,730,'high','single',4),
  ('HONDA','CB250',1991,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','single',5),
  ('HONDA','CB250',1991,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',6),
  ('HONDA','CB250',1991,'Valve Clearance','Check and adjust valve clearance',12800,730,'high','single',7),
  ('HONDA','CB250',1991,'Fork Oil','Replace fork oil and inspect seals',19200,730,'medium','single',8),
  ('HONDA','CB250',1991,'Brake Pads Inspection','Inspect front and rear brake pads',6400,NULL,'high','single',9);

-- CB-1 (CB400F, 1989–1990) — Inline-4 399cc, DOHC, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('HONDA','CB-1',1989,'Oil & Filter Change','Replace engine oil (10W-40) and oil filter',12800,365,'high','inline-4',1),
  ('HONDA','CB-1',1989,'Air Filter','Replace air filter element',19200,730,'medium','inline-4',2),
  ('HONDA','CB-1',1989,'Spark Plugs','Replace NGK CR8EH-9 spark plugs (gap 0.8-0.9 mm)',19200,730,'medium','inline-4',3),
  ('HONDA','CB-1',1989,'Brake Fluid','Replace DOT 4 brake fluid',19200,730,'high','inline-4',4),
  ('HONDA','CB-1',1989,'Coolant','Replace engine coolant',38400,730,'medium','inline-4',5),
  ('HONDA','CB-1',1989,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',1000,NULL,'medium','inline-4',6),
  ('HONDA','CB-1',1989,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','inline-4',7),
  ('HONDA','CB-1',1989,'Valve Clearance','Check and adjust valve clearance (IN 0.12-0.18 mm, EX 0.17-0.23 mm)',19200,730,'high','inline-4',8),
  ('HONDA','CB-1',1989,'Fork Oil','Replace fork oil and inspect seals',24000,730,'medium','inline-4',9),
  ('HONDA','CB-1',1989,'Brake Pads Inspection','Inspect front and rear brake pads',6400,NULL,'high','inline-4',10);

-- ============================================================
-- INDIAN MOTORCYCLE
-- ============================================================

-- Roadmaster Dark Horse (Thunder Stroke 116, 2023+) — V-twin 1890cc, air-cooled, belt drive
-- Hydraulic lifters — no valve service. Three separate oils (engine, primary, transmission).
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Oil & Filter Change','Replace engine oil (20W-40) and oil filter',8000,365,'high','v-twin',1),
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Air Cleaner','Inspect and clean/replace air cleaner element as needed',8000,365,'medium','v-twin',2),
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Spark Plugs','Inspect NGK DCPR8E spark plugs (gap 0.9 mm)',16000,NULL,'medium','v-twin',3),
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Brake Fluid','Replace DOT 4 brake fluid',48000,730,'high','v-twin',4),
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Drive Belt Inspection','Inspect drive belt tension and condition (28 mm deflection at 4.5 kg)',8000,365,'medium','v-twin',5),
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',6),
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Fork Oil','Rebuild forks and replace fork oil',48000,730,'medium','v-twin',7),
  ('INDIAN MOTORCYCLE','Roadmaster Dark Horse',2020,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','v-twin',8);

-- ============================================================
-- VICTORY
-- ============================================================

-- Vegas (Freedom V-twin, 2003–2017) — V-twin 1634/1731cc, air/oil-cooled, belt drive
-- Hydraulic lifters — no valve service. Brand discontinued 2017.
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('VICTORY','Vegas',2003,'Oil & Filter Change','Replace engine oil (20W-40) and oil filter',8000,365,'high','v-twin',1),
  ('VICTORY','Vegas',2003,'Air Cleaner','Inspect and clean/replace air cleaner element',8000,365,'medium','v-twin',2),
  ('VICTORY','Vegas',2003,'Spark Plugs','Inspect spark plugs; replace at 48 000 km',8000,365,'medium','v-twin',3),
  ('VICTORY','Vegas',2003,'Brake Fluid','Replace DOT 4 brake fluid',48000,730,'high','v-twin',4),
  ('VICTORY','Vegas',2003,'Drive Belt Inspection','Inspect drive belt tension and condition',8000,365,'medium','v-twin',5),
  ('VICTORY','Vegas',2003,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','v-twin',6),
  ('VICTORY','Vegas',2003,'Fork Oil','Replace fork oil and inspect seals',24000,NULL,'medium','v-twin',7),
  ('VICTORY','Vegas',2003,'Brake Pads Inspection','Inspect front and rear brake pads',8000,365,'high','v-twin',8);

-- ============================================================
-- BAJAJ AUTO
-- ============================================================

-- Dominar 400 (2017+) — Single 373cc (KTM-derived), liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BAJAJ AUTO','Dominar 400',2017,'Oil & Filter Change','Replace engine oil (10W-50 full synthetic) and oil filter',6000,365,'high','single',1),
  ('BAJAJ AUTO','Dominar 400',2017,'Air Filter','Replace air filter element',12000,NULL,'medium','single',2),
  ('BAJAJ AUTO','Dominar 400',2017,'Spark Plug','Replace spark plug',15000,NULL,'medium','single',3),
  ('BAJAJ AUTO','Dominar 400',2017,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','single',4),
  ('BAJAJ AUTO','Dominar 400',2017,'Coolant','Replace Bajaj Koolex engine coolant',24000,730,'medium','single',5),
  ('BAJAJ AUTO','Dominar 400',2017,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','single',6),
  ('BAJAJ AUTO','Dominar 400',2017,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('BAJAJ AUTO','Dominar 400',2017,'Valve Clearance','Check and adjust valve clearance (IN 0.10 mm, EX 0.12 mm)',18000,NULL,'high','single',8),
  ('BAJAJ AUTO','Dominar 400',2017,'Fork Oil','Replace fork oil and inspect seals',24000,NULL,'medium','single',9),
  ('BAJAJ AUTO','Dominar 400',2017,'Brake Pads Inspection','Inspect front and rear brake pads',6000,NULL,'high','single',10);

-- Dominar (250, 2020+) — Single 248cc, liquid-cooled, chain
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BAJAJ AUTO','Dominar',2020,'Oil & Filter Change','Replace engine oil (10W-50) and oil filter',6000,365,'high','single',1),
  ('BAJAJ AUTO','Dominar',2020,'Air Filter','Replace air filter element',12000,NULL,'medium','single',2),
  ('BAJAJ AUTO','Dominar',2020,'Spark Plug','Replace spark plug',18000,NULL,'medium','single',3),
  ('BAJAJ AUTO','Dominar',2020,'Brake Fluid','Replace DOT 4 brake fluid',24000,730,'high','single',4),
  ('BAJAJ AUTO','Dominar',2020,'Coolant','Replace Bajaj Koolex engine coolant',30000,1095,'medium','single',5),
  ('BAJAJ AUTO','Dominar',2020,'Chain Clean & Lube','Clean, lubricate and adjust drive chain',500,NULL,'medium','single',6),
  ('BAJAJ AUTO','Dominar',2020,'Tire Pressure Check','Check and adjust cold tire pressure',NULL,14,'low','single',7),
  ('BAJAJ AUTO','Dominar',2020,'Valve Clearance','Check and adjust valve clearance',24000,NULL,'high','single',8),
  ('BAJAJ AUTO','Dominar',2020,'Fork Oil','Replace fork oil and inspect seals',24000,NULL,'medium','single',9),
  ('BAJAJ AUTO','Dominar',2020,'Brake Pads Inspection','Inspect front and rear brake pads',6000,NULL,'high','single',10);

-- ============================================================
-- BETA
-- ============================================================

-- RR (4-stroke enduro 350-500cc, 2012+) — Single, liquid-cooled, chain
-- Hour-based: 30 hours ≈ 750 km for trail riding. Very short intervals.
INSERT INTO public.oem_maintenance_schedules
  (make, model, year_from, task_name, description, interval_km, interval_days, priority, engine_type, sort_order)
VALUES
  ('BETA','RR',2012,'Oil & Filter Change','Replace engine oil and oil filter (separate engine + gearbox oils)',750,NULL,'high','single',1),
  ('BETA','RR',2012,'Air Filter','Clean or replace air filter (after every dusty/sandy ride)',750,NULL,'high','single',2),
  ('BETA','RR',2012,'Spark Plug','Inspect and replace spark plug as needed',750,NULL,'medium','single',3),
  ('BETA','RR',2012,'Brake Fluid','Check brake fluid level; full replace annually',NULL,365,'high','single',4),
  ('BETA','RR',2012,'Coolant','Check coolant level; full flush every 2 years',NULL,730,'medium','single',5),
  ('BETA','RR',2012,'Chain Clean & Lube','Clean, lubricate and adjust drive chain (before every ride)',250,NULL,'medium','single',6),
  ('BETA','RR',2012,'Tire Pressure Check','Check and adjust tire pressure',NULL,14,'low','single',7),
  ('BETA','RR',2012,'Valve Clearance','Check and adjust valve clearance',750,NULL,'high','single',8),
  ('BETA','RR',2012,'Fork Oil','Replace fork oil and inspect seals',1500,NULL,'medium','single',9),
  ('BETA','RR',2012,'Brake Pads Inspection','Inspect front and rear brake pads',750,NULL,'high','single',10);
