# Agent Replay

A React application for browsing and playing back AI agent conversations with full fidelity -- including thinking, tool calls, approvals, and results. Supports multiple chat sources through a plugin adapter architecture.

## Supported Sources

- **Cursor IDE** -- Automatically discovers projects and conversations from your local Cursor agent transcripts, with titles and dates pulled from workspace metadata.
- **Gemini CLI** -- Loads conversations from the Google Gemini CLI chat history format.
- **Extensible** -- Add new sources (Codex, Claude Code, etc.) by implementing the `ChatSourceAdapter` interface.

## Features

- **Conversation Browser** -- Browse all your Cursor projects and conversations in a sidebar with titles and timestamps.
- **Animated Playback** -- Watch conversations unfold step-by-step with thinking animations, tool approval flows, and timed delays.
- **Configurable Display** -- Toggle visibility of thinking blocks, tool calls, and tool results. Adjust playback speed from 0.25x to 4x.
- **Multi-format Parsing** -- Cursor `.txt` transcripts (with `[Thinking]`, `[Tool call]`, `[Tool result]` markers) and `.jsonl` transcripts are both supported.
- **Cross-platform** -- Project discovery works on macOS, Linux, and Windows.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. The sidebar will automatically discover your local Cursor projects and Gemini chat files.

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── server/
│   ├── plugin.ts                # Vite dev plugin with API middleware
│   └── adapters/
│       ├── types.ts             # Adapter interface + UnifiedMessage types
│       ├── registry.ts          # Adapter registry
│       ├── gemini.ts            # Gemini CLI adapter
│       └── cursor.ts            # Cursor IDE adapter
├── components/
│   ├── ConversationBrowser.tsx  # Source/project/conversation selector
│   ├── DisplayControls.tsx      # Visibility toggles + speed slider
│   ├── ChatContainer.tsx        # Playback engine + message display
│   └── ChatMessage.tsx          # Message rendering (all types)
├── types/
│   └── chat.ts                  # Frontend type definitions
├── chat_history.json            # Sample Gemini CLI conversation
├── App.tsx                      # Layout with sidebar drawer
└── main.tsx                     # React entry point
```

## Adding a New Source Adapter

Implement the `ChatSourceAdapter` interface in `src/server/adapters/`:

```typescript
interface ChatSourceAdapter {
  id: string;
  name: string;
  listProjects(): Promise<ProjectInfo[]>;
  listConversations(projectId?: string): Promise<ConversationSummary[]>;
  loadConversation(conversationId: string, projectId?: string): Promise<UnifiedMessage[]>;
}
```

Then register it in `src/server/adapters/registry.ts`.

## Scripts

- `npm run dev` -- Start development server with API middleware
- `npm run build` -- Type-check and build for production
- `npm run preview` -- Preview production build
- `npm run lint` -- Run ESLint

## License

This project is for demonstration purposes.
