export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionResponse {
  id: string;
  name: string;
  response: {
    output: string;
  };
}

export interface ChatPart {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

export interface ApprovalState {
  status: 'pending' | 'approved' | 'rejected' | 'ended';
  action?: 'yes' | 'no' | 'end';
}

export interface ChatMessageType {
  role: 'user' | 'model' | 'system' | 'approval' | 'thinking';
  parts: ChatPart[];
  approval?: ApprovalState;
  functionCallToApprove?: FunctionCall;
  isAnimating?: boolean;
}

export type ChatHistory = ChatMessageType[];