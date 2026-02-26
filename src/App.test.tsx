import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from './App';

const SETTINGS_KEY = 'agent-replay-display-settings';

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: makeStorage(), writable: true });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App', () => {
  describe('theme toggle', () => {
    it('starts in dark mode by default', () => {
      render(<App />);
      const toggle = screen.getByLabelText('Theme');
      expect(toggle).toBeChecked();
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    it('switches to light mode when toggle is clicked', () => {
      render(<App />);
      fireEvent.click(screen.getByLabelText('Theme'));
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('applies light palette mode to the MUI theme', () => {
      render(<App />);
      fireEvent.click(screen.getByLabelText('Theme'));
      const body = document.body;
      const bgColor = window.getComputedStyle(body).backgroundColor;
      expect(bgColor).not.toBe('rgb(18, 18, 18)');
    });

    it('persists theme choice to localStorage', () => {
      render(<App />);
      fireEvent.click(screen.getByLabelText('Theme'));
      const stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}');
      expect(stored.themeMode).toBe('light');
    });

    it('loads persisted theme from localStorage', () => {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ themeMode: 'light' }),
      );
      render(<App />);
      expect(screen.getByText('Light')).toBeInTheDocument();
    });
  });
});
