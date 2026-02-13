import {usernameClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';

export const authClient = createAuthClient({
    plugins: [
        usernameClient()
    ]
});

export const {useSession, signIn, signOut} = authClient;

export type Session = NonNullable<ReturnType<typeof useSession>['data']>['session'];
export type UserSession = NonNullable<ReturnType<typeof useSession>['data']>['user'];