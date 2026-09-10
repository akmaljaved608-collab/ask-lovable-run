ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_goal_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS weekly_goal_minutes integer NOT NULL DEFAULT 420;