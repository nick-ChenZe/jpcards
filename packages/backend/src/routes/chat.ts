import { Router, Request, Response } from 'express';
import { getChatCompletionStream } from '../../chat';
import {writeFile} from 'fs/promises';

const router = Router();

// GET /api/chat/stream (SSE)
router.get('/stream', async (req: Request, res: Response) => {
  const { message } = req.query;

  if (typeof message !== 'string') {
    res.status(400).json({ error: 'Message must be a string' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await getChatCompletionStream(message);
    for await (const chunk of stream) {
      await writeFile('./log', JSON.stringify(chunk), {encoding: 'utf-8', flag: 'a+'});
      const content = chunk.choices[0]?.delta?.content || '';
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  } catch (error) {
    console.error('Error getting chat completion stream:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to get chat completion' })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;