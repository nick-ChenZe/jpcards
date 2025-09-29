import { useState } from 'react';

export function useChat() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    if (input.trim()) {
      const newMessages = [...messages, { role: 'user' as const, content: input }, { role: 'assistant' as const, content: '' }];
      setMessages(newMessages);
      setInput('');

      const eventSource = new EventSource(`http://localhost:8000/api/chat/stream?message=${encodeURIComponent(input)}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.error('SSE Error:', data.error);
          eventSource.close();
          return;
        }

        if (data.content === '[DONE]') {
          eventSource.close();
          return;
        }

        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          const updatedLastMessage = { ...lastMessage, content: lastMessage.content + data.content };
          return [...prevMessages.slice(0, -1), updatedLastMessage];
        });
      };

      eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        eventSource.close();
      };
    }
  };

  return { messages, input, setInput, sendMessage };
}