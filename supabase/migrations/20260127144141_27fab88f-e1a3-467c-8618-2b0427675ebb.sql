-- Add start_date and end_date columns, remove test_date
ALTER TABLE public.test_series 
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE;

-- Migrate existing test_date to start_date
UPDATE public.test_series SET start_date = test_date WHERE test_date IS NOT NULL;

-- Drop the old test_date column
ALTER TABLE public.test_series DROP COLUMN test_date;