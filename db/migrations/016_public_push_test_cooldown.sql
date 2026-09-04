ALTER TABLE public_push_subscriptions
  ADD COLUMN IF NOT EXISTS last_test_notification_at TIMESTAMPTZ;
