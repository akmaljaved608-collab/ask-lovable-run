-- Add date_taken column to test_series_scores for subject-specific dates
ALTER TABLE public.test_series_scores 
ADD COLUMN date_taken DATE;