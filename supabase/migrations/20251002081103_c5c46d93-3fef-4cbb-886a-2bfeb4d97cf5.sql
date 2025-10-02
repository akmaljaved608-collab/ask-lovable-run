-- Add tutorial_completed column to profiles table
ALTER TABLE public.profiles
ADD COLUMN tutorial_completed boolean DEFAULT false;