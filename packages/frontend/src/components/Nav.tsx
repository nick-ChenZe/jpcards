import {Session} from "@/lib/auth";

export const Nav = ({session}: {session: Session}) => {
    const username = session.data?.user.username;
    return (
        <div>
            <h1>Hi, {username}</h1>
        </div>
    );
}