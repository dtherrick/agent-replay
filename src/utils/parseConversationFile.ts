import type { UnifiedMessage } from '../types/chat';

interface GeminiApiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { id: string; name: string; response: { output: string } };
}

interface GeminiApiMessage {
  role: 'user' | 'model';
  parts: GeminiApiPart[];
}

function parseGeminiApi(messages: GeminiApiMessage[]): UnifiedMessage[] {
  const result: UnifiedMessage[] = [];

  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.functionCall) {
        result.push({
          role: 'tool_call',
          content: part.functionCall.name,
          toolCall: {
            name: part.functionCall.name,
            args: Object.fromEntries(
              Object.entries(part.functionCall.args).map(([k, v]) => [k, String(v)])
            ),
          },
        });
      } else if (part.functionResponse) {
        result.push({
          role: 'tool_result',
          content: part.functionResponse.response.output,
          toolResult: {
            name: part.functionResponse.name,
            output: part.functionResponse.response.output,
          },
        });
      } else if (part.text) {
        result.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: part.text,
        });
      }
    }
  }

  return result;
}

export function parseConversationFile(text: string): UnifiedMessage[] {
  const data = JSON.parse(text);

  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    const first = data[0];

    if (first.role && first.parts) {
      return parseGeminiApi(data as GeminiApiMessage[]);
    }

    if (first.role && typeof first.content === 'string') {
      return data as UnifiedMessage[];
    }
  }

  throw new Error('Unrecognized conversation format');
}
