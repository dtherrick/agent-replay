import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SubagentReplay from './SubagentReplay';
import ChatMessage from './ChatMessage';
import type { SubagentConversation, PlaybackMessage, DisplaySettings } from '../types/chat';

const theme = createTheme({ palette: { mode: 'dark' } });

const testSubagent: SubagentConversation = {
  id: 'abc12345-dead-beef',
  messages: [
    { role: 'user', content: 'Build something' },
    { role: 'assistant', content: 'Done building.' },
  ],
};

afterEach(cleanup);

function renderSubagent(subagent: SubagentConversation = testSubagent) {
  return render(
    <ThemeProvider theme={theme}>
      <SubagentReplay subagent={subagent} />
    </ThemeProvider>,
  );
}

describe('SubagentReplay', () => {
  it('renders collapsed by default with subagent label', () => {
    renderSubagent();
    expect(screen.getByText(/subagent/i)).toBeInTheDocument();
    expect(screen.getByText(/2 messages/i)).toBeInTheDocument();
    expect(screen.queryByText('Build something')).not.toBeInTheDocument();
  });

  it('expands to show nested messages when clicked', () => {
    renderSubagent();
    fireEvent.click(screen.getByText(/subagent/i));
    expect(screen.getByText('Build something')).toBeInTheDocument();
    expect(screen.getByText('Done building.')).toBeInTheDocument();
  });

  it('shows truncated subagent ID', () => {
    renderSubagent();
    expect(screen.getByText(/abc12345/)).toBeInTheDocument();
  });
});

describe('ChatMessage subagent integration', () => {
  it('renders SubagentReplay for subagent role messages', () => {
    const message: PlaybackMessage = {
      role: 'subagent',
      content: 'Subagent: abc12345',
      subagent: testSubagent,
    };
    render(
      <ThemeProvider theme={theme}>
        <ChatMessage message={message} index={0} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/subagent/i)).toBeInTheDocument();
    expect(screen.getByText(/2 messages/i)).toBeInTheDocument();
  });
});

describe('Playback subagent filtering', () => {
  it('includes subagent messages when showSubagents is true', async () => {
    const { default: ChatContainer } = await import('./ChatContainer');

    const settings: DisplaySettings = {
      showThinking: true,
      showToolCalls: true,
      showToolResults: true,
      showSubagents: true,
      playbackSpeed: 1,
      themeMode: 'dark',
    };

    render(
      <ThemeProvider theme={theme}>
        <ChatContainer
          conversation={[
            { role: 'user', content: 'Hello' },
            { role: 'subagent', content: 'Subagent: abc', subagent: testSubagent },
            { role: 'assistant', content: 'Done' },
          ]}
          conversationInfo={{ id: 'test', title: 'Test', sourceId: 'test' }}
          displaySettings={settings}
        />
      </ThemeProvider>,
    );

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText(/subagent/i)).toBeInTheDocument();
  });

  it('excludes subagent messages when showSubagents is false', async () => {
    const { default: ChatContainer } = await import('./ChatContainer');

    const settings: DisplaySettings = {
      showThinking: true,
      showToolCalls: true,
      showToolResults: true,
      showSubagents: false,
      playbackSpeed: 1,
      themeMode: 'dark',
    };

    render(
      <ThemeProvider theme={theme}>
        <ChatContainer
          conversation={[
            { role: 'user', content: 'Hello' },
            { role: 'subagent', content: 'Subagent: abc', subagent: testSubagent },
            { role: 'assistant', content: 'Done' },
          ]}
          conversationInfo={{ id: 'test', title: 'Test', sourceId: 'test' }}
          displaySettings={settings}
        />
      </ThemeProvider>,
    );

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByText(/2 messages/i)).not.toBeInTheDocument();
  });
});
