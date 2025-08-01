-- Fix duplicate records in choice_filling_usage table
-- This script will clean up duplicates and add a unique constraint

-- Step 1: Check table structure first
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'choice_filling_usage' 
ORDER BY ordinal_position;

-- Step 2: Check for duplicates
SELECT user_id, COUNT(*) as record_count 
FROM choice_filling_usage 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Step 3: Delete duplicate records, keeping only the first one for each user
-- Using a more robust approach that works with different primary key types
WITH ranked_records AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
  FROM choice_filling_usage
)
DELETE FROM choice_filling_usage 
WHERE id IN (
  SELECT id 
  FROM ranked_records 
  WHERE rn > 1
);

-- Step 4: Add unique constraint on user_id to prevent future duplicates
-- Note: This will fail if there are still duplicates, so run step 3 first
ALTER TABLE choice_filling_usage 
ADD CONSTRAINT choice_filling_usage_user_id_unique UNIQUE (user_id);

-- Step 5: Verify the fix
SELECT user_id, COUNT(*) as record_count 
FROM choice_filling_usage 
GROUP BY user_id 
HAVING COUNT(*) > 1; 