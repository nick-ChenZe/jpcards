import {Toaster} from './components/ui/sonner';
import {Welcome} from './components/Welcome';

function App () {
    return (
        <div className="h-screen w-screen">
            <Welcome />
            <Toaster richColors position="top-right" />
        </div>
    );
}

export default App;
