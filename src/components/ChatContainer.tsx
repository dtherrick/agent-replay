import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  AppBar,
  Toolbar,
  Chip,
  CircularProgress,
  Button,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Chat as ChatIcon,
  BugReport as BugIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay as RestartIcon,
} from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import type { ChatHistory } from '../types/chat';
const ChatContainer: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [displayedHistory, setDisplayedHistory] = useState<ChatHistory>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [animationInProgress, setAnimationInProgress] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const transformedHistoryRef = useRef<ChatHistory>([]);
  // Refs to keep immediate, mutation-friendly copies of paused and animation states
  const isPausedRef = useRef(false);
  const animationInProgressRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayedHistory]);

  // Keep ref in sync with state for reliable current index tracking
  useEffect(() => {
    currentIndexRef.current = currentMessageIndex;
  }, [currentMessageIndex]);

  // Transform raw chat history into realistic conversation flow
  const transformChatHistory = (rawHistory: ChatHistory): ChatHistory => {
    const transformed: ChatHistory = [];
    
    for (let i = 0; i < rawHistory.length; i++) {
      const message = rawHistory[i];
      
      // Handle function responses - convert from user messages to system messages
      if (message.role === 'user' && message.parts.some(part => part.functionResponse)) {
        transformed.push({
          ...message,
          role: 'system'
        });
        continue;
      }
      
      // Handle assistant messages with function calls
      if (message.role === 'model' && message.parts.some(part => part.functionCall)) {
        // Add approval flow for function calls
        const functionCallPart = message.parts.find(part => part.functionCall);
        if (functionCallPart?.functionCall) {
          transformed.push({
            role: 'approval',
            parts: [],
            functionCallToApprove: functionCallPart.functionCall,
            approval: { status: 'pending' }
          });
        }
        transformed.push(message);
        continue;
      }
      
      // Handle regular assistant text messages - add thinking animation
      if (message.role === 'model' && message.parts.some(part => part.text && !part.functionCall)) {
        transformed.push({
          role: 'thinking',
          parts: []
        });
        transformed.push(message);
        continue;
      }
      
      // Default case: add message as-is
      transformed.push(message);
    }
    
    return transformed;
  };

  // Control functions for play/pause
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
    // Allow the React state to update before continuing the animation
    setTimeout(() => {
      if (animationInProgressRef.current && currentIndexRef.current < transformedHistoryRef.current.length) {
        continueAnimation();
      }
    }, 0);
  };

  const restartAnimation = () => {
    // Reset all control flags immediately
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
    // Scroll to top when starting playback
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (transformedHistoryRef.current.length > 0) {
      animateConversation(transformedHistoryRef.current);
    }
  };

  // Utility function for interruptible delays
  const waitWithPauseCheck = (ms: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        // Check if the timeout was cleared (meaning we were paused)
        if (animationTimeoutRef.current === null) {
          resolve(false);
        } else {
          resolve(true);
        }
      }, ms);
      animationTimeoutRef.current = timeoutId;
    });
  };

  // Continue animation from current position
  const continueAnimation = async () => {
    const transformedHistory = transformedHistoryRef.current;
    console.log('continueAnimation starting from index:', currentIndexRef.current, 'total:', transformedHistory.length);
    
    for (let i = currentIndexRef.current; i < transformedHistory.length; i++) {
      if (isPausedRef.current) {
        console.log('Animation paused at index:', i);
        break;
      }
      
      const message = transformedHistory[i];
      console.log('Processing message', i, ':', message.role);
      setCurrentMessageIndex(i);
      currentIndexRef.current = i;
      
      // Handle thinking messages specially
      if (message.role === 'thinking') {
        console.log('  -> Showing thinking animation');
        // Show thinking animation
        setDisplayedHistory(prev => [...prev, message]);
        
        // Wait for thinking duration
        const shouldContinue = await waitWithPauseCheck(2000);
        if (!shouldContinue) {
          console.log('  -> Thinking interrupted by pause');
          break;
        }
        
        // Replace thinking with actual response (next message)
        const nextMessage = transformedHistory[i + 1];
        if (nextMessage) {
          console.log('  -> Replacing thinking with:', nextMessage.role);
          setDisplayedHistory(prev => {
            const updated = [...prev];
            const thinkingIdx = [...updated].reverse().findIndex(msg => msg.role === 'thinking');
            const actualIdx = thinkingIdx === -1 ? -1 : updated.length - 1 - thinkingIdx;
            if (actualIdx !== -1) {
              updated[actualIdx] = nextMessage;
            } else {
              updated.push(nextMessage);
            }
            return updated;
          });
          i++; // Skip the next message since we just added it
          setCurrentMessageIndex(i);
      currentIndexRef.current = i;
        }
      } else if (message.role === 'approval') {
        console.log('  -> Showing approval prompt');
        // 1. Show pending approval card
        setDisplayedHistory(prev => [...prev, message]);

        // Give the user time to read the prompt
        let shouldContinue = await waitWithPauseCheck(2500);
        if (!shouldContinue) break;

        // 2. Replace card with "approved / working" spinner
        setDisplayedHistory(prev => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = { ...message, approval: { status: 'approved', action: 'yes' } };
          }
          return updated;
        });

        // Allow time for the spinner animation
        shouldContinue = await waitWithPauseCheck(2000);
        if (!shouldContinue) break;

        // 3. Replace spinner card with the actual function call message
        const nextMessage = transformedHistory[i + 1];
        if (nextMessage) {
          setDisplayedHistory(prev => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = nextMessage;
            }
            return updated;
          });
          i++; // Skip the next message; we've already shown it
          setCurrentMessageIndex(i);
      currentIndexRef.current = i;
        }
      } else {
        console.log('  -> Adding regular message');
        // Regular message handling
        setDisplayedHistory(prev => [...prev, message]);
        
        // Determine delay based on message type
        let delay = 500; // default delay
        
        if (message.role === 'model' && message.parts.some(part => part.functionCall)) {
          delay = 1000;
        } else if (message.role === 'user') {
          delay = 300;
        }
        
        // Wait before next message
        if (i < transformedHistory.length - 1) {
          const shouldContinue = await waitWithPauseCheck(delay);
          if (!shouldContinue) break;
        }
      }
    }
    
    if (!isPausedRef.current) {
      animationInProgressRef.current = false;
      setAnimationInProgress(false);
      setCurrentMessageIndex(0);
    }
  };

  // Simulate realistic conversation flow with animations
  const animateConversation = async (transformedHistory: ChatHistory) => {
    console.log('animateConversation called, inProgress:', animationInProgressRef.current, 'paused:', isPausedRef.current);
    
    if (animationInProgressRef.current && !isPausedRef.current) {
      console.log('Animation already running, skipping');
      return;
    }
    
    console.log('Starting animation with', transformedHistory.length, 'messages');
    transformedHistoryRef.current = transformedHistory;
    animationInProgressRef.current = true;
    setAnimationInProgress(true);
    isPausedRef.current = false;
    setIsPaused(false);
    setCurrentMessageIndex(0);
    currentIndexRef.current = 0;
    setDisplayedHistory([]);
    
    // Small delay to ensure smooth transition from loading
    await new Promise(resolve => setTimeout(resolve, 100));
    
    continueAnimation();
  };

  const handleApprovalAction = (_action: 'yes' | 'no' | 'end') => {
    // In this demo, we always simulate "yes" approval
    // This is just for the animation effect
  };

  const fetchChatHistory = async (pageNumber: number) => {
    console.log('fetchChatHistory called with page:', pageNumber, 'initialized:', initialized);
    
    // Prevent multiple initializations
    if (pageNumber === 1 && initialized) {
      console.log('Already initialized, skipping');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/chat?page=${pageNumber}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const newHistory = [...chatHistory, ...data.messages];
      setChatHistory(newHistory);
      setHasMore(data.hasMore);
      setLoading(false);
      setInitialized(true);
      
      // Transform and store the conversation (don't auto-start, wait for user to hit play)
      const transformed = transformChatHistory(newHistory);
      transformedHistoryRef.current = transformed;
    } catch (error) {
      console.warn("Remote API unavailable, falling back to local JSON file.");
      try {
        // Lazy-import the raw JSON string via Vite and parse it
        const rawJson = (await import('../chat_history.json?raw')).default as string;
        const localMessages = JSON.parse(rawJson) as ChatHistory;
        setChatHistory(localMessages);
        setHasMore(false);
        setLoading(false);
        setInitialized(true);
        
        // Transform and store the conversation (don't auto-start, wait for user to hit play)
        const transformed = transformChatHistory(localMessages);
        transformedHistoryRef.current = transformed;
      } catch (localErr) {
        console.error('Failed to load local chat history:', localErr);
        setLoading(false);
        setInitialized(true);
      }
    }
  };

  useEffect(() => {
    fetchChatHistory(1);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchChatHistory(nextPage);
  };

  return (
    <Box sx={{ 
      width: '100vw', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <AppBar position="static" color="primary" sx={{ width: '100%', flexShrink: 0 }}>
        <Toolbar>
          <ChatIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            StockSavvy Support Chat Simulator
          </Typography>
          <Chip 
            icon={<BugIcon />}
            label="Database Pool Exhaustion Investigation"
            color="secondary"
            variant="outlined"
          />
        </Toolbar>
      </AppBar>

      <Box sx={{ 
        width: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        flexGrow: 1,
        mt: animationInProgress ? 0 : 3, 
        mb: animationInProgress ? 0 : 3,
        overflow: 'hidden',
      }}>
        <Box sx={{ 
          width: '66%', 
          minWidth: 600, 
          maxWidth: 1200,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>

        {/* Header card - hidden during playback */}
        {!animationInProgress && (
          <Paper elevation={1} sx={{ p: 3, mb: 3, bgcolor: 'grey.900', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h5" component="h1">
                Support Investigation Chat
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              This chat demonstrates a support engineer working with an AI assistant to investigate 
              a "database connection pool exhaustion" alert for the StockSavvy SaaS application. 
              The investigation includes searching Confluence runbooks and analyzing Splunk logs.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label="Confluence Integration" />
              <Chip size="small" label="Splunk Analysis" />
              <Chip size="small" label="SRE Runbook" />
              <Chip size="small" label="Database Troubleshooting" />
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Press the play button in the bottom right to start the demo.
            </Typography>
          </Paper>
        )}

        {!animationInProgress && <Divider sx={{ mb: 3 }} />}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ 
            flexGrow: 1,
            overflow: 'auto', 
            pr: 1,
            pb: animationInProgress ? 10 : 0, // Extra padding at bottom during playback for floating controls
          }}>
            {displayedHistory.map((message, index) => (
              <ChatMessage 
                key={index} 
                message={message} 
                index={index}
                onApprovalAction={handleApprovalAction}
              />
            ))}
            <div ref={messagesEndRef} />
          </Box>
        )}

        {hasMore && !loading && !animationInProgress && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, flexShrink: 0 }}>
            <Button variant="contained" onClick={handleLoadMore}>
              Load More
            </Button>
          </Box>
        )}

        {/* Footer - hidden during playback */}
        {!animationInProgress && (
          <Paper elevation={0} sx={{ mt: 3, p: 2, bgcolor: 'grey.50', flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Chat contains {displayedHistory.length} messages • 
              Built with React, TypeScript, Vite & Material-UI
            </Typography>
          </Paper>
        )}
        </Box>
      </Box>

      {/* Floating Playback Controls */}
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          borderRadius: 8,
          bgcolor: 'grey.900',
          p: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {/* Progress indicator */}
        {animationInProgress && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            {currentMessageIndex + 1} / {transformedHistoryRef.current.length}
          </Typography>
        )}
        
        {/* Restart button */}
        <Tooltip title="Restart">
          <span>
            <Fab
              size="small"
              color="default"
              onClick={restartAnimation}
              disabled={loading}
              sx={{ bgcolor: 'grey.800', '&:hover': { bgcolor: 'grey.700' } }}
            >
              <RestartIcon />
            </Fab>
          </span>
        </Tooltip>
        
        {/* Play/Pause button */}
        <Tooltip title={animationInProgress && !isPaused ? 'Pause' : isPaused ? 'Resume' : 'Play'}>
          <span>
            <Fab
              color={animationInProgress && !isPaused ? 'secondary' : 'primary'}
              onClick={() => {
                if (animationInProgress && !isPaused) {
                  pauseAnimation();
                } else if (isPaused) {
                  resumeAnimation();
                } else {
                  restartAnimation();
                }
              }}
              disabled={loading}
              sx={{
                width: 56,
                height: 56,
              }}
            >
              {animationInProgress && !isPaused ? <PauseIcon /> : <PlayIcon />}
            </Fab>
          </span>
        </Tooltip>
      </Paper>
    </Box>
  );
};

export default ChatContainer;