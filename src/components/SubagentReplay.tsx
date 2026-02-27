import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  AccountTree as SubagentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import type { SubagentConversation } from '../types/chat';

interface SubagentReplayProps {
  subagent: SubagentConversation;
}

const SubagentReplay: React.FC<SubagentReplayProps> = ({ subagent }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ mb: 2 }}>
      <Card
        sx={{
          bgcolor: 'action.hover',
          borderRadius: 2,
          borderLeft: 3,
          borderColor: 'info.main',
        }}
      >
        <CardContent sx={{ '&:last-child': { pb: expanded ? 2 : 1.5 }, py: 1.5 }}>
          <Box
            onClick={() => setExpanded(!expanded)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <SubagentIcon color="info" sx={{ fontSize: 20 }} />
            <Typography variant="body2" fontWeight="bold" sx={{ flex: 1 }}>
              Subagent {subagent.id.substring(0, 8)}
            </Typography>
            <Chip
              label={`${subagent.messages.length} messages`}
              size="small"
              color="info"
              variant="outlined"
            />
            <IconButton size="small" sx={{ ml: 0.5 }}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={expanded} unmountOnExit>
            <Box sx={{ mt: 2, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
              {subagent.messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  message={{ ...msg, role: msg.role as 'user' | 'assistant' }}
                  index={i}
                />
              ))}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SubagentReplay;
