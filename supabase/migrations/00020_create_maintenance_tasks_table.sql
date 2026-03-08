-- Maintenance Tasks table for MOT-18
CREATE TABLE public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  target_mileage INT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  notes TEXT,
  parts_needed TEXT[],
  completed_at TIMESTAMPTZ,
  completed_mileage INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own maintenance tasks" ON public.maintenance_tasks
  FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Admins read all tasks" ON public.maintenance_tasks
  FOR SELECT USING (public.is_admin());

CREATE INDEX idx_maintenance_tasks_user_id ON public.maintenance_tasks (user_id);
CREATE INDEX idx_maintenance_tasks_motorcycle_id ON public.maintenance_tasks (motorcycle_id);
CREATE INDEX idx_maintenance_tasks_status ON public.maintenance_tasks (status);

-- Auto-update updated_at trigger
CREATE TRIGGER set_maintenance_tasks_updated_at
  BEFORE UPDATE ON public.maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
