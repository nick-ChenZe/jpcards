import {UserSession} from '@/lib/auth';

export const Nav = ({session}: {session: UserSession;}) => {
    const username = session.name?.trim();
    return (
        <div>
            <p className="text-xl font-semibold">{username ? `你好，${username}` : '你好'}</p>
        </div>
    );
};
