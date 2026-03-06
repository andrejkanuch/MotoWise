# P1: Profile screen has incorrect supabase import path

## Location
`apps/mobile/src/app/(tabs)/(profile)/index.tsx` line 6

## Problem
```ts
import { supabase } from '../../lib/supabase';
```

From `src/app/(tabs)/(profile)/index.tsx`, `../..` resolves to `src/app/`, making the full path `src/app/lib/supabase`. The actual supabase module is at `src/lib/supabase.ts`.

The correct import should be `../../../lib/supabase` (three levels up: `(profile)` -> `(tabs)` -> `app` -> `src`).

This will cause a build/runtime error when the profile screen is loaded. The sign-out button will not work.

## Fix
Change the import to:
```ts
import { supabase } from '../../../lib/supabase';
```
