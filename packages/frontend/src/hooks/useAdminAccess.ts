import {useEffect, useState} from 'react';

/** 只看 `GET /api/me` 的 `isAdmin`。请求失败时当作不是管理员。 */
export function useAdminAccess () {
    const [admin, setAdmin] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch('/api/me', {credentials: 'include'});
                const body = response.ok
                    ? await response.json() as {isAdmin?: boolean;}
                    : null;
                if (!cancelled) {
                    setAdmin(body?.isAdmin === true);
                }
            } catch {
                if (!cancelled) {
                    setAdmin(false);
                }
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    return admin;
}
