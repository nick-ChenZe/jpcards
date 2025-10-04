import {
    PromptInput,
    PromptInputButton,
    PromptInputModelSelect,
    PromptInputModelSelectContent,
    PromptInputModelSelectItem,
    PromptInputModelSelectTrigger,
    PromptInputModelSelectValue,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools
} from '@/components/ui/shadcn-io/ai/prompt-input';
import {useChat} from '@/hooks/useChat';
import {PaperclipIcon} from 'lucide-react';
import {useCallback} from 'react';

export const ChatInputBox = () => {
    const {status, input, setInput, sendMessage} = useChat();
    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            sendMessage();
        },
        [sendMessage]
    );
    return (
        <div className="p-8 w-full">
            <PromptInput onSubmit={handleSubmit}>
                <PromptInputTextarea
                    onChange={(e) => setInput(e.target.value)}
                    value={input}
                    placeholder="Type your message..."
                />
                <PromptInputToolbar>
                    <div></div>
                    <PromptInputSubmit disabled={!input} status={status} />
                </PromptInputToolbar>
            </PromptInput>
        </div>
    );
};
