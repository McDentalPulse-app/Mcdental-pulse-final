import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('mc-theme');
    // Default oscuro siempre (estética neón de la app); el toggle sigue
    // permitiendo claro y se respeta la elección guardada del usuario.
    if (savedTheme) return savedTheme;
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mc-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Memoizado: un objeto {theme, toggleTheme} literal en el JSX es nuevo en CADA render de
  // este provider (que está cerca de la raíz, así que re-renderiza seguido). Cualquier pantalla
  // con `theme` en las dependencias de un efecto lo vería "cambiar" siempre — mismo bug que
  // NotificationContext, encontrado ahí primero.
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
