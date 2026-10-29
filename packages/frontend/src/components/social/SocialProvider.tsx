import {incomingBanner, type IncomingLetters, socialApi, type SocialOverview} from '@/lib/social';
import {createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';

interface SocialContextValue {
    overview: SocialOverview | null;
    error: string;
    refresh: () => Promise<void>;
    setThreadPresence: (id: string, atBottom: boolean | null) => void;
}
const SocialContext = createContext<SocialContextValue | null>(null);
export const useOptionalSocial = () => useContext(SocialContext);
export const useSocial = () => {
    const context = useContext(SocialContext);
    if (!context) throw new Error('SocialProvider is required');
    return context;
};

export function SocialProvider ({children, userId}: {children: ReactNode; userId: string;}) {
    const [overview, setOverview] = useState<SocialOverview | null>(null);
    const [error, setError] = useState('');
    const [banner, setBanner] = useState<{text: string; path: string;} | null>(null);
    const previous = useRef<SocialOverview | null>(null);
    const letterCursor = useRef<number | null>(null);
    const activeThread = useRef<{id: string; atBottom: boolean;} | null>(null);
    const busy = useRef(false);
    const navigate = useNavigate();

    const setThreadPresence = useCallback((id: string, atBottom: boolean | null) => {
        if (atBottom === null) {
            if (activeThread.current?.id === id) activeThread.current = null;
        } else activeThread.current = {id, atBottom};
    }, []);

    const refresh = useCallback(async () => {
        if (busy.current || document.visibilityState === 'hidden') return;
        busy.current = true;
        try {
            const data = await socialApi<SocialOverview>();
            if (data.me.id !== userId) return;
            const last = previous.current;
            const latest = Number.isSafeInteger(data.summary.latestLetterSeq) ? data.summary.latestLetterSeq : 0;
            let letter: IncomingLetters['items'][number] | undefined;
            if (letterCursor.current === null) letterCursor.current = latest;
            else if (latest > letterCursor.current && !data.preferences.letters) letterCursor.current = latest;
            else if (latest > letterCursor.current) {
                try {
                    let cursor = letterCursor.current, hasMore = true, pages = 0;
                    while (hasMore && pages++ < 10) {
                        const changes = await socialApi<IncomingLetters>(`/incoming?after=${cursor}`);
                        // 当前会话自己处理底部已读与阅读历史时的“有新来信”。
                        letter = incomingBanner(changes.items, activeThread.current?.id) || letter;
                        const next = Math.max(cursor, changes.nextAfter || 0);
                        if (changes.hasMore && next === cursor) throw new Error('INCOMING_CURSOR_STALLED');
                        cursor = next;
                        hasMore = changes.hasMore;
                    }
                    letterCursor.current = hasMore ? cursor : Math.max(cursor, latest);
                } catch {
                    // 无法判断来源时保留游标，下次重新获取；未读数仍由 overview 保留。
                    letter = undefined;
                }
            }
            if (last) {
                if (data.preferences.letters && letter) {
                    setBanner({
                        text: `${letter.peer.name || letter.peer.handle} 寄来一封信。`,
                        path: `/friend/thread/${encodeURIComponent(letter.conversationId)}`
                    });
                } else if (data.preferences.requests && data.summary.requests > last.summary.requests) {
                    setBanner({text: '有位新朋友，向你递来一份缘。', path: '/friend/requests'});
                } else if (data.preferences.system && data.summary.notices > last.summary.notices) {
                    setBanner({text: '有一条新的好友回音。', path: '/friend/inbox?tab=notices'});
                }
            }
            previous.current = data;
            setOverview(data);
            setError('');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : '暂时无法读取好友与来信。');
        } finally {
            busy.current = false;
        }
    }, [userId]);

    useEffect(() => {
        void refresh();
        const timer = window.setInterval(() => void refresh(), 15000);
        const onVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [refresh]);
    useEffect(() => {
        if (!banner) return;
        const timer = setTimeout(() => setBanner(null), 5000);
        return () => clearTimeout(timer);
    }, [banner]);

    return (
        <SocialContext.Provider value={{overview, error, refresh, setThreadPresence}}>
            {children}
            {banner && (
                <div className="rizha-letter-banner" role="status">
                    <button
                        type="button"
                        onClick={() => {
                            navigate(banner.path);
                            setBanner(null);
                        }}
                    >
                        {banner.text}
                        <span>打开 ↗</span>
                    </button>
                    <button type="button" aria-label="收起来信提醒" onClick={() => setBanner(null)}>×</button>
                </div>
            )}
        </SocialContext.Provider>
    );
}
