import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DisplayControls from './DisplayControls';
import type { DisplaySettings } from '../types/chat';

const theme = createTheme({ palette: { mode: 'dark' } });

function makeSettings(overrides: Partial<DisplaySettings> = {}): DisplaySettings {
  return {
    showThinking: true,
    showToolCalls: true,
    showToolResults: true,
    playbackSpeed: 1,
    themeMode: 'dark',
    ...overrides,
  };
}

afterEach(cleanup);

function renderControls(
  settings: DisplaySettings = makeSettings(),
  onChange: (s: DisplaySettings) => void = () => {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <DisplayControls settings={settings} onChange={onChange} />
    </ThemeProvider>,
  );
}

describe('DisplayControls', () => {
  describe('theme toggle', () => {
    it('renders a theme toggle switch', () => {
      renderControls();
      expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
    });

    it('shows dark mode label when themeMode is dark', () => {
      renderControls(makeSettings({ themeMode: 'dark' }));
      expect(screen.getByText(/dark/i)).toBeInTheDocument();
    });

    it('shows light mode label when themeMode is light', () => {
      renderControls(makeSettings({ themeMode: 'light' }));
      expect(screen.getByText(/light/i)).toBeInTheDocument();
    });

    it('calls onChange with themeMode light when toggled from dark', () => {
      const onChange = vi.fn();
      renderControls(makeSettings({ themeMode: 'dark' }), onChange);

      fireEvent.click(screen.getByLabelText(/theme/i));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ themeMode: 'light' }),
      );
    });

    it('calls onChange with themeMode dark when toggled from light', () => {
      const onChange = vi.fn();
      renderControls(makeSettings({ themeMode: 'light' }), onChange);

      fireEvent.click(screen.getByLabelText(/theme/i));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ themeMode: 'dark' }),
      );
    });
  });
});
