-- Change diagnostics.motorcycle_id from CASCADE to RESTRICT
-- This prevents accidental hard-delete of motorcycles that have diagnostics
ALTER TABLE public.diagnostics
  DROP CONSTRAINT diagnostics_motorcycle_id_fkey,
  ADD CONSTRAINT diagnostics_motorcycle_id_fkey
    FOREIGN KEY (motorcycle_id) REFERENCES public.motorcycles(id) ON DELETE RESTRICT;
