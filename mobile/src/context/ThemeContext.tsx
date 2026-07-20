import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

type ThemeName = 'light' | 'dark';

const colors = {
  light: {
    background: '#ffffff',
    text: '#2d3748',
    primary: '#667eea',
    secondary: '#764ba2',
    border: '#e2e8f0',
    card: '#ffffff',
    shadow: '#000000',
    error: '#fc8181',
    success: '#48bb78',
    warning: '#f6ad55',
  },
  dark: {
    background: '#1a202c',
    text: '#e2e8f0',
    primary: '#667eea',
    secondary: '#764ba2',
    border: '#2d3748',
    card: '#2d3748',
    shadow: '#000000',
    error: '#fc8181',
    success: '#48bb78',
    warning: '#f6ad55',
  },
};

type ThemeContextType = {
  theme: ThemeName;
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof colors.light;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeName>(systemTheme === 'dark' ? 'dark' : 'light');

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const isDark = theme === 'dark';
  const currentColors = colors[theme];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        colors: currentColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
