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
  Button,
  CircularProgress,
  Fade,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  ExitToApp as EndIcon,
  Psychology as ThinkingIcon,
  Build as SystemIcon,
} from '@mui/icons-material';
import type { ChatMessageType, ChatPart, ApprovalState } from '../types/chat';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: ChatMessageType;
  index: number;
  onApprovalAction?: (action: 'yes' | 'no' | 'end') => void;
}

const ThinkingAnimation: React.FC = () => {
  return (
    <Fade in timeout={500}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
        <ThinkingIcon color="secondary" />
        <Typography variant="body2" color="text.secondary">
          Assistant is thinking
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[0, 1, 2].map((i) => (
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
};

const ApprovalFlow: React.FC<{ 
  functionCall: any, 
  approval: ApprovalState, 
  onAction: (action: 'yes' | 'no' | 'end') => void 
}> = ({ functionCall, approval, onAction }) => {
  const [showWorking, setShowWorking] = React.useState(false);

  React.useEffect(() => {
    if (approval.status === 'approved') {
      setShowWorking(true);
      const timer = setTimeout(() => setShowWorking(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [approval.status]);

  if (showWorking) {
    return (
      <Fade in>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Executing function: {functionCall.name}
            </Typography>
          </Box>
          <LinearProgress variant="indeterminate" sx={{ height: 2, borderRadius: 1 }} />
        </Box>
      </Fade>
    );
  }

  if (approval.status === 'pending') {
    return (
      <Box sx={{ p: 2, bgcolor: 'warning.dark', borderRadius: 1, mb: 1 }}>
        <Typography variant="body2" gutterBottom>
          <strong>Function Call Approval Required:</strong> {functionCall.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          The assistant wants to call a function. Do you approve?
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            variant="contained" 
            color="success"
            startIcon={<CheckIcon />}
            onClick={() => onAction('yes')}
          >
            Yes
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => onAction('no')}
          >
            No
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<EndIcon />}
            onClick={() => onAction('end')}
          >
            End Chat
          </Button>
        </Box>
      </Box>
    );
  }

  return null;
};

const FunctionCallDisplay: React.FC<{ part: ChatPart }> = ({ part }) => {
  if (!part.functionCall) return null;
  
  return (
    <Accordion sx={{ mt: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon color="primary" />
          <Typography variant="body2" fontWeight="bold">
            Function Call: {part.functionCall.name}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Paper sx={{ p: 2, bgcolor: 'grey.800', color: 'grey.100', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Arguments:
          </Typography>
          <Box component="pre" sx={{ 
            fontFamily: 'monospace', 
            fontSize: '0.8rem',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(part.functionCall.args, null, 2)}
          </Box>
        </Paper>
      </AccordionDetails>
    </Accordion>
  );
};

const FunctionResponseDisplay: React.FC<{ part: ChatPart }> = ({ part }) => {
  if (!part.functionResponse) return null;

  // Attempt to pretty-print JSON if the output looks like valid JSON
  let formattedOutput: string = part.functionResponse.response.output;
  try {
    const parsed = JSON.parse(formattedOutput);
    formattedOutput = JSON.stringify(parsed, null, 2);
  } catch (err) {
    // Leave output unchanged if it's not valid JSON
  }
  
  return (
    <Accordion sx={{ mt: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="secondary" />
          <Typography variant="body2" fontWeight="bold">
            Function Response: {part.functionResponse.name}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Paper sx={{ p: 2, bgcolor: 'grey.800', color: 'grey.100', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Output:
          </Typography>
          <Box component="pre" sx={{ 
            fontFamily: 'monospace', 
            fontSize: '0.8rem',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            maxHeight: '300px'
          }}>
            {formattedOutput}
          </Box>
        </Paper>
      </AccordionDetails>
    </Accordion>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, index, onApprovalAction }) => {
  // Handle thinking animation
  if (message.role === 'thinking') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', mb: 2 }}>
        <Box sx={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1 }}>
          <BotIcon color="secondary" />
          <Typography variant="caption" color="text.secondary">#{index + 1}</Typography>
        </Box>
        <Card sx={{ flex: 1, bgcolor: 'grey.900', borderRadius: 2 }}>
          <CardContent>
            <ThinkingAnimation />
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Handle approval flow
  if (message.role === 'approval' && message.functionCallToApprove && message.approval) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', mb: 2 }}>
        <Box sx={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1 }}>
          <PersonIcon color="primary" />
          <Typography variant="caption" color="text.secondary">#{index + 1}</Typography>
        </Box>
        <Card sx={{ flex: 1, bgcolor: 'warning.main', borderRadius: 2 }}>
          <CardContent>
            <ApprovalFlow 
              functionCall={message.functionCallToApprove}
              approval={message.approval}
              onAction={onApprovalAction || (() => {})}
            />
          </CardContent>
        </Card>
      </Box>
    );
  }

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  // Get appropriate icon and styling
  const getIcon = () => {
    if (isUser) return <PersonIcon color="primary" />;
    if (isSystem) return <SystemIcon color="info" />;
    return <BotIcon color="secondary" />;
  };

  const getLabel = () => {
    if (isUser) return 'User';
    if (isSystem) return 'System';
    return 'Assistant';
  };

  const getBgColor = () => {
    if (isUser) return 'primary.main';
    if (isSystem) return 'info.dark';
    return 'grey.900';
  };

  const getChipColor = () => {
    if (isUser) return 'primary';
    if (isSystem) return 'info';
    return 'secondary';
  };
  
  return (
    <Box sx={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', mb: 2 }}>
      <Box sx={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1 }}>
        {getIcon()}
        <Typography variant="caption" color="text.secondary">#{index + 1}</Typography>
      </Box>
      <Card 
        sx={{ 
          flex: 1,
          bgcolor: getBgColor(),
          borderRadius: 2
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip 
              label={getLabel()} 
              size="small" 
              color={getChipColor()}
            />
            <Typography variant="caption" color="text.secondary">
              Message #{index + 1}
            </Typography>
          </Box>
          
          {message.parts.map((part, partIndex) => (
            <Box key={partIndex}>
              {part.text && (
                <Box
                  sx={{
                    typography: 'body1',
                    whiteSpace: 'pre-wrap',
                    color: isUser ? 'primary.contrastText' : 'text.primary',
                    '& p': { m: 0, mb: 1 },
                    '& code': { bgcolor: 'grey.900', color: 'secondary.light', px: 0.5, borderRadius: 1 },
                    '& pre': { bgcolor: 'grey.900', p: 1, borderRadius: 1, overflow: 'auto' }
                  }}
                >
                  <ReactMarkdown>{part.text}</ReactMarkdown>
                </Box>
              )}
              <FunctionCallDisplay part={part} />
              <FunctionResponseDisplay part={part} />
            </Box>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ChatMessage;