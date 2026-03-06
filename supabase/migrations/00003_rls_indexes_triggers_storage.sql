-- Migration: RLS Policies, Indexes, Triggers, Storage
-- Secures all tables and adds performance indexes

-- ==========================================
-- HELPER FUNCTION: is_admin
-- ==========================================
CREATE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create public.users row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motorcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES -- USERS
-- ==========================================
CREATE POLICY "Users read own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own data" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all users" ON public.users FOR SELECT USING (public.is_admin());

-- ==========================================
-- RLS POLICIES -- MOTORCYCLES
-- ==========================================
CREATE POLICY "Users own motorcycles" ON public.motorcycles FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- RLS POLICIES -- ARTICLES (public read, admin write)
-- ==========================================
CREATE POLICY "Anyone reads visible articles" ON public.articles FOR SELECT USING (is_hidden = false);
CREATE POLICY "Admins manage articles" ON public.articles FOR ALL USING (public.is_admin());

-- ==========================================
-- RLS POLICIES -- QUIZZES (public read, admin write)
-- ==========================================
CREATE POLICY "Anyone reads quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Admins manage quizzes" ON public.quizzes FOR ALL USING (public.is_admin());

-- ==========================================
-- RLS POLICIES -- QUIZ ATTEMPTS
-- ==========================================
CREATE POLICY "Users own quiz attempts" ON public.quiz_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins read quiz attempts" ON public.quiz_attempts FOR SELECT USING (public.is_admin());

-- ==========================================
-- RLS POLICIES -- DIAGNOSTICS
-- ==========================================
CREATE POLICY "Users own diagnostics" ON public.diagnostics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins read diagnostics" ON public.diagnostics FOR SELECT USING (public.is_admin());

-- ==========================================
-- RLS POLICIES -- DIAGNOSTIC PHOTOS (via diagnostic ownership)
-- ==========================================
CREATE POLICY "Users own diagnostic photos" ON public.diagnostic_photos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.diagnostics WHERE diagnostics.id = diagnostic_photos.diagnostic_id AND diagnostics.user_id = auth.uid())
);
CREATE POLICY "Admins read diagnostic photos" ON public.diagnostic_photos FOR SELECT USING (public.is_admin());

-- ==========================================
-- RLS POLICIES -- CONTENT FLAGS
-- ==========================================
CREATE POLICY "Users create flags" ON public.content_flags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own flags" ON public.content_flags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage flags" ON public.content_flags FOR ALL USING (public.is_admin());

-- ==========================================
-- RLS POLICIES -- LEARNING PROGRESS
-- ==========================================
CREATE POLICY "Users own progress" ON public.learning_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins read progress" ON public.learning_progress FOR SELECT USING (public.is_admin());

-- ==========================================
-- INDEXES (all FK columns + common query patterns)
-- ==========================================
CREATE INDEX idx_motorcycles_user_id ON public.motorcycles (user_id);
CREATE INDEX idx_diagnostics_user_id ON public.diagnostics (user_id);
CREATE INDEX idx_diagnostics_motorcycle_id ON public.diagnostics (motorcycle_id);
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts (user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts (quiz_id);
CREATE INDEX idx_learning_progress_user_id ON public.learning_progress (user_id);
CREATE INDEX idx_learning_progress_article_id ON public.learning_progress (article_id);
CREATE INDEX idx_content_flags_article_id ON public.content_flags (article_id);
CREATE INDEX idx_content_flags_status ON public.content_flags (status);
CREATE INDEX idx_diagnostic_photos_diagnostic_id ON public.diagnostic_photos (diagnostic_id);
CREATE INDEX idx_articles_search ON public.articles USING GIN (search_vector);
CREATE INDEX idx_articles_category ON public.articles (category) WHERE is_hidden = false;
CREATE INDEX idx_articles_difficulty ON public.articles (difficulty) WHERE is_hidden = false;

-- ==========================================
-- STORAGE BUCKET + POLICIES
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('diagnostic-photos', 'diagnostic-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

CREATE POLICY "Users upload own photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'diagnostic-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'diagnostic-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'diagnostic-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins access all photos" ON storage.objects
  FOR ALL USING (bucket_id = 'diagnostic-photos' AND public.is_admin());
