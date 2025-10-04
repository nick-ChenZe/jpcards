import {ChatInputBox} from "./ChatInputBox"
import {ChatMessages} from "./ChatMessages"

export const Chatbot = () => {
    return (
        <div>
            <ChatMessages />
            <ChatInputBox />
        </div>
    )
}