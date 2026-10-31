import { createContext, useContext, useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { isThemePackId, type ThemePackId } from "@/lib/themePacks";

type Theme = "light" | "dark" | "system";
type ColorScheme = "default" | "blue" | "green" | "purple";

const THEME_PACK_STORAGE_KEY = "course-tracker-theme-pack";

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  themePack: ThemePackId;
  setTheme: (theme: Theme) => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setThemePack: (pack: ThemePackId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStoredThemePack(): ThemePackId {
  try {
    const stored = window.localStorage.getItem(THEME_PACK_STORAGE_KEY);
    if (isThemePackId(stored)) return stored;
  } catch {
    // Storage unavailable — fall back to the default pack.
  }
  return "classic";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>("default");
  const [themePack, setThemePackState] = useState<ThemePackId>(readStoredThemePack);
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Apply color scheme to document
    document.documentElement.setAttribute("data-color-scheme", colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-pack", themePack);
  }, [themePack]);

  const setThemePack = (pack: ThemePackId) => {
    setThemePackState(pack);
    try {
      window.localStorage.setItem(THEME_PACK_STORAGE_KEY, pack);
    } catch {
      // Storage unavailable — the pack still applies for this session.
    }
  };

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="course-tracker-theme"
    >
      <ThemeContext.Provider value={{ theme, colorScheme, themePack, setTheme, setColorScheme, setThemePack }}>
        {children}
      </ThemeContext.Provider>
    </NextThemesProvider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
