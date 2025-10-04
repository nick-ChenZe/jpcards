import {Conversation, ConversationContent, ConversationScrollButton} from '@/components/ui/shadcn-io/ai/conversation';
import {Message, MessageAvatar, MessageContent} from '@/components/ui/shadcn-io/ai/message';
import {Response} from '@/components/ui/shadcn-io/ai/response';
import {useChat} from '@/hooks/useChat';

export const ChatMessages = () => {
    const {messages} = useChat();
    return (
        <Conversation className="relative size-full" style={{height: '498px'}}>
            <ConversationContent>
                {messages.map(({role, content}, index) => {
                    if (role === 'user') {
                        return (
                            <Message from="user" key={index}>
                                <MessageContent>{content}</MessageContent>
                                <MessageAvatar
                                    name="User"
                                    src="https://github.com/dovazencot.png"
                                />
                            </Message>
                        );
                    }
                    return (
                        <Message from="assistant" key={index}>
                            <Response>{content}</Response>
                            <MessageAvatar
                                name="Assistant"
                                src="https://github.com/openai.png"
                            />
                        </Message>
                    );
                })}
            </ConversationContent>
            <ConversationScrollButton />
        </Conversation>
    );
};
