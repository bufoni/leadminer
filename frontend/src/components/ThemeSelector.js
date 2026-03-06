import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/80 dark:hover:bg-white/5 transition-colors"
        title={theme === 'dark' ? 'Modo escuro' : 'Modo claro'}
        aria-expanded={open}
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 py-1 w-36 rounded-lg bg-white border border-gray-200 shadow-xl z-50 dark:bg-gray-900 dark:border-white/10">
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              theme === 'light' ? 'bg-violet-100 text-violet-700 dark:bg-violet-600/20 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <Sun className="h-4 w-4" />
            Modo claro
          </button>
          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              theme === 'dark' ? 'bg-violet-100 text-violet-700 dark:bg-violet-600/20 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <Moon className="h-4 w-4" />
            Modo escuro
          </button>
        </div>
      )}
    </div>
  );
}
