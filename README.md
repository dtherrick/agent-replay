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

## Quick Start

```bash
git clone <repository-url>
cd agent-replay
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The sidebar will automatically discover your local Cursor projects and Gemini chat files.

> **Note:** The API that reads your local transcripts runs as a Vite dev server plugin, so `npm run dev` is the intended way to use this tool. The production build (`npm run build`) generates a static frontend only.

### Prerequisites

- Node.js (v18 or higher)
- npm
- `sqlite3` CLI (optional, for conversation titles -- install via `brew install sqlite3` on macOS or your system package manager)

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

## Testing

The test suite uses [Vitest](https://vitest.dev/) and covers the Cursor adapter (JSONL/TXT parsing, content extraction, error handling) and the API middleware (routing, error responses).

```bash
npm test              # single run
npm run test:watch    # watch mode -- re-runs on file changes
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the app (dev server with API middleware) |
| `npm test` | Run the test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Type-check and build static frontend |
| `npm run lint` | Run ESLint |

## License

This project is for demonstration purposes.
