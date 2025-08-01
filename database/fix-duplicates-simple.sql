-- Simple fix for duplicate records in choice_filling_usage table
-- This approach doesn't rely on the id column

-- Step 1: Check for duplicates
SELECT user_id, COUNT(*) as record_count 
FROM choice_filling_usage 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Step 2: Create a temporary table with unique records
CREATE TEMP TABLE temp_unique_usage AS
SELECT DISTINCT ON (user_id) *
FROM choice_filling_usage
ORDER BY user_id, created_at ASC;

-- Step 3: Delete all records from the original table
DELETE FROM choice_filling_usage;

-- Step 4: Insert back only the unique records
INSERT INTO choice_filling_usage 
SELECT * FROM temp_unique_usage;

-- Step 5: Drop the temporary table
DROP TABLE temp_unique_usage;

-- Step 6: Add unique constraint to prevent future duplicates
ALTER TABLE choice_filling_usage 
ADD CONSTRAINT choice_filling_usage_user_id_unique UNIQUE (user_id);

-- Step 7: Verify the fix
SELECT user_id, COUNT(*) as record_count 
FROM choice_filling_usage 
GROUP BY user_id 
HAVING COUNT(*) > 1; 