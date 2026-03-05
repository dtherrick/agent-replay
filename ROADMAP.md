# Roadmap

## Recently Completed

- **Error handling and graceful degradation** -- Adapters, API layer, and frontend all handle missing files, corrupt data, and unavailable services without crashing.
- **Display preference persistence** -- Speed, thinking/tool visibility toggles stored in localStorage across sessions.
- **Conversation search** -- Filter conversations by title in the sidebar.
- **Gemini CLI adapter** -- Auto-discovers sessions from `~/.gemini/tmp/` with thinking block support.
- **Samples adapter and drag-and-drop** -- Bundled demo conversations in `samples/` plus drag-and-drop any `.json` file onto the app to play it back.
- **Test suite** -- 67 Vitest tests covering all adapters and the API layer.
- **Keyboard controls** -- Space (play/pause/resume), Arrow Right/Left (step forward/backward with pair-skipping), R (restart). Shortcuts are guarded against input focus and missing conversations. 15 component tests via React Testing Library.
- **Light / dark theme toggle** -- Switch in the sidebar Display Options panel toggles between light and dark MUI themes. Choice persists to localStorage. Hardcoded dark-mode colors replaced with theme-aware palette tokens. 10 tests (5 DisplayControls + 5 App).
- **Subagent conversation replay** -- Nested subagent conversations discovered from `subagents/` directories, placed inline via text-match heuristic, rendered as expandable cards. Toggle in Display Options. 11 tests (5 adapter + 6 component).
- **npm CLI distribution** -- Standalone Express server extracted from Vite plugin, esbuild-bundled. `npx agent-replay` launches the app locally. GitHub Actions workflow publishes to npm on version tags.

## Phase 1 -- UI and Usability

### In-Conversation Search

Search and highlight within the currently loaded conversation. A search bar above the message list that scrolls to and highlights matching messages.

### Favorite Conversations

Star or favorite conversations so they're easily accessible across sessions. Stored in localStorage, surfaced at the top of the conversation list or in a dedicated "Favorites" section in the sidebar.

## Phase 2 -- Source Adapters

Each adapter implements the existing `ChatSourceAdapter` interface and plugs in via the adapter registry.

### Claude Code (CLI)

Read conversation history from the Claude Code CLI local storage.

### OpenAI Codex CLI

Read conversation history from the Codex CLI local state.

### ChatGPT Export

Parse exported ChatGPT conversation archives (JSON export from the ChatGPT UI).
