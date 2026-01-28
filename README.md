# StockSavvy Chat Simulator

A React-based chat simulator demo that displays a technical support conversation about investigating a database connection pool exhaustion issue. Built with React, TypeScript, Vite, and Material-UI.

## 🚀 Features

- **Interactive Chat Interface**: Displays a realistic support conversation between a user and AI assistant
- **Technical Investigation Flow**: Shows the process of investigating database issues using Confluence runbooks and Splunk logs
- **Expandable Function Calls**: View detailed function calls and responses in collapsible sections
- **Modern UI**: Built with Material-UI components for a clean, professional look
- **Responsive Design**: Works well on desktop and mobile devices

## 🛠️ Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast development and build tool
- **Material-UI (MUI)** - Professional React component library
- **Emotion** - CSS-in-JS styling

## 📋 Chat Content

The chat demonstrates a real-world SRE (Site Reliability Engineering) scenario where:

1. A support engineer receives a "database connection pool exhaustion" alert
2. They search Confluence for the relevant runbook
3. They investigate using Splunk logs to identify the root cause
4. They provide a detailed analysis and recommended next steps

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd react-splunk-mcp-demo
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## 📁 Project Structure

```
src/
├── components/
│   ├── ChatContainer.tsx    # Main chat container component
│   └── ChatMessage.tsx      # Individual message component
├── types/
│   └── chat.ts              # TypeScript interfaces for chat data
├── chat_history.json        # The actual chat conversation data
├── App.tsx                  # Main app component with theme setup
└── main.tsx                 # React entry point
```

## 🎨 Features Breakdown

### Message Types
- **User Messages**: Questions and requests from the support engineer
- **Assistant Messages**: AI responses with analysis and actions
- **Function Calls**: API calls to external services (Confluence, Splunk)
- **Function Responses**: Results from API calls with detailed output

### UI Components
- **Expandable sections** for function calls and responses
- **Color-coded messages** (user vs assistant)
- **Professional styling** with Material-UI
- **Responsive layout** that works on all screen sizes

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📝 Chat Data Format

The chat history is stored in JSON format with the following structure:

```typescript
interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

interface ChatPart {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}
```

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is for demonstration purposes.