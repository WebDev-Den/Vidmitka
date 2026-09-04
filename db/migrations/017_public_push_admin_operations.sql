CREATE TABLE IF NOT EXISTS public_push_scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('completed', 'ignored', 'failed')),
  scanned BOOLEAN NOT NULL,
  subscriptions_count INTEGER NOT NULL DEFAULT 0 CHECK (subscriptions_count >= 0),
  claimed_count INTEGER NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  invalid_count INTEGER NOT NULL DEFAULT 0 CHECK (invalid_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  schedule_error_count INTEGER NOT NULL DEFAULT 0 CHECK (schedule_error_count >= 0),
  failure_code TEXT CHECK (failure_code IS NULL OR char_length(failure_code) <= 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS public_push_scan_runs_recent_idx
  ON public_push_scan_runs (created_at DESC);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS public_push_manual_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public_push_subscriptions(id) ON DELETE CASCADE,
  notification_kind TEXT NOT NULL CHECK (notification_kind IN ('daily_digest', 'class_reminder')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME(0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'invalid')),
  provider_status SMALLINT CHECK (provider_status IS NULL OR provider_status BETWEEN 100 AND 599),
  failure_code TEXT CHECK (failure_code IS NULL OR char_length(failure_code) <= 80),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS public_push_manual_deliveries_recent_idx
  ON public_push_manual_deliveries (created_at DESC);
