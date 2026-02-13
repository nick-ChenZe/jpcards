import {Session, UserSession} from "@/lib/auth";

export const Nav = ({session}: {session: UserSession}) => {
    const username = session.name
    return (
        <div>
            <h1>Hi, {username}</h1>
        </div>
    );
}