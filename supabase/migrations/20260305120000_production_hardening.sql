-- ============================================
-- HabitOS: Supabase Security & Integrity Setup
-- Run this in the Supabase SQL Editor
-- ============================================

-- ============================================
-- Fix #4: Row Level Security (RLS) Policies
-- ============================================

-- PROFILES TABLE
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- DAILY_HABITS TABLE
ALTER TABLE daily_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily habits"
  ON daily_habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily habits"
  ON daily_habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily habits"
  ON daily_habits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily habits"
  ON daily_habits FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- Fix #3: New Tables for Workout & Nutrition
-- ============================================

-- WORKOUTS TABLE
CREATE TABLE IF NOT EXISTS workouts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  exercises JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts"
  ON workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
  ON workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
  ON workouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
  ON workouts FOR DELETE
  USING (auth.uid() = user_id);

-- NUTRITION_LOGS TABLE
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meals JSONB DEFAULT '[]'::jsonb,
  water_glasses INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition logs"
  ON nutrition_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition logs"
  ON nutrition_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition logs"
  ON nutrition_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition logs"
  ON nutrition_logs FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- Fix #5: XP Validation Trigger
-- Prevents XP from being set to unreasonable values
-- Max theoretical XP: ~200 XP/day * 365 * 100 years = ~7.3M
-- We cap at 500,000 (about 1,370 years of perfect play)
-- ============================================

CREATE OR REPLACE FUNCTION validate_xp_update()
RETURNS TRIGGER AS $$
DECLARE
  old_xp INTEGER;
  new_xp INTEGER;
  max_daily_change INTEGER := 500; -- Max reasonable XP change per update
BEGIN
  -- Extract XP values
  old_xp := COALESCE((OLD.xp_data->>'totalXP')::INTEGER, 0);
  new_xp := COALESCE((NEW.xp_data->>'totalXP')::INTEGER, 0);

  -- Clamp XP to valid range
  IF new_xp < 0 THEN
    new_xp := 0;
    NEW.xp_data := jsonb_set(NEW.xp_data, '{totalXP}', to_jsonb(new_xp));
  END IF;

  IF new_xp > 500000 THEN
    new_xp := 500000;
    NEW.xp_data := jsonb_set(NEW.xp_data, '{totalXP}', to_jsonb(new_xp));
  END IF;

  -- Flag suspicious jumps (>500 XP in a single update) but still allow them
  -- This logs them for admin review without blocking the user
  IF ABS(new_xp - old_xp) > max_daily_change THEN
    RAISE LOG 'Suspicious XP change for user %: % -> % (delta: %)',
      NEW.id, old_xp, new_xp, (new_xp - old_xp);
  END IF;

  -- Sync total_xp column with xp_data JSONB for consistency
  NEW.total_xp := new_xp;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_xp ON profiles;
CREATE TRIGGER trg_validate_xp
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.xp_data IS DISTINCT FROM OLD.xp_data)
  EXECUTE FUNCTION validate_xp_update();


-- ============================================
-- Enable Realtime for new tables
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE workouts;
ALTER PUBLICATION supabase_realtime ADD TABLE nutrition_logs;
