import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Source as SourceIcon,
} from '@mui/icons-material';
import type { SourceInfo, ProjectInfo, ConversationInfo } from '../types/chat';

interface ConversationBrowserProps {
  onSelectConversation: (conversation: ConversationInfo) => void;
  selectedConversationId?: string;
}

const ConversationBrowser: React.FC<ConversationBrowserProps> = ({
  onSelectConversation,
  selectedConversationId,
}) => {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/sources')
      .then(r => r.json())
      .then((data: SourceInfo[]) => {
        setSources(data);
        if (data.length > 0) {
          setSelectedSource(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedSource) return;
    setProjects([]);
    setSelectedProject('');
    setConversations([]);

    fetch(`/api/sources/${selectedSource}/projects`)
      .then(r => r.json())
      .then((data: ProjectInfo[]) => {
        setProjects(data);
        if (data.length === 1) {
          setSelectedProject(data[0].id);
        }
      })
      .catch(console.error);
  }, [selectedSource]);

  useEffect(() => {
    if (!selectedSource || !selectedProject) return;
    setConversations([]);
    setLoading(true);

    fetch(`/api/sources/${selectedSource}/conversations?projectId=${selectedProject}`)
      .then(r => r.json())
      .then((data: ConversationInfo[]) => {
        setConversations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedSource, selectedProject]);

  const formatDate = (ms?: number) => {
    if (!ms) return '';
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SourceIcon />
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>
          Chat Sources
        </Typography>
      </Box>

      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Source</InputLabel>
        <Select
          value={selectedSource}
          label="Source"
          onChange={e => setSelectedSource(e.target.value)}
        >
          {sources.map(s => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {projects.length > 1 && (
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Project</InputLabel>
          <Select
            value={selectedProject}
            label="Project"
            onChange={e => setSelectedProject(e.target.value)}
          >
            {projects.map(p => (
              <MenuItem key={p.id} value={p.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon sx={{ fontSize: 16 }} />
                  {p.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {projects.length === 1 && (
        <Chip
          icon={<FolderIcon />}
          label={projects[0].name}
          size="small"
          sx={{ mb: 2, alignSelf: 'flex-start' }}
        />
      )}

      <Divider sx={{ mb: 1 }} />

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        Conversations ({conversations.length})
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      <List dense sx={{ flex: 1, overflow: 'auto', mx: -2, px: 0 }}>
        {conversations.map(conv => (
          <ListItemButton
            key={conv.id}
            selected={conv.id === selectedConversationId}
            onClick={() => onSelectConversation(conv)}
            sx={{ px: 2, py: 1 }}
          >
            <ListItemText
              primary={conv.title}
              secondary={formatDate(conv.updatedAt)}
              primaryTypographyProps={{
                variant: 'body2',
                noWrap: true,
                fontWeight: conv.id === selectedConversationId ? 600 : 400,
              }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItemButton>
        ))}
        {!loading && conversations.length === 0 && selectedProject && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            No conversations found.
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default ConversationBrowser;
