import { Router, Request, Response } from 'express';
import { getChatCompletionStream } from '../message/completion.js';

const router = Router();

// GET /api/chat/stream (SSE)
router.post('/stream', async (req: Request, res: Response) => {
  const { message, conversationId } = req.body;

  if (typeof message !== 'string') {
    res.status(400).json({ error: 'Message must be a string' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of getChatCompletionStream(message, conversationId)) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
  } catch (error) {
    console.error('Error getting chat completion stream:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to get chat completion' })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;