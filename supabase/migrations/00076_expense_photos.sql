-- Migration: 00076_expense_photos
-- MOT-143: Receipt Photo Attachments on Expenses
-- Mirrors maintenance_task_photos from 00022. Reuses the existing
-- 'maintenance-photos' storage bucket with path prefix {userId}/expenses/{expenseId}/...
-- so no new bucket/RLS is required.

CREATE TABLE public.expense_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  storage_path TEXT NOT NULL,
  file_size_bytes INT,
  mime_type TEXT NOT NULL DEFAULT 'image/webp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_photos_expense ON public.expense_photos (expense_id);
CREATE INDEX idx_expense_photos_user ON public.expense_photos (user_id);

ALTER TABLE public.expense_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own expense photos" ON public.expense_photos
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.expense_photos IS 'Receipt photo attachments on expenses (MOT-143). Max 3 per expense enforced at application layer.';
