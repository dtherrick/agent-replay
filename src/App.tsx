import { useState, useCallback, type DragEvent } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  CssBaseline,
  Box,
  Drawer,
  Divider,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import { Menu as MenuIcon, ChevronLeft as CloseIcon } from '@mui/icons-material';
import ChatContainer from './components/ChatContainer';
import ConversationBrowser from './components/ConversationBrowser';
import DisplayControls from './components/DisplayControls';
import { parseConversationFile } from './utils/parseConversationFile';
import type { UnifiedMessage, ConversationInfo, DisplaySettings } from './types/chat';

const DRAWER_WIDTH = 320;

const theme = createTheme({
  shape: { borderRadius: 8 },
  palette: {
    mode: 'dark',
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const SETTINGS_KEY = 'agent-replay-display-settings';

const defaultDisplaySettings: DisplaySettings = {
  showThinking: true,
  showToolCalls: true,
  showToolResults: true,
  playbackSpeed: 1,
};

function loadDisplaySettings(): DisplaySettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultDisplaySettings, ...parsed };
    }
  } catch {
    // Corrupted or unavailable localStorage
  }
  return defaultDisplaySettings;
}

function saveDisplaySettings(settings: DisplaySettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable
  }
}

function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [conversation, setConversation] = useState<UnifiedMessage[] | null>(null);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(loadDisplaySettings);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.json')) {
      setLoadError('Please drop a .json conversation file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const messages = parseConversationFile(reader.result as string);
        if (messages.length === 0) {
          setLoadError('No messages found in the dropped file');
          return;
        }
        const name = file.name.replace('.json', '').replace(/[-_]/g, ' ');
        setConversationInfo({ id: `dropped-${Date.now()}`, title: name, sourceId: 'local-file' });
        setConversation(messages);
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to parse dropped file');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSelectConversation = useCallback(async (info: ConversationInfo) => {
    setConversationInfo(info);
    setConversation(null);
    setLoading(true);
    setLoadError(null);

    try {
      const params = info.projectId ? `?projectId=${info.projectId}` : '';
      const url = `/api/sources/${info.sourceId}/conversations/${encodeURIComponent(info.id)}${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const messages: UnifiedMessage[] = await response.json();
      setConversation(messages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load conversation');
      setConversation([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        {/* Sidebar drawer */}
        <Drawer
          variant="persistent"
          anchor="left"
          open={drawerOpen}
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0.5 }}>
            <Tooltip title="Close sidebar">
              <IconButton onClick={() => setDrawerOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <ConversationBrowser
            onSelectConversation={handleSelectConversation}
            selectedConversationId={conversationInfo?.id}
          />

          <Divider />

          <DisplayControls
            settings={displaySettings}
            onChange={(s) => { setDisplaySettings(s); saveDisplaySettings(s); }}
          />
        </Drawer>

        {/* Main content */}
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            flex: 1,
            transition: 'margin 0.2s',
            marginLeft: drawerOpen ? 0 : `-${DRAWER_WIDTH}px`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {isDragging && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(25, 118, 210, 0.12)',
                border: '3px dashed',
                borderColor: 'primary.main',
                borderRadius: 2,
                m: 2,
                pointerEvents: 'none',
              }}
            >
              <Box sx={{ color: 'primary.main', fontSize: '1.2rem', fontWeight: 500 }}>
                Drop a .json conversation file to play it back
              </Box>
            </Box>
          )}
          {/* Toggle drawer button when closed */}
          {!drawerOpen && (
            <Box sx={{ position: 'fixed', top: 8, left: 8, zIndex: 1200 }}>
              <Tooltip title="Open sidebar">
                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  sx={{ bgcolor: 'grey.800', '&:hover': { bgcolor: 'grey.700' } }}
                >
                  <MenuIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          <ChatContainer
            conversation={loading ? null : conversation}
            conversationInfo={conversationInfo}
            displaySettings={displaySettings}
          />
        </Box>

        <Snackbar
          open={!!loadError}
          autoHideDuration={6000}
          onClose={() => setLoadError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setLoadError(null)} variant="filled">
            {loadError}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
