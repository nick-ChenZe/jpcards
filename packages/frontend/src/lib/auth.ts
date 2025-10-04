import {usernameClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';

export const {useSession, signIn, signOut} = createAuthClient({
    plugins: [
        usernameClient()
    ]
});

export type Session = ReturnType<typeof useSession>;