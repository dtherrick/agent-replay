import { useState, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  CssBaseline,
  Box,
  Drawer,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Menu as MenuIcon, ChevronLeft as CloseIcon } from '@mui/icons-material';
import ChatContainer from './components/ChatContainer';
import ConversationBrowser from './components/ConversationBrowser';
import DisplayControls from './components/DisplayControls';
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

const defaultDisplaySettings: DisplaySettings = {
  showThinking: true,
  showToolCalls: true,
  showToolResults: true,
  playbackSpeed: 1,
};

function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [conversation, setConversation] = useState<UnifiedMessage[] | null>(null);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(defaultDisplaySettings);
  const [loading, setLoading] = useState(false);

  const handleSelectConversation = useCallback(async (info: ConversationInfo) => {
    setConversationInfo(info);
    setConversation(null);
    setLoading(true);

    try {
      const params = info.projectId ? `?projectId=${info.projectId}` : '';
      const url = `/api/sources/${info.sourceId}/conversations/${encodeURIComponent(info.id)}${params}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const messages: UnifiedMessage[] = await response.json();
      setConversation(messages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
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

          <DisplayControls settings={displaySettings} onChange={setDisplaySettings} />
        </Drawer>

        {/* Main content */}
        <Box
          sx={{
            flex: 1,
            transition: 'margin 0.2s',
            marginLeft: drawerOpen ? 0 : `-${DRAWER_WIDTH}px`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
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
      </Box>
    </ThemeProvider>
  );
}

export default App;
