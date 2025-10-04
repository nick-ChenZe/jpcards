import {usernameClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';
import {LoginForm} from './login-form';

export const authClient = createAuthClient({
    plugins: [
        usernameClient()
    ]
    /** The base URL of the server (optional if you're using the same domain) */
});

const {useSession} = authClient;
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
            <h1>Welcome to JPCards</h1>
            <button onClick={() => authClient.signOut()}>Sign Out</button>
        </div>
    );
};
