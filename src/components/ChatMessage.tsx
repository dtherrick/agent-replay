import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Fade,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Code as CodeIcon,
  Psychology as ThinkingIcon,
  Build as ToolIcon,
  Output as ResultIcon,
  CheckCircle as ApprovedIcon,
} from '@mui/icons-material';
import type { PlaybackMessage } from '../types/chat';
import ReactMarkdown from 'react-markdown';
import SubagentReplay from './SubagentReplay';

interface ChatMessageProps {
  message: PlaybackMessage;
  index: number;
}

// --- Thinking dots animation ---
const ThinkingAnimation: React.FC = () => (
  <Fade in timeout={500}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
      <ThinkingIcon color="secondary" />
      <Typography variant="body2" color="text.secondary">
        Assistant is thinking
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {[0, 1, 2].map(i => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'secondary.main',
              animation: 'pulse 1.5s infinite',
              animationDelay: `${i * 0.2}s`,
              '@keyframes pulse': {
                '0%, 80%, 100%': { opacity: 0.3, transform: 'scale(0.8)' },
                '40%': { opacity: 1, transform: 'scale(1)' },
              },
            }}
          />
        ))}
      </Box>
    </Box>
  </Fade>
);

// --- Approval flow ---
const ApprovalDisplay: React.FC<{ message: PlaybackMessage }> = ({ message }) => {
  const isApproved = message.approval?.status === 'approved';
  const toolName = message.toolCall?.name || 'unknown';

  if (isApproved) {
    return (
      <Fade in>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ApprovedIcon color="success" sx={{ fontSize: 18 }} />
            <Typography variant="body2" color="text.secondary">
              Approved: {toolName}
            </Typography>
          </Box>
          <LinearProgress variant="indeterminate" sx={{ height: 2, borderRadius: 1 }} />
        </Box>
      </Fade>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'warning.dark', borderRadius: 1 }}>
      <Typography variant="body2" gutterBottom>
        <strong>Tool Call Approval:</strong> {toolName}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        The assistant wants to use a tool. Approve?
      </Typography>
    </Box>
  );
};

// --- Tool call display ---
const ToolCallDisplay: React.FC<{ message: PlaybackMessage }> = ({ message }) => {
  if (!message.toolCall) return null;

  const hasArgs = Object.keys(message.toolCall.args).length > 0;
  const argEntries = Object.entries(message.toolCall.args);
  const truncatedArgs: Record<string, string> = {};
  for (const [key, value] of argEntries) {
    truncatedArgs[key] = value.length > 200 ? value.substring(0, 200) + '...' : value;
  }

  return (
    <Accordion sx={{ mt: 0 }} defaultExpanded={!hasArgs || argEntries.length <= 3}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography variant="body2" fontWeight="bold">
            {message.toolCall.name}
          </Typography>
        </Box>
      </AccordionSummary>
      {hasArgs && (
        <AccordionDetails>
          <Paper sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Box
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                m: 0,
                maxHeight: 300,
              }}
            >
              {JSON.stringify(truncatedArgs, null, 2)}
            </Box>
          </Paper>
        </AccordionDetails>
      )}
    </Accordion>
  );
};

// --- Tool result display ---
const ToolResultDisplay: React.FC<{ message: PlaybackMessage }> = ({ message }) => {
  if (!message.toolResult) return null;

  let formattedOutput = message.toolResult.output;
  try {
    const parsed = JSON.parse(formattedOutput);
    formattedOutput = JSON.stringify(parsed, null, 2);
  } catch {
    // leave as-is
  }

  return (
    <Accordion sx={{ mt: 0 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ResultIcon color="info" sx={{ fontSize: 18 }} />
          <Typography variant="body2" fontWeight="bold">
            Result: {message.toolResult.name}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Paper sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              m: 0,
              maxHeight: 300,
            }}
          >
            {formattedOutput}
          </Box>
        </Paper>
      </AccordionDetails>
    </Accordion>
  );
};

// --- Main ChatMessage component ---
const ChatMessage: React.FC<ChatMessageProps> = ({ message, index }) => {
  if (message.role === 'subagent' && message.subagent) {
    return <SubagentReplay subagent={message.subagent} />;
  }

  if (message.role === 'thinking_animation') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', mb: 2 }}>
        <Box sx={{ width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1 }}>
          <BotIcon color="secondary" />
        </Box>
        <Card sx={{ flex: 1, bgcolor: 'background.paper', borderRadius: 2 }}>
          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
            <ThinkingAnimation />
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (message.role === 'approval') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', mb: 2 }}>
        <Box sx={{ width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1 }}>
          <ToolIcon color="warning" />
        </Box>
        <Card sx={{ flex: 1, bgcolor: 'warning.main', borderRadius: 2 }}>
          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
            <ApprovalDisplay message={message} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  const isUser = message.role === 'user';
  const isThinking = message.role === 'thinking';
  const isToolCall = message.role === 'tool_call';
  const isToolResult = message.role === 'tool_result';

  const getIcon = () => {
    if (isUser) return <PersonIcon color="primary" />;
    if (isThinking) return <ThinkingIcon color="secondary" />;
    if (isToolCall) return <ToolIcon color="info" />;
    if (isToolResult) return <ResultIcon color="info" />;
    return <BotIcon color="secondary" />;
  };

  const getLabel = () => {
    if (isUser) return 'User';
    if (isThinking) return 'Thinking';
    if (isToolCall) return 'Tool Call';
    if (isToolResult) return 'Tool Result';
    return 'Assistant';
  };

  const getBgColor = () => {
    if (isUser) return 'primary.main';
    if (isThinking) return 'action.hover';
    if (isToolCall) return 'info.dark';
    if (isToolResult) return 'info.dark';
    return 'background.paper';
  };

  const getChipColor = (): 'primary' | 'secondary' | 'info' | 'warning' | 'default' => {
    if (isUser) return 'primary';
    if (isThinking) return 'warning';
    if (isToolCall || isToolResult) return 'info';
    return 'secondary';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', mb: 2 }}>
      <Box sx={{ width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1 }}>
        {getIcon()}
        <Typography variant="caption" color="text.secondary">
          #{index + 1}
        </Typography>
      </Box>
      <Card sx={{ flex: 1, bgcolor: getBgColor(), borderRadius: 2, opacity: isThinking ? 0.85 : 1 }}>
        <CardContent sx={{ '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip label={getLabel()} size="small" color={getChipColor()} />
            <Typography variant="caption" color="text.secondary">
              #{index + 1}
            </Typography>
          </Box>

          {/* Text content */}
          {message.content && !isToolCall && !isToolResult && (
            <Box
              sx={{
                typography: 'body1',
                whiteSpace: 'pre-wrap',
                color: isUser ? 'primary.contrastText' : 'text.primary',
                fontSize: isThinking ? '0.875rem' : undefined,
                fontStyle: isThinking ? 'italic' : undefined,
                '& p': { m: 0, mb: 1 },
                '& code': {
                  bgcolor: 'action.selected',
                  color: 'secondary.light',
                  px: 0.5,
                  borderRadius: 1,
                },
                '& pre': {
                  bgcolor: 'action.selected',
                  p: 1,
                  borderRadius: 1,
                  overflow: 'auto',
                },
              }}
            >
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </Box>
          )}

          {/* Tool call details */}
          {isToolCall && <ToolCallDisplay message={message} />}

          {/* Tool result details */}
          {isToolResult && <ToolResultDisplay message={message} />}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ChatMessage;
