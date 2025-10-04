import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useChat} from '@/hooks/useChat';

export function Chatbot () {
    const {messages, input, setInput, sendMessage} = useChat();

    return (
        <div className="flex flex-col h-full w-full border rounded-lg">
            <div className="flex-1 p-4 overflow-y-auto">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`p-2 my-1 rounded-lg max-w-[80%] ${
                            message.role === 'user'
                                ? 'bg-blue-500 text-white self-start'
                                : 'bg-gray-200 text-black self-end ml-auto'
                        }`}
                    >
                        {message.content}
                    </div>
                ))}
            </div>
            <div className="p-4 border-t">
                <div className="flex space-x-2">
                    <Input
                        value={input}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setInput(e.target.value)}
                        onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
                            e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                    />
                    <Button onClick={sendMessage}>Send</Button>
                </div>
            </div>
        </div>
    );
}
