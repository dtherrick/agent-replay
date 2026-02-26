import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ChatContainer from './ChatContainer';
import type { UnifiedMessage, DisplaySettings, ConversationInfo } from '../types/chat';

const theme = createTheme({ palette: { mode: 'dark' } });

const defaultSettings: DisplaySettings = {
  showThinking: true,
  showToolCalls: true,
  showToolResults: true,
  playbackSpeed: 1,
  themeMode: 'dark',
};

const testConversationInfo: ConversationInfo = {
  id: 'test-1',
  title: 'Test Conversation',
  sourceId: 'test',
};

const simpleConversation: UnifiedMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there' },
  { role: 'user', content: 'Thanks' },
];

const conversationWithTools: UnifiedMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there' },
  { role: 'user', content: 'Run a tool' },
  { role: 'tool_call', content: '', toolCall: { name: 'bash', args: { cmd: 'ls' } } },
  { role: 'tool_result', content: 'file.txt', toolResult: { name: 'bash', output: 'file.txt' } },
  { role: 'assistant', content: 'Done' },
];

afterEach(cleanup);

function renderChat(props: Partial<Parameters<typeof ChatContainer>[0]> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ChatContainer
        conversation={props.conversation ?? null}
        conversationInfo={props.conversationInfo ?? null}
        displaySettings={props.displaySettings ?? defaultSettings}
      />
    </ThemeProvider>,
  );
}

function pressKey(key: string) {
  fireEvent.keyDown(document, { key });
}

describe('ChatContainer', () => {
  it('renders empty state when no conversation is loaded', () => {
    renderChat();
    expect(screen.getByText('Agent Replay')).toBeInTheDocument();
  });

  describe('ArrowRight - step forward', () => {
    it('shows the first user message on first press', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('advances through messages on repeated presses', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      expect(screen.getByText('Hello')).toBeInTheDocument();

      pressKey('ArrowRight');
      expect(screen.getByText('Hi there')).toBeInTheDocument();

      pressKey('ArrowRight');
      expect(screen.getByText('Thanks')).toBeInTheDocument();
    });

    it('skips thinking_animation and shows assistant message directly', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      expect(screen.getByText('Hello')).toBeInTheDocument();

      pressKey('ArrowRight');
      expect(screen.getByText('Hi there')).toBeInTheDocument();
      expect(screen.queryByText('Assistant is thinking')).not.toBeInTheDocument();
    });

    it('skips approval and shows tool_call directly', () => {
      renderChat({
        conversation: conversationWithTools,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      pressKey('ArrowRight');
      pressKey('ArrowRight');

      pressKey('ArrowRight');
      expect(screen.getByText('bash')).toBeInTheDocument();
      expect(screen.queryByText(/Tool Call Approval/)).not.toBeInTheDocument();
    });

    it('is a no-op at the end of the conversation', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      pressKey('ArrowRight');
      pressKey('ArrowRight');

      const messagesBefore = screen.getAllByText(/Hello|Hi there|Thanks/).length;
      pressKey('ArrowRight');
      pressKey('ArrowRight');
      const messagesAfter = screen.getAllByText(/Hello|Hi there|Thanks/).length;
      expect(messagesAfter).toBe(messagesBefore);
    });
  });

  describe('ArrowLeft - step backward', () => {
    it('removes the last displayed message', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      pressKey('ArrowRight');
      expect(screen.getByText('Hi there')).toBeInTheDocument();

      pressKey('ArrowLeft');
      expect(screen.queryByText('Hi there')).not.toBeInTheDocument();
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('rewinds by 2 indices for pair entries', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      pressKey('ArrowRight');

      pressKey('ArrowLeft');
      expect(screen.queryByText('Hi there')).not.toBeInTheDocument();

      pressKey('ArrowRight');
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    it('is a no-op when no messages are displayed', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowLeft');
      expect(screen.getByText('Ready to play back conversation')).toBeInTheDocument();
    });
  });

  describe('Space - toggle play/pause', () => {
    it('starts playback when idle', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      expect(screen.getByLabelText('Play (Space)')).toBeInTheDocument();
      pressKey(' ');
      expect(screen.getByLabelText('Pause (Space)')).toBeInTheDocument();
    });

    it('pauses playback when playing', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey(' ');
      expect(screen.getByLabelText('Pause (Space)')).toBeInTheDocument();

      pressKey(' ');
      expect(screen.getByLabelText('Resume (Space)')).toBeInTheDocument();
    });

    it('resumes playback when paused', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey(' ');
      pressKey(' ');
      expect(screen.getByLabelText('Resume (Space)')).toBeInTheDocument();

      pressKey(' ');
      expect(screen.getByLabelText('Pause (Space)')).toBeInTheDocument();
    });
  });

  describe('R - restart', () => {
    it('resets displayed messages after partial stepping', () => {
      renderChat({
        conversation: simpleConversation,
        conversationInfo: testConversationInfo,
      });

      pressKey('ArrowRight');
      pressKey('ArrowRight');
      expect(screen.getByText('Hi there')).toBeInTheDocument();

      pressKey('r');
      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
      expect(screen.queryByText('Hi there')).not.toBeInTheDocument();
    });
  });

  describe('guards', () => {
    it('ignores keys when an input element has focus', () => {
      const { container } = render(
        <ThemeProvider theme={theme}>
          <div>
            <input data-testid="search-input" />
            <ChatContainer
              conversation={simpleConversation}
              conversationInfo={testConversationInfo}
              displaySettings={defaultSettings}
            />
          </div>
        </ThemeProvider>,
      );

      const input = screen.getByTestId('search-input');
      input.focus();
      fireEvent.keyDown(input, { key: 'ArrowRight' });

      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
      expect(container.querySelector('[aria-label="Play (Space)"]')).toBeInTheDocument();
    });

    it('ignores keys when no conversation is loaded', () => {
      renderChat({ conversation: null });

      pressKey('ArrowRight');
      pressKey(' ');

      expect(screen.getByText('Agent Replay')).toBeInTheDocument();
    });
  });
});
