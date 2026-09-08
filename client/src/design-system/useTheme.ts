import { useEffect, useState } from "react";
import type { Theme } from "./palette";

const THEME_KEY = "minigit2:theme";

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "dark" || stored === "light" ? stored : "light";
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return [theme, setTheme];
}
