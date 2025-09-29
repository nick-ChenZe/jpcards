import { describe, it, expect } from 'vitest';
import { getChatCompletionStream } from './chat';
import { Stream } from 'openai/streaming';

describe('getChatCompletionStream', () => {
  it('should return a stream', async () => {
    const stream = await getChatCompletionStream('hello');
    expect(stream).toBeInstanceOf(Stream);

    let content = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        content += delta;
      }
    }

    console.log(content);
    expect(content).toBeTypeOf('string');
    expect(content.length).toBeGreaterThan(0);
  }, 30000);
});