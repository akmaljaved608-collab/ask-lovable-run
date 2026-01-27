-- Create test_series table for storing test metadata
CREATE TABLE public.test_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  test_date DATE,
  aggregate_pass_mark INTEGER NOT NULL,
  aggregate_max_marks INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create test_series_scores table for individual subject scores
CREATE TABLE public.test_series_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_series_id UUID NOT NULL REFERENCES public.test_series(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  pass_mark INTEGER NOT NULL,
  max_marks INTEGER NOT NULL,
  score_obtained INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(test_series_id, subject_id)
);

-- Enable RLS on both tables
ALTER TABLE public.test_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_series_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies for test_series (through course ownership)
CREATE POLICY "Users can view test series of their courses"
ON public.test_series FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.courses
  WHERE courses.id = test_series.course_id AND courses.user_id = auth.uid()
));

CREATE POLICY "Users can create test series for their courses"
ON public.test_series FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.courses
  WHERE courses.id = test_series.course_id AND courses.user_id = auth.uid()
));

CREATE POLICY "Users can update test series of their courses"
ON public.test_series FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.courses
  WHERE courses.id = test_series.course_id AND courses.user_id = auth.uid()
));

CREATE POLICY "Users can delete test series of their courses"
ON public.test_series FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.courses
  WHERE courses.id = test_series.course_id AND courses.user_id = auth.uid()
));

-- RLS policies for test_series_scores (through test_series -> course ownership)
CREATE POLICY "Users can view test series scores of their courses"
ON public.test_series_scores FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.test_series
  JOIN public.courses ON courses.id = test_series.course_id
  WHERE test_series.id = test_series_scores.test_series_id AND courses.user_id = auth.uid()
));

CREATE POLICY "Users can create test series scores for their courses"
ON public.test_series_scores FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.test_series
  JOIN public.courses ON courses.id = test_series.course_id
  WHERE test_series.id = test_series_scores.test_series_id AND courses.user_id = auth.uid()
));

CREATE POLICY "Users can update test series scores of their courses"
ON public.test_series_scores FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.test_series
  JOIN public.courses ON courses.id = test_series.course_id
  WHERE test_series.id = test_series_scores.test_series_id AND courses.user_id = auth.uid()
));

CREATE POLICY "Users can delete test series scores of their courses"
ON public.test_series_scores FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.test_series
  JOIN public.courses ON courses.id = test_series.course_id
  WHERE test_series.id = test_series_scores.test_series_id AND courses.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_test_series_updated_at
BEFORE UPDATE ON public.test_series
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_test_series_scores_updated_at
BEFORE UPDATE ON public.test_series_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();