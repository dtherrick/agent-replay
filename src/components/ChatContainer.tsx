import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Chip,
  CircularProgress,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay as RestartIcon,
} from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import type {
  UnifiedMessage,
  PlaybackHistory,
  DisplaySettings,
  ConversationInfo,
} from '../types/chat';

interface ChatContainerProps {
  conversation: UnifiedMessage[] | null;
  conversationInfo: ConversationInfo | null;
  displaySettings: DisplaySettings;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  conversation,
  conversationInfo,
  displaySettings,
}) => {
  const [displayedHistory, setDisplayedHistory] = useState<PlaybackHistory>([]);
  const [animationInProgress, setAnimationInProgress] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const currentIndexRef = useRef(0);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const transformedHistoryRef = useRef<PlaybackHistory>([]);
  const isPausedRef = useRef(false);
  const animationInProgressRef = useRef(false);
  const displaySettingsRef = useRef(displaySettings);
  const displayedHistoryRef = useRef<PlaybackHistory>([]);

  useEffect(() => {
    displaySettingsRef.current = displaySettings;
  }, [displaySettings]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayedHistory]);

  useEffect(() => {
    currentIndexRef.current = currentMessageIndex;
  }, [currentMessageIndex]);

  useEffect(() => {
    displayedHistoryRef.current = displayedHistory;
  }, [displayedHistory]);

  // --- Transformation: UnifiedMessage[] → PlaybackHistory ---

  const transformToPlayback = useCallback(
    (messages: UnifiedMessage[], settings: DisplaySettings): PlaybackHistory => {
      const filtered = messages.filter(msg => {
        if (msg.role === 'thinking' && !settings.showThinking) return false;
        if (msg.role === 'tool_call' && !settings.showToolCalls) return false;
        if (msg.role === 'tool_result' && !settings.showToolResults) return false;
        return true;
      });

      const playback: PlaybackHistory = [];

      for (const msg of filtered) {
        switch (msg.role) {
          case 'assistant':
            playback.push({ role: 'thinking_animation', content: '' });
            playback.push({ role: 'assistant', content: msg.content });
            break;

          case 'tool_call':
            if (settings.showToolCalls) {
              playback.push({
                role: 'approval',
                content: '',
                toolCall: msg.toolCall,
                approval: { status: 'pending' },
              });
              playback.push({
                role: 'tool_call',
                content: msg.content,
                toolCall: msg.toolCall,
              });
            }
            break;

          case 'thinking':
            playback.push({ role: 'thinking', content: msg.content });
            break;

          case 'tool_result':
            playback.push({
              role: 'tool_result',
              content: msg.content,
              toolResult: msg.toolResult,
            });
            break;

          default:
            playback.push({ role: msg.role, content: msg.content });
        }
      }

      return playback;
    },
    []
  );

  // Re-transform when conversation or display settings change
  useEffect(() => {
    if (!conversation) {
      transformedHistoryRef.current = [];
      setDisplayedHistory([]);
      setCurrentMessageIndex(0);
      currentIndexRef.current = 0;
      return;
    }

    // Stop any running animation
    isPausedRef.current = false;
    animationInProgressRef.current = false;
    setIsPaused(false);
    setAnimationInProgress(false);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }

    const transformed = transformToPlayback(conversation, displaySettings);
    transformedHistoryRef.current = transformed;
    setDisplayedHistory([]);
    setCurrentMessageIndex(0);
    currentIndexRef.current = 0;
  }, [conversation, displaySettings, transformToPlayback]);

  // --- Playback Controls ---

  const waitWithPauseCheck = (ms: number): Promise<boolean> => {
    const speed = displaySettingsRef.current.playbackSpeed;
    const adjustedMs = ms / speed;
    return new Promise(resolve => {
      const timeoutId = window.setTimeout(() => {
        if (animationTimeoutRef.current === null) {
          resolve(false);
        } else {
          resolve(true);
        }
      }, adjustedMs);
      animationTimeoutRef.current = timeoutId;
    });
  };

  const pauseAnimation = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  };

  const resumeAnimation = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    setTimeout(() => {
      if (
        animationInProgressRef.current &&
        currentIndexRef.current < transformedHistoryRef.current.length
      ) {
        continueAnimation();
      }
    }, 0);
  };

  const restartAnimation = () => {
    isPausedRef.current = false;
    animationInProgressRef.current = false;
    setIsPaused(false);
    setAnimationInProgress(false);
    setCurrentMessageIndex(0);
    currentIndexRef.current = 0;
    setDisplayedHistory([]);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (transformedHistoryRef.current.length > 0) {
      animateConversation();
    }
  };

  const animateConversation = async () => {
    animationInProgressRef.current = true;
    setAnimationInProgress(true);
    setCurrentMessageIndex(0);
    currentIndexRef.current = 0;
    setDisplayedHistory([]);
    await new Promise(resolve => setTimeout(resolve, 100));
    continueAnimation();
  };

  const continueAnimation = async () => {
    const transformedHistory = transformedHistoryRef.current;

    for (let i = currentIndexRef.current; i < transformedHistory.length; i++) {
      if (isPausedRef.current || !animationInProgressRef.current) {
        setCurrentMessageIndex(i);
        currentIndexRef.current = i;
        return;
      }

      const message = transformedHistory[i];

      if (message.role === 'thinking_animation') {
        setDisplayedHistory(prev => [...prev, message]);
        setCurrentMessageIndex(i);

        const waited = await waitWithPauseCheck(2000);
        if (!waited || isPausedRef.current) {
          currentIndexRef.current = i;
          return;
        }

        const nextMessage = transformedHistory[i + 1];
        if (nextMessage) {
          setDisplayedHistory(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = nextMessage;
            return updated;
          });
          i++;
          setCurrentMessageIndex(i);

          const waited2 = await waitWithPauseCheck(1000);
          if (!waited2 || isPausedRef.current) {
            currentIndexRef.current = i + 1;
            return;
          }
        }
        continue;
      }

      if (message.role === 'approval') {
        setDisplayedHistory(prev => [...prev, message]);
        setCurrentMessageIndex(i);

        const waited = await waitWithPauseCheck(2500);
        if (!waited || isPausedRef.current) {
          currentIndexRef.current = i;
          return;
        }

        setDisplayedHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...message,
            approval: { status: 'approved' },
          };
          return updated;
        });

        const waited2 = await waitWithPauseCheck(2000);
        if (!waited2 || isPausedRef.current) {
          currentIndexRef.current = i + 1;
          return;
        }

        const nextMessage = transformedHistory[i + 1];
        if (nextMessage && nextMessage.role === 'tool_call') {
          setDisplayedHistory(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = nextMessage;
            return updated;
          });
          i++;
          setCurrentMessageIndex(i);

          const waited3 = await waitWithPauseCheck(500);
          if (!waited3 || isPausedRef.current) {
            currentIndexRef.current = i + 1;
            return;
          }
        }
        continue;
      }

      // Regular messages: user, assistant, thinking, tool_call, tool_result
      setDisplayedHistory(prev => [...prev, message]);
      setCurrentMessageIndex(i);

      let delay = 500;
      if (message.role === 'user') delay = 800;
      else if (message.role === 'assistant') delay = 1000;
      else if (message.role === 'thinking') delay = 1500;
      else if (message.role === 'tool_result') delay = 300;

      const waited = await waitWithPauseCheck(delay);
      if (!waited || isPausedRef.current) {
        currentIndexRef.current = i + 1;
        return;
      }
    }

    animationInProgressRef.current = false;
    setAnimationInProgress(false);
    setCurrentMessageIndex(transformedHistory.length);
  };

  // --- Step Controls ---

  const stepForward = () => {
    const transformedHistory = transformedHistoryRef.current;
    if (transformedHistory.length === 0) return;

    if (animationInProgressRef.current && !isPausedRef.current) {
      pauseAnimation();
    }

    let idx = currentIndexRef.current;
    if (idx >= transformedHistory.length) return;

    if (!animationInProgressRef.current) {
      animationInProgressRef.current = true;
      setAnimationInProgress(true);
    }

    const message = transformedHistory[idx];

    if (message.role === 'thinking_animation') {
      const next = transformedHistory[idx + 1];
      if (next) {
        setDisplayedHistory(prev => [...prev, next]);
        idx += 2;
      } else {
        idx += 1;
      }
    } else if (message.role === 'approval') {
      const next = transformedHistory[idx + 1];
      if (next && next.role === 'tool_call') {
        setDisplayedHistory(prev => [...prev, next]);
        idx += 2;
      } else {
        setDisplayedHistory(prev => [...prev, message]);
        idx += 1;
      }
    } else {
      setDisplayedHistory(prev => [...prev, message]);
      idx += 1;
    }

    setCurrentMessageIndex(idx);
    currentIndexRef.current = idx;

    if (idx >= transformedHistory.length) {
      animationInProgressRef.current = false;
      setAnimationInProgress(false);
    }
  };

  const stepBackward = () => {
    if (displayedHistoryRef.current.length === 0) return;

    if (animationInProgressRef.current && !isPausedRef.current) {
      pauseAnimation();
    }

    setDisplayedHistory(prev => prev.slice(0, -1));

    let idx = currentIndexRef.current;
    if (idx >= 2) {
      const prevEntry = transformedHistoryRef.current[idx - 2];
      if (prevEntry?.role === 'thinking_animation' || prevEntry?.role === 'approval') {
        idx -= 2;
      } else {
        idx -= 1;
      }
    } else {
      idx = 0;
    }

    setCurrentMessageIndex(idx);
    currentIndexRef.current = idx;

    if (displayedHistoryRef.current.length <= 1) {
      animationInProgressRef.current = false;
      setAnimationInProgress(false);
    }
  };

  const togglePlayPause = () => {
    if (!animationInProgressRef.current) {
      animateConversation();
    } else if (isPausedRef.current) {
      resumeAnimation();
    } else {
      pauseAnimation();
    }
  };

  // --- Keyboard Shortcuts ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!conversation || conversation.length === 0) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBackward();
          break;
        case 'r':
        case 'R':
          restartAnimation();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // Control functions use refs for async state; re-registration on conversation change is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // --- Render ---

  const totalMessages = transformedHistoryRef.current.length;
  const hasConversation = conversation && conversation.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
            {conversationInfo?.title || 'Select a conversation'}
          </Typography>
          {conversationInfo && (
            <Typography variant="caption" color="text.secondary">
              {conversationInfo.projectName} &middot; {conversationInfo.sourceId}
              {totalMessages > 0 && ` \u00B7 ${totalMessages} steps`}
            </Typography>
          )}
        </Box>

        {hasConversation && animationInProgress && (
          <Chip
            size="small"
            label={`${currentMessageIndex} / ${totalMessages}`}
            color="primary"
            variant="outlined"
          />
        )}
      </Paper>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          pb: 12,
        }}
      >
        {!hasConversation && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60vh',
              color: 'text.secondary',
            }}
          >
            <Typography variant="h5" gutterBottom>
              Agent Replay
            </Typography>
            <Typography variant="body2">
              Select a conversation from the sidebar to begin playback.
            </Typography>
          </Box>
        )}

        {hasConversation && !animationInProgress && displayedHistory.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60vh',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body1" gutterBottom>
              Ready to play back conversation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Press the play button to start.
            </Typography>
          </Box>
        )}

        {displayedHistory.map((message, index) => (
          <ChatMessage key={index} message={message} index={index} />
        ))}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* Floating playback controls */}
      {hasConversation && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            gap: 1,
            zIndex: 1000,
          }}
        >
          {!animationInProgress ? (
            <Tooltip title="Play (Space)">
              <Fab color="primary" onClick={animateConversation} size="medium">
                <PlayIcon />
              </Fab>
            </Tooltip>
          ) : isPaused ? (
            <Tooltip title="Resume (Space)">
              <Fab color="primary" onClick={resumeAnimation} size="medium">
                <PlayIcon />
              </Fab>
            </Tooltip>
          ) : (
            <Tooltip title="Pause (Space)">
              <Fab color="secondary" onClick={pauseAnimation} size="medium">
                <PauseIcon />
              </Fab>
            </Tooltip>
          )}

          {(animationInProgress || displayedHistory.length > 0) && (
            <Tooltip title="Restart (R)">
              <Fab onClick={restartAnimation} size="small" sx={{ bgcolor: 'action.selected' }}>
                <RestartIcon />
              </Fab>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Loading indicator */}
      {!conversation && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default ChatContainer;
