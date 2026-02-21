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
  Alert,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Source as SourceIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import type { SourceInfo, ProjectInfo, ConversationInfo } from '../types/chat';

interface ConversationBrowserProps {
  onSelectConversation: (conversation: ConversationInfo) => void;
  selectedConversationId?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
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
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setError(null);
    fetchJson<SourceInfo[]>('/api/sources')
      .then((data) => {
        setSources(data);
        if (data.length > 0) {
          setSelectedSource(data[0].id);
        }
      })
      .catch((err) => setError(`Could not load sources: ${err.message}`));
  }, []);

  useEffect(() => {
    if (!selectedSource) return;
    setProjects([]);
    setSelectedProject('');
    setConversations([]);
    setError(null);

    fetchJson<ProjectInfo[]>(`/api/sources/${selectedSource}/projects`)
      .then((data) => {
        setProjects(data);
        if (data.length === 1) {
          setSelectedProject(data[0].id);
        }
      })
      .catch((err) => setError(`Could not load projects: ${err.message}`));
  }, [selectedSource]);

  useEffect(() => {
    if (!selectedSource || !selectedProject) return;
    setConversations([]);
    setLoading(true);
    setError(null);
    setSearchQuery('');

    fetchJson<ConversationInfo[]>(
      `/api/sources/${selectedSource}/conversations?projectId=${selectedProject}`
    )
      .then((data) => {
        setConversations(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(`Could not load conversations: ${err.message}`);
        setLoading(false);
      });
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

      {error && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Divider sx={{ mb: 1 }} />

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        Conversations ({conversations.length})
      </Typography>

      {conversations.length > 0 && (
        <TextField
          size="small"
          placeholder="Filter conversations..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 1 }}
        />
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      <List dense sx={{ flex: 1, overflow: 'auto', mx: -2, px: 0 }}>
        {conversations
          .filter(conv => {
            if (!searchQuery.trim()) return true;
            return conv.title.toLowerCase().includes(searchQuery.toLowerCase());
          })
          .map(conv => (
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
        {!loading && !error && conversations.length === 0 && selectedProject && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            No conversations found in this project.
          </Typography>
        )}
        {!loading && !error && projects.length === 0 && selectedSource && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            No projects found. Make sure Cursor is installed and you have agent transcripts.
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default ConversationBrowser;
