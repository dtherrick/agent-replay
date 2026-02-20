import React from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Slider,
  Divider,
} from '@mui/material';
import {
  Psychology as ThinkingIcon,
  Build as ToolIcon,
  Output as ResultIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import type { DisplaySettings } from '../types/chat';

interface DisplayControlsProps {
  settings: DisplaySettings;
  onChange: (settings: DisplaySettings) => void;
}

const speedMarks = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
];

const DisplayControls: React.FC<DisplayControlsProps> = ({ settings, onChange }) => {
  const update = (patch: Partial<DisplaySettings>) => {
    onChange({ ...settings, ...patch });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Display Options
      </Typography>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={settings.showThinking}
            onChange={(_, checked) => update({ showThinking: checked })}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ThinkingIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2">Thinking</Typography>
          </Box>
        }
        sx={{ mb: 0.5, ml: 0 }}
      />

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={settings.showToolCalls}
            onChange={(_, checked) => update({ showToolCalls: checked })}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ToolIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2">Tool Calls</Typography>
          </Box>
        }
        sx={{ mb: 0.5, ml: 0 }}
      />

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={settings.showToolResults}
            onChange={(_, checked) => update({ showToolResults: checked })}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ResultIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2">Tool Results</Typography>
          </Box>
        }
        sx={{ mb: 1, ml: 0 }}
      />

      <Divider sx={{ my: 1 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <SpeedIcon sx={{ fontSize: 16 }} />
        <Typography variant="body2">
          Speed: {settings.playbackSpeed}x
        </Typography>
      </Box>
      <Slider
        size="small"
        value={settings.playbackSpeed}
        min={0.25}
        max={4}
        step={0.25}
        marks={speedMarks}
        valueLabelDisplay="auto"
        valueLabelFormat={v => `${v}x`}
        onChange={(_, value) => update({ playbackSpeed: value as number })}
        sx={{ mx: 1 }}
      />
    </Box>
  );
};

export default DisplayControls;
