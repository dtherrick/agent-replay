# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|------|---------|
| Dev server (with API) | `npm run dev` |
| Build (client + server) | `npm run build` |
| Build client only | `npm run build:client` |
| Build server only | `npm run build:server` |
| Lint | `npm run lint` |
| Run all tests | `npm test` |
| Run tests in watch mode | `npm run test:watch` |
| Run a single test file | `npx vitest run src/server/adapters/cursor.test.ts` |
| Standalone server | `node bin/agent-replay.mjs [--port 3000] [--open]` |

## Architecture

React + TypeScript app for replaying AI agent conversations (Cursor IDE, Gemini CLI, etc.) with animated playback. Uses Vite for dev, MUI for UI, Vitest + React Testing Library for tests.

### Two server modes

1. **Dev mode** (`npm run dev`): Vite dev server with a custom plugin (`src/server/plugin.ts`) that adds `/api/` middleware. This is the primary development workflow.
2. **Standalone mode** (`bin/agent-replay.mjs`): Express server bundled via esbuild (`esbuild.server.mjs`) from `src/server/standalone.ts`. Serves the built client from `dist/client/` and the same API routes. Published to npm as `@daherrick-splunk/agent-replay`.

### Adapter system

Source adapters live in `src/server/adapters/` and implement the `ChatSourceAdapter` interface (defined in `types.ts`). Each adapter provides `listProjects()`, `listConversations()`, and `loadConversation()`. Adapters are registered in `registry.ts`.

Current adapters: `cursor` (Cursor IDE transcripts, supports `.jsonl` and `.txt` formats), `gemini` (Gemini CLI from `~/.gemini/tmp/`), `samples` (bundled demo files in `samples/`).

All adapters normalize data into `UnifiedMessage` objects with roles: `user`, `assistant`, `thinking`, `tool_call`, `tool_result`, `subagent`.

### Frontend

- `App.tsx` — Layout with MUI drawer sidebar, theme toggle (light/dark persisted to localStorage)
- `ConversationBrowser.tsx` — Source/project/conversation selector in the sidebar
- `ChatContainer.tsx` — Playback engine: manages animation state, stepping, keyboard shortcuts (Space, Arrow keys, R)
- `ChatMessage.tsx` — Renders individual messages by role
- `SubagentReplay.tsx` — Expandable cards for nested subagent conversations
- `DisplayControls.tsx` — Visibility toggles (thinking, tool calls, tool results, subagents) and speed slider

### Type system

Types are duplicated between `src/types/chat.ts` (frontend, includes playback/animation types like `PlaybackMessage`, `ApprovalState`) and `src/server/adapters/types.ts` (server, defines `ChatSourceAdapter` interface). The `UnifiedMessage` type exists in both.

### API routes

All under `/api/`:
- `GET /api/sources` — list registered adapters
- `GET /api/sources/:id/projects` — list projects for a source
- `GET /api/sources/:id/conversations?projectId=` — list conversations
- `GET /api/sources/:id/conversations/:convId?projectId=` — load conversation messages

## Testing

Tests use Vitest with jsdom environment. Setup file at `src/test/setup.ts` stubs `scrollIntoView` and `window.scrollTo`. Component tests use React Testing Library. Test files are co-located with their source files (e.g., `cursor.test.ts` next to `cursor.ts`).
