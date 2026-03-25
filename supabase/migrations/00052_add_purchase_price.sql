-- Add purchase price to motorcycles
-- Note: purchase_date already exists from migration 00005 but was never exposed
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2)
  CHECK (purchase_price IS NULL OR (purchase_price >= 0 AND purchase_price <= 999999.99));

COMMENT ON COLUMN public.motorcycles.purchase_price IS 'Price paid for the motorcycle (user-entered, in user currency)';
