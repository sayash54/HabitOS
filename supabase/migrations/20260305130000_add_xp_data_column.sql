-- ============================================
-- HabitOS: Add xp_data column and XP validation
-- Fixes the failed portion of the previous migration
-- ============================================

-- Add the xp_data JSONB column to profiles (the app already writes to it)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp_data JSONB DEFAULT '{}'::jsonb;

-- Backfill xp_data from total_xp for existing rows
UPDATE profiles
SET xp_data = jsonb_build_object('totalXP', COALESCE(total_xp, 0))
WHERE xp_data IS NULL OR xp_data = '{}'::jsonb;

-- ============================================
-- XP Validation Trigger
-- Prevents XP from being set to unreasonable values
-- ============================================

CREATE OR REPLACE FUNCTION validate_xp_update()
RETURNS TRIGGER AS $$
DECLARE
  old_xp INTEGER;
  new_xp INTEGER;
  max_daily_change INTEGER := 500;
BEGIN
  old_xp := COALESCE((OLD.xp_data->>'totalXP')::INTEGER, 0);
  new_xp := COALESCE((NEW.xp_data->>'totalXP')::INTEGER, 0);

  IF new_xp < 0 THEN
    new_xp := 0;
    NEW.xp_data := jsonb_set(NEW.xp_data, '{totalXP}', to_jsonb(new_xp));
  END IF;

  IF new_xp > 500000 THEN
    new_xp := 500000;
    NEW.xp_data := jsonb_set(NEW.xp_data, '{totalXP}', to_jsonb(new_xp));
  END IF;

  IF ABS(new_xp - old_xp) > max_daily_change THEN
    RAISE LOG 'Suspicious XP change for user %: % -> % (delta: %)',
      NEW.id, old_xp, new_xp, (new_xp - old_xp);
  END IF;

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
