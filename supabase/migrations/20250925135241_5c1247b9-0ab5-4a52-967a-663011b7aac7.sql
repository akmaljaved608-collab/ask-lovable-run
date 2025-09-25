-- Add theme preferences and customization options to profiles table
ALTER TABLE public.profiles 
ADD COLUMN theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
ADD COLUMN color_scheme TEXT DEFAULT 'default' CHECK (color_scheme IN ('default', 'blue', 'green', 'purple')),
ADD COLUMN bio TEXT,
ADD COLUMN location TEXT;