import {PromptInputSubmitProps} from '@/components/ui/shadcn-io/ai/prompt-input';
import axios from 'axios';
import constate from 'constate';
import {useState} from 'react';

export const [ChatProvider, useChat] = constate(() => {
    const [messages, setMessages] = useState<{role: 'user' | 'assistant'; content: string;}[]>(
        []
    );
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<PromptInputSubmitProps['status']>('ready')

    const sendMessage = async () => {
        setStatus('submitted');
        if (input.trim()) {
            const newMessages = [...messages, {role: 'user' as const, content: input}, {
                role: 'assistant' as const,
                content: ''
            }];
            setMessages(newMessages);
            setInput('');

            const stream = await axios.post(
                '/api/chat/stream',
                {message: input},
                {
                    responseType: 'stream',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream'
                    },
                    adapter: 'fetch'
                }
            );
            setStatus('streaming')
            const reader = stream.data.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    break;
                }
                const lines = decoder.decode(value).split('\n\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const chunk = line.replace(/^data: /, '');
                        const data = JSON.parse(chunk);
                        setMessages((prevMessages) => {
                            const lastMessage = prevMessages[prevMessages.length - 1];
                            const updatedLastMessage = {
                                ...lastMessage,
                                content: lastMessage.content + data.content
                            };
                            return [...prevMessages.slice(0, -1), updatedLastMessage];
                        });
                    }
                }
            }
            setStatus('ready');
        }
    };

    return {status, messages, input, setInput, sendMessage};
});
