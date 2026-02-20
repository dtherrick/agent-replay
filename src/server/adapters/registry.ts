import type { ChatSourceAdapter } from './types';
import { GeminiAdapter } from './gemini';
import { CursorAdapter } from './cursor';
import { join } from 'path';

export class AdapterRegistry {
  private adapters = new Map<string, ChatSourceAdapter>();

  constructor(projectRoot: string) {
    this.register(new GeminiAdapter(join(projectRoot, 'src')));
    this.register(new CursorAdapter());
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
