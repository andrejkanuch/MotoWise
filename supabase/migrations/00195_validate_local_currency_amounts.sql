-- 00195: validate the constraints 00194 added NOT VALID.
--
-- A separate migration so the scan runs in its own transaction under a
-- SHARE UPDATE EXCLUSIVE lock (no reads or writes blocked), not under the
-- ACCESS EXCLUSIVE lock 00194's ADD CONSTRAINT holds until it commits.
-- Each new constraint is a strict superset of the old one, so this cannot fail
-- on existing rows.

ALTER TABLE public.expenses VALIDATE CONSTRAINT expenses_amount_check;
ALTER TABLE public.motorcycles VALIDATE CONSTRAINT motorcycles_purchase_price_check;
ALTER TABLE public.users VALIDATE CONSTRAINT chk_users_currency;
ALTER TABLE public.expenses VALIDATE CONSTRAINT chk_expenses_currency;
ALTER TABLE public.maintenance_tasks VALIDATE CONSTRAINT chk_maintenance_tasks_currency;
