-- Create profiles table for storing additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create courses table for storing user courses
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Create policies for courses
CREATE POLICY "Users can view their own courses" 
ON public.courses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own courses" 
ON public.courses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses" 
ON public.courses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses" 
ON public.courses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Create policies for subjects (through course ownership)
CREATE POLICY "Users can view subjects of their courses" 
ON public.subjects 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = subjects.course_id 
    AND courses.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create subjects for their courses" 
ON public.subjects 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = subjects.course_id 
    AND courses.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update subjects of their courses" 
ON public.subjects 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = subjects.course_id 
    AND courses.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete subjects of their courses" 
ON public.subjects 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = subjects.course_id 
    AND courses.user_id = auth.uid()
  )
);

-- Create syllabus items table
CREATE TABLE public.syllabus_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  date_completed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for syllabus items
ALTER TABLE public.syllabus_items ENABLE ROW LEVEL SECURITY;

-- Create policies for syllabus items (through subject/course ownership)
CREATE POLICY "Users can view syllabus items of their courses" 
ON public.syllabus_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.subjects 
    JOIN public.courses ON subjects.course_id = courses.id
    WHERE subjects.id = syllabus_items.subject_id 
    AND courses.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create syllabus items for their courses" 
ON public.syllabus_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subjects 
    JOIN public.courses ON subjects.course_id = courses.id
    WHERE subjects.id = syllabus_items.subject_id 
    AND courses.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update syllabus items of their courses" 
ON public.syllabus_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.subjects 
    JOIN public.courses ON subjects.course_id = courses.id
    WHERE subjects.id = syllabus_items.subject_id 
    AND courses.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete syllabus items of their courses" 
ON public.syllabus_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.subjects 
    JOIN public.courses ON subjects.course_id = courses.id
    WHERE subjects.id = syllabus_items.subject_id 
    AND courses.user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_syllabus_items_updated_at
  BEFORE UPDATE ON public.syllabus_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();