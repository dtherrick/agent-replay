# Roadmap

## Recently Completed

- **Error handling and graceful degradation** -- Adapters, API layer, and frontend all handle missing files, corrupt data, and unavailable services without crashing.
- **Display preference persistence** -- Speed, thinking/tool visibility toggles stored in localStorage across sessions.
- **Conversation search** -- Filter conversations by title in the sidebar.
- **Gemini CLI adapter** -- Auto-discovers sessions from `~/.gemini/tmp/` with thinking block support.
- **Samples adapter and drag-and-drop** -- Bundled demo conversations in `samples/` plus drag-and-drop any `.json` file onto the app to play it back.
- **Test suite** -- 67 Vitest tests covering all adapters and the API layer.

## Phase 1 -- UI and Usability

### Keyboard Controls

Add keyboard shortcuts for playback:

- **Space** -- Play / pause
- **Arrow Right** -- Step forward one message
- **Arrow Left** -- Step backward one message
- **R** -- Restart playback

### Light / Dark Theme Toggle

The app is currently hardcoded to dark mode. Add a toggle (sidebar or top bar) that switches the MUI theme and persists the choice to localStorage.

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
