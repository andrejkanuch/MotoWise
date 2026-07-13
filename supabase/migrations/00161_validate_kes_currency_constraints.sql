-- Migration: Validate the currency CHECK constraints added NOT VALID in 00160.
--
-- Runs in its own transaction (separate migration file) so the validation scan
-- takes only a SHARE UPDATE EXCLUSIVE lock — which does NOT block reads or
-- writes — instead of piggybacking on the ACCESS EXCLUSIVE lock held until
-- commit by the NOT VALID add in 00160.
--
-- Because 00160's allowlist is a strict superset of the previous one, every
-- existing row already satisfies these constraints; VALIDATE is effectively a
-- formality that flips the catalog flag so the planner can rely on them.

ALTER TABLE public.users VALIDATE CONSTRAINT chk_users_currency;
ALTER TABLE public.expenses VALIDATE CONSTRAINT chk_expenses_currency;
ALTER TABLE public.maintenance_tasks VALIDATE CONSTRAINT chk_maintenance_tasks_currency;
ALTER TABLE public.fuel_logs VALIDATE CONSTRAINT chk_fuel_logs_currency;
