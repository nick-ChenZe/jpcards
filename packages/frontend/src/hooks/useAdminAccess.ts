import {useEffect, useState} from 'react';

/** 只反映服务端 `ADMIN_EMAILS` 的判断。请求失败时当作不是管理员。 */
export function useAdminAccess () {
    const [admin, setAdmin] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch('/api/me', {credentials: 'include'});
                const body = response.ok
                    ? await response.json() as {admin?: boolean;}
                    : null;
                if (!cancelled) {
                    setAdmin(Boolean(body?.admin));
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
