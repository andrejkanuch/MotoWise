-- MOT-278: dedup log for server-sent maintenance-due push notifications. One row
-- per (task, due_date) — the UNIQUE constraint makes the send run idempotent so a
-- re-run (or a concurrent cron tick) never double-pushes for the same task/day.
-- System-only table: written by the service-role send job, never by end users.

CREATE TABLE public.maintenance_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, due_date)
);

ALTER TABLE public.maintenance_push_log ENABLE ROW LEVEL SECURITY;

-- No policies + revoked grants: anon/authenticated have no access at all; the
-- service role used by the send job bypasses RLS. (Matches the social queue pattern.)
REVOKE ALL ON public.maintenance_push_log FROM anon, authenticated;

CREATE INDEX idx_maintenance_push_log_user ON public.maintenance_push_log (user_id);

COMMENT ON TABLE public.maintenance_push_log IS 'Dedup log for server-sent maintenance-due push (MOT-278). Service-role only; UNIQUE(task_id, due_date) guarantees one push per task per day.';
