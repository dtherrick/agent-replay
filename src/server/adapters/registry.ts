import type { ChatSourceAdapter } from './types';
import { GeminiAdapter } from './gemini';
import { CursorAdapter } from './cursor';
import { SamplesAdapter } from './samples';

export class AdapterRegistry {
  private adapters = new Map<string, ChatSourceAdapter>();

  constructor(projectRoot: string) {
    this.register(new CursorAdapter());
    this.register(new GeminiAdapter());
    this.register(new SamplesAdapter(projectRoot));
  }

  register(adapter: ChatSourceAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id: string): ChatSourceAdapter | undefined {
    return this.adapters.get(id);
  }

  getSources(): Array<{ id: string; name: string }> {
    return Array.from(this.adapters.values()).map(a => ({ id: a.id, name: a.name }));
  }
}
