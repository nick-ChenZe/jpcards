import {Toaster} from './components/ui/sonner';
import {Welcome} from './components/Welcome';
import {ChatProvider} from './hooks/useChat';

function App () {
    return (
        <ChatProvider>
            <div className="h-screen w-screen">
                <Welcome />
                <Toaster richColors position="top-right" />
            </div>
        </ChatProvider>
    );
}

export default App;
