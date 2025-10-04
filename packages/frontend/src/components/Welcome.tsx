import {LoginForm} from './LoginForm';
import {Chatbot} from './Chatbot';
import {Nav} from './Nav';
import {useSession} from '@/lib/auth';

export const Welcome = () => {
    const session = useSession();
    if (session.isPending) {
        return <div>Loading...</div>;
    }

    if (!session.data) {
        return (
            <div className="w-full h-full flex justify-center items-center">
                <LoginForm />
            </div>
        );
    }

    return (
        <div>
            <Nav session={session} />
            <Chatbot />
        </div>
    );
};
