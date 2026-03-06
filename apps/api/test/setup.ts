import 'reflect-metadata';
import { vi } from 'vitest';

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
vi.stubEnv('SUPABASE_JWT_SECRET', 'test-jwt-secret-that-is-at-least-32-chars-long!!');
vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
