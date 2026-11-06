import { heroui } from '@heroui/react';

// Спокойная рабочая палитра: нейтральный фон, индиго для действий, тёплый акцент для ссылок на книги.
export default heroui({
  layout: {
    radius: { small: '6px', medium: '10px', large: '14px' },
    fontSize: { tiny: '0.75rem', small: '0.8125rem', medium: '0.875rem', large: '1rem' },
  },
  themes: {
    light: {
      colors: {
        background: '#F7F7F8',
        foreground: '#18181B',
        content1: '#FFFFFF',
        primary: { DEFAULT: '#4F46E5', foreground: '#FFFFFF', 50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA' },
        secondary: { DEFAULT: '#B45309', foreground: '#FFFFFF', 50: '#FFFBEB', 100: '#FEF3C7' },
        focus: '#6366F1',
      },
    },
    dark: {
      colors: {
        background: '#0E0E11',
        foreground: '#ECECEE',
        content1: '#17171B',
        content2: '#1F1F24',
        primary: { DEFAULT: '#818CF8', foreground: '#0E0E11', 50: '#1E1B4B', 100: '#312E81', 200: '#3730A3', 500: '#818CF8', 600: '#6366F1', 700: '#A5B4FC' },
        secondary: { DEFAULT: '#F59E0B', foreground: '#0E0E11', 50: '#2A1D05', 100: '#3D2A07' },
        focus: '#818CF8',
      },
    },
  },
});
