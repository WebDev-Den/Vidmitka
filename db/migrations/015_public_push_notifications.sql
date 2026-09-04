CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS public_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_hash TEXT NOT NULL UNIQUE
    CHECK (endpoint_hash ~ '^[a-f0-9]{64}$'),
  endpoint_url TEXT NOT NULL
    CHECK (octet_length(endpoint_url) BETWEEN 16 AND 4096)
    CHECK (endpoint_url ~ '^https://'),
  p256dh_key TEXT NOT NULL
    CHECK (char_length(p256dh_key) BETWEEN 16 AND 512),
  auth_secret TEXT NOT NULL
    CHECK (char_length(auth_secret) BETWEEN 16 AND 256),
  expiration_time TIMESTAMPTZ,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  daily_digest_time TIME(0),
  class_reminder_minutes SMALLINT,
  config_version INTEGER NOT NULL DEFAULT 1 CHECK (config_version > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT CHECK (revoked_reason IS NULL OR revoked_reason IN (
    'user', 'permission', 'provider_gone', 'invalid_subscription'
  )),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (daily_digest_time IS NULL OR daily_digest_time BETWEEN TIME '07:00' AND TIME '20:00'),
  CHECK (class_reminder_minutes IS NULL OR class_reminder_minutes BETWEEN 1 AND 60),
  CHECK (daily_digest_time IS NOT NULL OR class_reminder_minutes IS NOT NULL),
  CHECK (
    (is_active AND revoked_at IS NULL AND revoked_reason IS NULL)
    OR (NOT is_active AND revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)
  )
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS public_push_subscriptions_active_teacher_idx
  ON public_push_subscriptions (teacher_id)
  WHERE is_active;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS public_push_subscriptions_digest_due_idx
  ON public_push_subscriptions (daily_digest_time, teacher_id)
  WHERE is_active AND daily_digest_time IS NOT NULL;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS public_push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public_push_subscriptions(id) ON DELETE CASCADE,
  subscription_version INTEGER NOT NULL CHECK (subscription_version > 0),
  notification_kind TEXT NOT NULL CHECK (notification_kind IN ('daily_digest', 'class_reminder')),
  delivery_key TEXT NOT NULL CHECK (delivery_key ~ '^[a-f0-9]{64}$'),
  scheduled_for TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::TEXT) <= 16384),
  status TEXT NOT NULL DEFAULT 'leased' CHECK (status IN ('leased', 'sent', 'failed', 'invalid')),
  attempt_count SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 5),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  provider_status SMALLINT CHECK (provider_status IS NULL OR provider_status BETWEEN 100 AND 599),
  last_error_code TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 120),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, delivery_key),
  CHECK (status <> 'leased' OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS public_push_deliveries_lease_idx
  ON public_push_deliveries (lease_expires_at)
  WHERE status = 'leased';

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS public_push_deliveries_retention_idx
  ON public_push_deliveries (created_at)
  WHERE status IN ('sent', 'failed', 'invalid');
