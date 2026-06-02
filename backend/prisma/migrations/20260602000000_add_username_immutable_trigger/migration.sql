-- 建立函數：禁止修改 username
CREATE OR REPLACE FUNCTION prevent_username_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 檢查是否試圖修改 username
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    RAISE EXCEPTION '使用者名不可修改';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立 trigger：在每次 UPDATE users 時執行上述函數
DROP TRIGGER IF EXISTS prevent_username_update_trigger ON "User" CASCADE;
CREATE TRIGGER prevent_username_update_trigger
BEFORE UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION prevent_username_update();
