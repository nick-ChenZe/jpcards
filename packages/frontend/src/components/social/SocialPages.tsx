import {TodayCard} from '@/components/TodayCard';
import {sharedSentenceHtml} from '@/lib/sharedCardText';
import {
    type ConversationSummary,
    appendOutbox,
    applyShareVerifications,
    concealSharedPreviews,
    mergeLetters,
    noticeReadCutoff,
    type OutgoingLetter,
    type PageResult,
    prepareSharedLetter,
    readLocal,
    reconcileOutbox,
    restoreOutbox,
    type SharedCard,
    type ShareVerification,
    socialApi,
    socialDate,
    type SocialMessage,
    type SocialNotice,
    type SocialPreferences,
    type SocialThread,
    type SocialUser,
    socialWrite,
    writeLocal
} from '@/lib/social';
import {useSocial} from './SocialProvider';
import '@/styles/social.css';
import {
    ArrowLeft,
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    Mail,
    MoreHorizontal,
    Plus,
    Search,
    Send,
    Settings2,
    X
} from 'lucide-react';
import {type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Link, useLocation, useNavigate, useSearchParams} from 'react-router-dom';
import {toast} from 'sonner';

const enc = encodeURIComponent;
const messageOf = (error: unknown) => error instanceof Error ? error.message : '这一页暂时没有展开，请再试一次。';
const nameMark = (user: SocialUser) => [...(user.name || user.handle || '友')][0];

/** Only previously loaded cards outside the fresh thread page need individual checks. */
async function verifyOlderShares (items: SocialMessage[]): Promise<ShareVerification[]> {
    const ids = [...new Set(items.filter(item => item.type === 'card' && item.cardVerification === 'checking')
        .map(item => item.shareId || item.id))];
    const checks: ShareVerification[] = [];
    let cursor = 0;
    async function worker () {
        while (cursor < ids.length) {
            const id = ids[cursor++];
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 8000);
            try {
                const result = await socialApi<{revoked: boolean; card: SharedCard | null;}>(
                    `/shares/${enc(id)}`, {signal: controller.signal}
                );
                if (result.revoked) checks.push({id, state: 'revoked'});
                else if (result.card && typeof result.card.sentence === 'string' && typeof result.card.gloss === 'string') {
                    checks.push({id, state: 'available', card: {
                        sentence: result.card.sentence, gloss: result.card.gloss, level: result.card.level
                    }});
                } else checks.push({id, state: 'unavailable'});
            } catch {
                checks.push({id, state: 'unavailable'});
            } finally {
                clearTimeout(timeout);
            }
        }
    }
    await Promise.all(Array.from({length: Math.min(6, ids.length)}, () => worker()));
    return checks;
}
function Portrait ({user, large = false}: {user: SocialUser; large?: boolean;}) {
    return <span className={`rz-portrait${large ? ' large' : ''}`} aria-hidden="true">{nameMark(user)}</span>;
}
function Backbar ({title, back = '/friend', children}: {title: string; back?: string; children?: ReactNode;}) {
    return (
        <div className="rz-backbar">
            <Link className="rz-icon" to={back} aria-label="返回">
                <ArrowLeft size={20} />
            </Link>
            <h1>{title}</h1>
            {children || <span className="rz-icon" />}
        </div>
    );
}
function ErrorPanel ({message, onRetry}: {message: string; onRetry?: () => void;}) {
    return (
        <div className="rz-error" role="alert">
            <p>{message}</p>
            {onRetry && <button type="button" onClick={onRetry}>重新翻开 →</button>}
        </div>
    );
}
function Empty ({mark = '縁', title, children}: {mark?: string; title: string; children: ReactNode;}) {
    return (
        <div className="rz-empty">
            <span aria-hidden="true">{mark}</span>
            <h2>{title}</h2>
            {children}
        </div>
    );
}
function Pagination ({page, hasNext, onPage}: {page: number; hasNext: boolean; onPage: (page: number) => void;}) {
    return (
        <div className="rz-pagination">
            <button type="button" aria-label="上一页" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                <ChevronLeft size={18} />
            </button>
            <span>第 {page} 页</span>
            <button type="button" aria-label="下一页" disabled={!hasNext} onClick={() => onPage(page + 1)}>
                <ChevronRight size={18} />
            </button>
        </div>
    );
}
function Modal ({title, children, onClose}: {title: string; children: ReactNode; onClose: () => void;}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);
    return (
        <dialog
            className="rz-dialog"
            ref={ref}
            onCancel={event => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="rz-dialog-heading">
                <h2>{title}</h2>
                <button type="button" className="rz-icon" onClick={onClose} aria-label="关闭">
                    <X size={20} />
                </button>
            </div>
            {children}
        </dialog>
    );
}
function useAction () {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const running = useRef(false);
    const run = async (action: () => Promise<void>) => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (requestError) {
            setError(messageOf(requestError));
        } finally {
            running.current = false;
            setBusy(false);
        }
    };
    return {busy, error, run};
}

export const FriendPage = () => {
    const parts = useLocation().pathname.split('/').filter(Boolean), kind = parts[1] || 'home', id = parts[2];
    const {overview, error, refresh} = useSocial();
    if (!overview) {
        return (
            <div className="rz-social">
                {error
                    ? (
                        <ErrorPanel
                            message={error}
                            onRetry={() => void refresh()}
                        />
                    )
                    : <p className="rz-loading" role="status">正在打开这本同行手帖…</p>}
            </div>
        );
    }
    return (
        <div className={`rz-social${kind === 'thread' ? ' is-thread' : ''}`}>
            {kind === 'home'
                ? <FriendsHome />
                : kind === 'invite'
                ? <InvitePage />
                : kind === 'requests'
                ? <RequestsPage />
                : kind === 'inbox'
                ? <InboxPage />
                : kind === 'preferences'
                ? <PreferencesPage />
                : kind === 'profile' && id
                ? <ProfilePage key={id} id={id} />
                : kind === 'thread' && id
                ? <ThreadPage key={id} id={id} />
                : kind === 'share' && id
                ? <SharedPage key={id} id={id} />
                : (
                    <>
                        <Backbar title="这一页还没落笔" />
                        <Empty title="没有找到这本手帖。">
                            <Link to="/friend">回到好友 →</Link>
                        </Empty>
                    </>
                )}
        </div>
    );
};

function FriendsHome () {
    const {overview, error, refresh} = useSocial();
    const [page, setPage] = useState(1), [params, setParams] = useSearchParams();
    const shareId = params.get('share'), navigate = useNavigate(), action = useAction(), data = overview!;
    const total = data.friends.length, actualPage = Math.min(page, Math.max(1, Math.ceil(total / 3)));
    return (
        <>
            <header className="rz-heading">
                <div>
                    <p>ともだち / A LITTLE TOGETHER</p>
                    <h1>纸上的缘分</h1>
                </div>
                <Link className="rz-icon" to="/friend/inbox" aria-label={`来信，${data.summary.total}条待看`}>
                    <Mail size={23} />
                    {data.summary.total > 0 && (
                        <b className="rz-badge">{data.summary.total > 99 ? '99+' : data.summary.total}</b>
                    )}
                </Link>
            </header>
            {(error || action.error) && <ErrorPanel message={action.error || error} onRetry={() => void refresh()} />}
            {data.incoming.length > 0 && (
                <Link className="rz-request-strip" to="/friend/requests">
                    <span>縁</span>
                    <span>
                        <strong>{data.incoming.length} 位新朋友，想与你结缘</strong>
                        <small>彼此确认后，才能互寄书信。</small>
                    </span>
                    <ArrowUpRight size={16} />
                </Link>
            )}
            <div className="rz-invite-paper">
                <span className="rz-seal" aria-hidden="true">縁</span>
                <div>
                    <h2>好句子，也想寄给你。</h2>
                    <p>一个人慢慢学，和喜欢的人一起走。</p>
                    <Link to="/friend/invite">
                        邀请一位朋友 <ArrowUpRight size={15} />
                    </Link>
                </div>
            </div>
            <div className="rz-section-title">
                <h2>
                    同行的人 <small>{total} 位</small>
                </h2>
                <Link className="rz-icon" to="/friend/invite" aria-label="添加好友">
                    <Plus size={21} />
                </Link>
            </div>
            {total
                ? (
                    <div className="rz-friends-list">
                        {data.friends.slice((actualPage - 1) * 3, actualPage * 3).map(friend => (
                            <div className="rz-friend-row" key={friend.id}>
                                <Link className="rz-person-link" to={`/friend/profile/${enc(friend.id)}`}>
                                    <Portrait user={friend} />
                                    <span>
                                        <strong>{friend.name || friend.handle}</strong>
                                        <small>{friend.handle}</small>
                                    </span>
                                </Link>
                                <button
                                    type="button"
                                    className="rz-text"
                                    disabled={action.busy}
                                    onClick={() =>
                                        void action.run(async () => {
                                            const result = friend.conversationId
                                                ? {id: friend.conversationId}
                                                : await socialWrite<{id: string;}>('/conversations', {
                                                    userId: friend.id
                                                });
                                            navigate(`/friend/thread/${enc(result.id)}`);
                                        })}
                                >
                                    寄一句 <ArrowUpRight size={15} />
                                </button>
                            </div>
                        ))}
                        <Pagination page={actualPage} hasNext={actualPage * 3 < total} onPage={setPage} />
                    </div>
                )
                : (
                    <Empty title="第一位同伴，会是谁？">
                        <p>把你的日札号，递给一位认识的人。</p>
                        <Link to="/friend/invite">邀请第一位朋友 →</Link>
                    </Empty>
                )}
            <p className="rz-endnote">
                <span>不必热闹，偶尔问候。</span>
                <span>一期一会</span>
            </p>
            <Link className="rz-preferences-link" to="/friend/preferences">
                <Settings2 size={15} /> 来信与隐私偏好
            </Link>
            {shareId && <ShareRecipients cardId={shareId} onClose={() => setParams({})} />}
        </>
    );
}

function InvitePage () {
    const {overview, refresh} = useSocial(),
        [query, setQuery] = useState(''),
        [result, setResult] = useState<{user: SocialUser; relationship: string;} | null>(null),
        action = useAction();
    async function find () {
        if (!query.trim()) return;
        setResult(null);
        await action.run(async () => setResult(await socialApi(`/search?handle=${enc(query.trim())}`)));
    }
    return (
        <>
            <Backbar title="把缘分递出去" />
            <p className="rz-copy">把日札号告诉朋友，或找到一位认识的人。</p>
            <div className="rz-id-card">
                <span>我的日札号{!overview!.preferences.discoverable && ' · 搜索已关闭'}</span>
                <strong>{overview!.me.handle}</strong>
                <small>
                    {overview!.preferences.discoverable
                        ? '收下一句日语，也收下一位同伴。'
                        : '别人暂时不能用这个号码找到你。'}
                </small>
            </div>
            <button
                type="button"
                className="rz-secondary"
                onClick={() => {
                    if (!navigator.clipboard?.writeText) {
                        toast('可以长按上方日札号复制。');
                        return;
                    }
                    void navigator.clipboard.writeText(overview!.me.handle).then(() => toast('日札号已复制。')).catch(
                        () => toast('可以长按上方日札号复制。')
                    );
                }}
            >
                复制我的日札号
            </button>
            <form
                className="rz-search"
                onSubmit={event => {
                    event.preventDefault();
                    void find();
                }}
            >
                <label htmlFor="rz-handle">查找日札号 / 用户名</label>
                <div>
                    <input
                        id="rz-handle"
                        autoCapitalize="none"
                        autoComplete="off"
                        maxLength={64}
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="输入完整日札号或用户名"
                    />
                    <button
                        type="submit"
                        className="rz-icon"
                        disabled={action.busy || !query.trim()}
                        aria-label="查找好友"
                    >
                        <Search size={20} />
                    </button>
                </div>
            </form>
            {action.busy && <p className="rz-copy" role="status">正在找这份缘…</p>}
            {action.error && <ErrorPanel message={action.error} />}
            {result && (
                <div className="rz-search-result">
                    <Portrait user={result.user} />
                    <div>
                        <strong>{result.user.name}</strong>
                        <small>{result.user.handle}</small>
                        <p>
                            {result.relationship === 'self'
                                ? '这是你自己的日札号。'
                                : result.relationship === 'friend'
                                ? '你们已经是同行的朋友。'
                                : result.relationship === 'outgoing'
                                ? '申请已递出，等一封回信。'
                                : result.relationship === 'incoming'
                                ? '对方也向你递来了一份缘。'
                                : '彼此确认后，就能互寄书信。'}
                        </p>
                    </div>
                    {result.relationship === 'none'
                        ? (
                            <button
                                type="button"
                                className="rz-text"
                                disabled={action.busy}
                                onClick={() =>
                                    void action.run(async () => {
                                        const response = await socialWrite<{relationship: 'friend' | 'outgoing';}>(
                                            '/requests',
                                            {userId: result.user.id}
                                        );
                                        setResult({...result, relationship: response.relationship});
                                        await refresh();
                                    })}
                            >
                                递出申请
                            </button>
                        )
                        : result.relationship === 'incoming'
                        ? <Link to="/friend/requests">去收下 →</Link>
                        : null}
                </div>
            )}
            <p className="rz-footnote">
                仅按完整日札号或用户名查找，不读取通讯录。<br />你的邮箱、词库和完整日签墙不会公开。
            </p>
        </>
    );
}

function RequestsPage () {
    const {overview, refresh} = useSocial(),
        [page, setPage] = useState(1),
        action = useAction(),
        requests = overview!.incoming,
        actualPage = Math.min(page, Math.max(1, Math.ceil(requests.length / 3)));
    return (
        <>
            <Backbar title="新的相遇" back="/friend/inbox?tab=notices" />
            <p className="rz-copy">
                彼此确认，才成为好友。<br />通过前，对方不能给你发送私信。
            </p>
            {action.error && <ErrorPanel message={action.error} />}
            {requests.length
                ? (
                    <>
                        <div className="rz-request-list">
                            {requests.slice((actualPage - 1) * 3, actualPage * 3).map(request => (
                                <article className="rz-request-paper" key={request.id}>
                                    <div>
                                        <Portrait user={request.sender} />
                                        <span>
                                            <h2>{request.sender.name}</h2>
                                            <small>{request.sender.handle}</small>
                                        </span>
                                    </div>
                                    <p>向你递来一份缘 · {socialDate(request.createdAt)}</p>
                                    <div>
                                        <button
                                            type="button"
                                            disabled={action.busy}
                                            onClick={() =>
                                                void action.run(async () => {
                                                    await socialWrite(`/requests/${enc(request.id)}`, {
                                                        action: 'decline'
                                                    });
                                                    await refresh();
                                                })}
                                        >
                                            暂不结缘
                                        </button>
                                        <button
                                            type="button"
                                            className="accept"
                                            disabled={action.busy}
                                            onClick={() =>
                                                void action.run(async () => {
                                                    await socialWrite(`/requests/${enc(request.id)}`, {
                                                        action: 'accept'
                                                    });
                                                    await refresh();
                                                    toast('已经结缘，写下第一句问候吧。');
                                                })}
                                        >
                                            收下这份缘
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                        <Pagination page={actualPage} hasNext={actualPage * 3 < requests.length} onPage={setPage} />
                    </>
                )
                : (
                    <Empty title="回音都收好了。">
                        <p>新的相遇，会慢慢到来。</p>
                        <Link to="/friend">看看同行的朋友 →</Link>
                    </Empty>
                )}
            {overview!.outgoing.length > 0 && (
                <div className="rz-outgoing">
                    <h2>已递出的缘</h2>
                    {overview!.outgoing.map(request => (
                        <p key={request.id}>
                            <span>{request.recipient.name}</span>
                            <small>等待确认</small>
                        </p>
                    ))}
                </div>
            )}
            <p className="rz-footnote">暂不结缘时，对方不会收到拒绝通知。</p>
        </>
    );
}

function InboxPage () {
    const {overview, refresh} = useSocial(),
        [params, setParams] = useSearchParams(),
        tab = params.get('tab') === 'notices' ? 'notices' : 'letters';
    const [page, setPage] = useState(1),
        [letters, setLetters] = useState<PageResult<ConversationSummary> | null>(null),
        [notices, setNotices] = useState<PageResult<SocialNotice> | null>(null),
        [error, setError] = useState(''),
        [loading, setLoading] = useState(true),
        [notice, setNotice] = useState<SocialNotice | null>(null),
        [retry, setRetry] = useState(0),
        action = useAction();
    const noticeCutoff = useRef(0);
    const load = useCallback(async () => {
        if (document.visibilityState === 'hidden') return;
        try {
            if (tab === 'letters') setLetters(await socialApi(`/conversations?page=${page}`));
            else {
                const data = await socialApi<PageResult<SocialNotice>>(`/notifications?page=${page}`);
                noticeCutoff.current = noticeReadCutoff(data.maxId);
                setNotices(data);
            }
            setError('');
        } catch (requestError) {
            setError(messageOf(requestError));
        } finally {
            setLoading(false);
        }
    }, [tab, page]);
    useEffect(() => {
        setLoading(true);
        void load();
        const timer = setInterval(() => void load(), 15000);
        return () => clearInterval(timer);
    }, [load, retry]);
    const items = tab === 'letters' ? letters?.items || [] : notices?.items || [];
    return (
        <>
            <header className="rz-heading">
                <div>
                    <p>お便り / LETTER BOX</p>
                    <h1>来信</h1>
                </div>
                <Link className="rz-icon" aria-label="消息与隐私偏好" to="/friend/preferences">
                    <MoreHorizontal size={22} />
                </Link>
            </header>
            <div className="rz-tabs" role="tablist" aria-label="来信分类">
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'letters'}
                    onClick={() => {
                        setPage(1);
                        setParams({});
                    }}
                >
                    书信 <small>{overview!.summary.letters || ''}</small>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'notices'}
                    onClick={() => {
                        setPage(1);
                        setParams({tab: 'notices'});
                    }}
                >
                    通知 <small>{overview!.summary.requests + overview!.summary.notices || ''}</small>
                </button>
            </div>
            {(error || action.error) && (
                <ErrorPanel
                    message={action.error || error}
                    onRetry={() => setRetry(value => value + 1)}
                />
            )}
            {tab === 'notices' && (
                <>
                    <Link to="/friend/requests" className="rz-request-strip">
                        <span>縁</span>
                        <span>
                            <strong>新朋友</strong>
                            <small>
                                {overview!.incoming.length
                                    ? `${overview!.incoming.length} 位朋友，想与你结缘`
                                    : '新的相遇，会慢慢到来。'}
                            </small>
                        </span>
                        <b>{overview!.incoming.length || '→'}</b>
                    </Link>
                    <div className="rz-section-title">
                        <small>日札小报与好友回音</small>
                        <button
                            type="button"
                            className="rz-text"
                            disabled={action.busy || !overview!.summary.notices || !noticeCutoff.current}
                            onClick={() => {
                                const through = noticeCutoff.current;
                                void action.run(async () => {
                                    await socialWrite('/notifications/read', {through}, 'PUT');
                                    await refresh();
                                    await load();
                                });
                            }}
                        >
                            通知全部已读
                        </button>
                    </div>
                </>
            )}
            {loading && !items.length
                ? <p className="rz-loading" role="status">正在翻开来信…</p>
                : tab === 'letters'
                ? (
                    <div role="tabpanel" aria-label="书信">
                        {letters?.items.length
                            ? letters.items.map(item => (
                                <Link className="rz-mail-row" key={item.id} to={`/friend/thread/${enc(item.id)}`}>
                                    <span className="rz-portrait-wrap">
                                        <Portrait user={item.peer} />
                                        {item.unread > 0 && (
                                            <b className="rz-badge">{item.unread > 99 ? '99+' : item.unread}</b>
                                        )}
                                    </span>
                                    <span>
                                        <span className="rz-mail-heading">
                                            <strong>{item.peer.name}{!item.canSend && <em>已归档</em>}</strong>
                                            <time>{socialDate(item.lastAt)}</time>
                                        </span>
                                        <small>
                                            {item.lastMessage?.type === 'card'
                                                ? item.lastMessage.revoked
                                                    ? '这张日签已收回'
                                                    : `${
                                                        item.lastMessage.senderId === overview!.me.id
                                                            ? '我寄出'
                                                            : '寄来'
                                                    }一张日签 · ${item.lastMessage.card?.sentence || ''}`
                                                : `${item.lastMessage?.senderId === overview!.me.id ? '我：' : ''}${
                                                    item.lastMessage?.text || '写一句问候，开始第一封信。'
                                                }`}
                                        </small>
                                    </span>
                                </Link>
                            ))
                            : (
                                <Empty mark="信" title="第一封信，写给谁？">
                                    <p>从一句问候开始。</p>
                                    <Link to="/friend">去看看好友 →</Link>
                                </Empty>
                            )}
                    </div>
                )
                : (
                    <div role="tabpanel" aria-label="通知">
                        {notices?.items.length
                            ? notices.items.map(item => (
                                <button
                                    className={`rz-notice${item.read ? '' : ' unread'}`}
                                    key={item.id}
                                    type="button"
                                    onClick={() =>
                                        void action.run(async () => {
                                            await socialWrite('/notifications/read', {id: item.id}, 'PUT');
                                            setNotice({...item, read: true});
                                            await refresh();
                                            await load();
                                        })}
                                >
                                    <span>縁</span>
                                    <span>
                                        <strong>{item.title}</strong>
                                        <small>{item.body}</small>
                                        <time>{socialDate(item.createdAt)}</time>
                                    </span>
                                    {!item.read && <i aria-label="未读" />}
                                </button>
                            ))
                            : <p className="rz-footnote">新的回音，会留在这里。</p>}
                    </div>
                )}
            <Pagination
                page={page}
                hasNext={Boolean(tab === 'letters' ? letters?.hasMore : notices?.hasMore)}
                onPage={setPage}
            />
            <p className="rz-mail-footer">有空再回，每句话都可以慢慢写。</p>
            {notice && (
                <Modal title={notice.title} onClose={() => setNotice(null)}>
                    <p className="rz-copy">{notice.body}</p>
                    <p className="rz-footnote">{socialDate(notice.createdAt)}</p>
                    <button type="button" className="rz-secondary" onClick={() => setNotice(null)}>收好了</button>
                </Modal>
            )}
        </>
    );
}

function PreferencesPage () {
    const {overview, refresh} = useSocial(), action = useAction();
    const rows: [keyof SocialPreferences, string, string][] = [
        ['letters', '好友书信提示', '关闭后，来信和未读仍会保留。'],
        ['requests', '新朋友提示', '有人向你递来一份缘。'],
        ['system', '日札小报提示', '只提醒与你有关的变化。'],
        ['discoverable', '允许日札号搜索', '关闭后，陌生人无法通过号码找到你。']
    ];
    return (
        <>
            <Backbar title="让问候，轻一点" />
            <p className="rz-copy">
                只在站内提醒，不申请系统推送权限。<br />不显示在线状态，也不提供已读回执。
            </p>
            {action.error && <ErrorPanel message={action.error} />}
            {rows.map(([key, title, copy]) => (
                <div className="rz-setting" key={key}>
                    <span>
                        <strong>{title}</strong>
                        <small>{copy}</small>
                    </span>
                    <button
                        type="button"
                        className="rz-toggle"
                        role="switch"
                        aria-label={title}
                        aria-checked={overview!.preferences[key]}
                        disabled={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await socialWrite('/preferences', {[key]: !overview!.preferences[key]}, 'PUT');
                                await refresh();
                            })}
                    >
                        <i />
                    </button>
                </div>
            ))}
            <div className="rz-section-title">
                <h2>已屏蔽的人</h2>
                <small>{overview!.blocked.length} 位</small>
            </div>
            {overview!.blocked.length
                ? overview!.blocked.map(user => (
                    <div className="rz-friend-row" key={user.id}>
                        <span className="rz-person-link">
                            <Portrait user={user} />
                            <span>
                                <strong>{user.name}</strong>
                                <small>{user.handle}</small>
                            </span>
                        </span>
                        <button
                            type="button"
                            className="rz-text"
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(async () => {
                                    await socialWrite(`/blocks/${enc(user.id)}`, undefined, 'DELETE');
                                    await refresh();
                                    toast('已解除屏蔽，再次结缘需要重新申请。');
                                })}
                        >
                            解除屏蔽
                        </button>
                    </div>
                ))
                : <p className="rz-footnote">暂时没有屏蔽的人。</p>}
            <p className="rz-footnote">
                解除屏蔽不会自动恢复好友关系。<br />好友只能看到你主动寄出的日签，无法访问完整日签墙或邮箱。
            </p>
        </>
    );
}

function ProfilePage ({id}: {id: string;}) {
    const [profile, setProfile] = useState<
            {
                user: SocialUser;
                friend: boolean;
                since?: number;
                shared: {id: string; card: {sentence: string; gloss: string; level: string;};}[];
            } | null
        >(null),
        [error, setError] = useState(''),
        [retry, setRetry] = useState(0),
        [options, setOptions] = useState(false),
        action = useAction(),
        navigate = useNavigate();
    useEffect(() => {
        const controller = new AbortController();
        void socialApi<NonNullable<typeof profile>>(`/profile/${enc(id)}`, {signal: controller.signal}).then(setProfile)
            .catch(error => {
                if (!controller.signal.aborted) setError(messageOf(error));
            });
        return () => controller.abort();
    }, [id, retry]);
    return (
        <>
            <Backbar title="同行手帖">
                {profile && (
                    <button
                        type="button"
                        className="rz-icon"
                        aria-label="好友设置"
                        onClick={() => setOptions(true)}
                    >
                        <MoreHorizontal size={22} />
                    </button>
                )}
            </Backbar>
            {error || action.error
                ? (
                    <ErrorPanel
                        message={action.error || error}
                        onRetry={() => {
                            setError('');
                            setRetry(value => value + 1);
                        }}
                    />
                )
                : !profile
                ? <p className="rz-loading" role="status">正在打开同行手帖…</p>
                : (
                    <>
                        <div className="rz-profile">
                            <Portrait user={profile.user} large />
                            <div>
                                <h2>{profile.user.name}</h2>
                                <small>{profile.user.handle}</small>
                                <p>{profile.friend ? '一起学习的朋友' : '既有书信已归档'}</p>
                                {profile.since && (
                                    <span>
                                        {Math.max(1, Math.floor((Date.now() - profile.since) / 86400000) + 1)} 天同行
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="rz-section-title">
                            <h2>主动寄来的日签</h2>
                        </div>
                        <p className="rz-footnote">只展示对方向你明确分享的内容。</p>
                        <div className="rz-profile-shares">
                            {profile.shared.length
                                ? profile.shared.map(share => (
                                    <Link key={share.id} to={`/friend/share/${enc(share.id)}`}>
                                        <small>{share.card.level} · 轻触重读</small>
                                        <p lang="ja">{share.card.sentence}</p>
                                        <span>{share.card.gloss}</span>
                                        <ArrowUpRight size={17} />
                                    </Link>
                                ))
                                : (
                                    <Empty mark="札" title="等下一张日签落笔。">
                                        <p>不必着急，从一句问候开始。</p>
                                    </Empty>
                                )}
                        </div>
                        {profile.friend
                            ? (
                                <button
                                    type="button"
                                    className="rz-primary"
                                    disabled={action.busy}
                                    onClick={() =>
                                        void action.run(async () => {
                                            const result = await socialWrite<{id: string;}>('/conversations', {
                                                userId: id
                                            });
                                            navigate(`/friend/thread/${enc(result.id)}`);
                                        })}
                                >
                                    给{profile.user.name}写封信 <Mail size={18} />
                                </button>
                            )
                            : <Link className="rz-secondary" to="/friend/invite">重新递出一份缘 →</Link>}
                        <p className="rz-footnote">你的日签墙，依然只属于你。</p>
                    </>
                )}
            {options && profile && (
                <FriendOptions
                    user={profile.user}
                    canSend={profile.friend}
                    onClose={() => setOptions(false)}
                    onChanged={() => setRetry(value => value + 1)}
                />
            )}
        </>
    );
}

function FriendOptions (
    {user, conversationId, canSend, muted = false, onClose, onChanged}: {
        user: SocialUser;
        conversationId?: string;
        canSend: boolean;
        muted?: boolean;
        onClose: () => void;
        onChanged: () => void;
    }
) {
    const {refresh} = useSocial(),
        [confirm, setConfirm] = useState<'remove' | 'block' | 'report' | null>(null),
        [reason, setReason] = useState(''),
        action = useAction(),
        navigate = useNavigate();
    return (
        <Modal
            title={confirm === 'remove'
                ? '把这段同行，收好'
                : confirm === 'block'
                ? '屏蔽这位用户？'
                : confirm === 'report'
                ? '告诉我们发生了什么'
                : `与${user.name}的书信`}
            onClose={onClose}
        >
            {action.error && <ErrorPanel message={action.error} />}
            {confirm === 'remove'
                ? (
                    <>
                        <p className="rz-copy">解除后不能继续寄信。既有书信仍保留，重新结缘需要再次确认。</p>
                        <button
                            type="button"
                            className="rz-primary"
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(async () => {
                                    await socialWrite(`/friends/${enc(user.id)}`, undefined, 'DELETE');
                                    await refresh();
                                    onClose();
                                    navigate('/friend');
                                    toast('好友关系已解除，既有书信已归档。');
                                })}
                        >
                            确认解除
                        </button>
                    </>
                )
                : confirm === 'block'
                ? (
                    <>
                        <p className="rz-copy">
                            屏蔽后，对方不能查找你、向你申请或寄信。已有书信保留。可在隐私偏好中解除屏蔽。
                        </p>
                        <button
                            type="button"
                            className="rz-primary"
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(async () => {
                                    await socialWrite(`/blocks/${enc(user.id)}`);
                                    await refresh();
                                    onClose();
                                    navigate('/friend');
                                    toast('已屏蔽这位用户。');
                                })}
                        >
                            确认屏蔽
                        </button>
                    </>
                )
                : confirm === 'report'
                ? (
                    <>
                        <label className="rz-field">
                            举报原因<textarea
                                maxLength={1000}
                                value={reason}
                                onChange={event => setReason(event.target.value)}
                                placeholder="请描述骚扰、垃圾信息或其他问题"
                            />
                        </label>
                        <p className="rz-footnote">举报内容仅用于处理违规问题，不会发送给对方。</p>
                        <button
                            type="button"
                            className="rz-primary"
                            disabled={action.busy || !reason.trim()}
                            onClick={() =>
                                void action.run(async () => {
                                    await socialWrite('/reports', {userId: user.id, reason});
                                    onClose();
                                    toast('举报已收下，感谢你帮助保护这份安静。');
                                })}
                        >
                            提交举报
                        </button>
                    </>
                )
                : (
                    <>
                        {conversationId && (
                            <div className="rz-setting">
                                <span>
                                    <strong>这位好友的来信提示</strong>
                                    <small>关闭后，书信仍会留在来信中。</small>
                                </span>
                                <button
                                    type="button"
                                    className="rz-toggle"
                                    role="switch"
                                    aria-label="这位好友的来信提示"
                                    aria-checked={!muted}
                                    disabled={action.busy}
                                    onClick={() =>
                                        void action.run(async () => {
                                            await socialWrite(`/conversations/${enc(conversationId)}/mute`, {
                                                muted: !muted
                                            }, 'PUT');
                                            await refresh();
                                            onChanged();
                                            onClose();
                                        })}
                                >
                                    <i />
                                </button>
                            </div>
                        )}
                        {canSend && (
                            <button
                                type="button"
                                className="rz-danger"
                                onClick={() => setConfirm('remove')}
                            >
                                解除好友关系
                            </button>
                        )}
                        <button type="button" className="rz-danger" onClick={() => setConfirm('block')}>
                            屏蔽这位用户
                        </button>
                        <button type="button" className="rz-text" onClick={() => setConfirm('report')}>
                            举报不适当的往来
                        </button>
                        <p className="rz-footnote">不显示在线状态，也不提供已读回执。</p>
                    </>
                )}
            {confirm && (
                <button
                    type="button"
                    className="rz-secondary"
                    disabled={action.busy}
                    onClick={() => setConfirm(null)}
                >
                    先返回
                </button>
            )}
        </Modal>
    );
}

function ShareRecipients ({cardId, onClose}: {cardId: string; onClose: () => void;}) {
    const {overview, refresh} = useSocial(), navigate = useNavigate(), action = useAction();
    return (
        <Modal title="把这张日签寄给谁？" onClose={onClose}>
            <p className="rz-copy">只分享选中的这一张，不开放你的日签墙。</p>
            {action.error && <ErrorPanel message={action.error} />}
            {overview!.friends.length
                ? (
                    <div className="rz-recipient-list">
                        {overview!.friends.map(user => (
                            <button
                                type="button"
                                key={user.id}
                                disabled={action.busy}
                                onClick={() =>
                                    void action.run(async () => {
                                        const conversation = await socialWrite<{id: string;}>('/conversations', {
                                            userId: user.id
                                        });
                                        const key = `rizha-outbox:${overview!.me.id}:${conversation.id}`;
                                        const pending = prepareSharedLetter(
                                            readLocal<unknown>(key, []),
                                            cardId,
                                            () => crypto.randomUUID()
                                        );
                                        if (!writeLocal(key, pending.outbox)) {
                                            throw new Error('浏览器暂时无法保存待寄日签，请恢复存储后再试。');
                                        }
                                        await socialWrite(`/conversations/${enc(conversation.id)}/messages`, {
                                            clientMessageId: pending.letter.clientMessageId,
                                            type: 'card',
                                            cardId
                                        });
                                        writeLocal(
                                            key,
                                            restoreOutbox(readLocal<unknown>(key, [])).filter(item =>
                                                item.clientMessageId !== pending.letter.clientMessageId
                                            )
                                        );
                                        await refresh();
                                        onClose();
                                        navigate(`/friend/thread/${enc(conversation.id)}`);
                                    })}
                            >
                                <Portrait user={user} />
                                <span>
                                    <strong>{user.name}</strong>
                                    <small>{user.handle}</small>
                                </span>
                                <ArrowUpRight size={19} />
                            </button>
                        ))}
                    </div>
                )
                : (
                    <Empty title="还没有同行的朋友。">
                        <p>先彼此确认，再把喜欢的一句寄出去。</p>
                        <Link to="/friend/invite" onClick={onClose}>去邀请一位朋友 →</Link>
                    </Empty>
                )}
        </Modal>
    );
}

function CardPicker (
    {onPick, onClose}: {
        onPick: (card: {id: string; sentence: string; gloss: string; level: string;}) => void;
        onClose: () => void;
    }
) {
    const [page, setPage] = useState(1),
        [cards, setCards] = useState<
            | {
                items: {id: string; sentence: string; gloss: string; level: string;}[];
                pagination: {totalPages: number;};
            }
            | null
        >(null),
        [error, setError] = useState(''),
        [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setError('');
        void fetch(`/api/history?page=${page}&pageSize=5`, {credentials: 'include', signal: controller.signal}).then(
            async response => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.message || '暂时无法打开日签墙。');
                setCards(body);
            }
        ).catch(error => {
            if (!controller.signal.aborted) setError(messageOf(error));
        });
        return () => controller.abort();
    }, [page, retry]);
    return (
        <Modal title="附上一张日签" onClose={onClose}>
            <p className="rz-copy">从你自己的日签中，选一句寄给朋友。</p>
            {error
                ? <ErrorPanel message={error} onRetry={() => setRetry(value => value + 1)} />
                : !cards
                ? <p role="status" className="rz-copy">正在翻开日签墙…</p>
                : cards.items.length
                ? (
                    <>
                        <div className="rz-card-choices">
                            {cards.items.map(card => (
                                <button
                                    type="button"
                                    key={card.id}
                                    onClick={() => onPick(card)}
                                >
                                    <span>
                                        <small>{card.level || '日札'} · 我的日签</small>
                                        <strong lang="ja">{card.sentence}</strong>
                                        {card.gloss && <p>{card.gloss}</p>}
                                    </span>
                                    <ArrowUpRight size={18} />
                                </button>
                            ))}
                        </div>
                        <Pagination page={page} hasNext={page < cards.pagination.totalPages} onPage={setPage} />
                    </>
                )
                : (
                    <Empty mark="札" title="先留下一句自己的日语。">
                        <p>抽一枚日签，再把喜欢的一句寄给朋友。</p>
                        <Link to="/explore">去抽今日签 →</Link>
                    </Empty>
                )}
        </Modal>
    );
}

function SharedPage ({id}: {id: string;}) {
    const [data, setData] = useState<
            {id: string; card: SharedCard | null; sender: SocialUser; revoked: boolean;} | null
        >(null),
        [error, setError] = useState(''),
        [retry, setRetry] = useState(0),
        [confirm, setConfirm] = useState(false),
        action = useAction(),
        {overview} = useSocial();
    useEffect(() => {
        const controller = new AbortController();
        setError('');
        void socialApi<NonNullable<typeof data>>(`/shares/${enc(id)}`, {signal: controller.signal}).then(setData).catch(
            error => {
                if (!controller.signal.aborted) setError(messageOf(error));
            }
        );
        return () => controller.abort();
    }, [id, retry]);
    return (
        <>
            <Backbar
                title={data?.sender.id === overview!.me.id ? '我寄出的日签' : '朋友寄来的一札'}
                back="/friend/inbox"
            />
            {error
                ? <ErrorPanel message={error} onRetry={() => setRetry(value => value + 1)} />
                : !data
                ? <p className="rz-loading" role="status">正在展开这张日签…</p>
                : data.revoked || !data.card
                ? (
                    <Empty mark="札" title="这张日签已收回。">
                        <p>书信还在，这一句暂时收好了。</p>
                    </Empty>
                )
                : (
                    <>
                        <p className="rz-footnote">
                            {data.sender.id === overview!.me.id ? '我' : data.sender.name}主动分享 ·
                            仅这段书信的双方可见
                        </p>
                        <div className="rz-shared-reading">
                            <TodayCard
                                sentenceHtml={sharedSentenceHtml(data.card.sentence)}
                                reading={data.card.reading}
                                readingTokens={data.card.readingTokens}
                                gloss={data.card.gloss}
                                imageUrl={data.card.illustrationUrl}
                                audioUrl={data.card.audioUrl}
                                meta={data.card.level}
                            />
                        </div>
                        {data.sender.id === overview!.me.id && (
                            <button
                                type="button"
                                className="rz-danger"
                                onClick={() => setConfirm(true)}
                            >
                                收回这张日签的分享
                            </button>
                        )}
                    </>
                )}
            {confirm && (
                <Modal title="收回这张日签？" onClose={() => setConfirm(false)}>
                    <p className="rz-copy">对方将无法再打开这个分享，你自己的日签仍保留。</p>
                    {action.error && <ErrorPanel message={action.error} />}
                    <button
                        type="button"
                        className="rz-primary"
                        disabled={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await socialWrite(`/shares/${enc(id)}`, undefined, 'DELETE');
                                setConfirm(false);
                                setRetry(value => value + 1);
                            })}
                    >
                        确认收回
                    </button>
                </Modal>
            )}
        </>
    );
}

function ThreadPage ({id}: {id: string;}) {
    const {overview, refresh, setThreadPresence} = useSocial(), me = overview!.me;
    const draftKey = `rizha-draft:${me.id}:${id}`, outboxKey = `rizha-outbox:${me.id}:${id}`;
    const [draft, setDraft] = useState(() => {
        const saved = readLocal<unknown>(draftKey, '');
        return typeof saved === 'string' ? saved.slice(0, 4000) : '';
    });
    const [outbox, setOutbox] = useState<OutgoingLetter[]>(() => restoreOutbox(readLocal<unknown>(outboxKey, [])));
    const [thread, setThread] = useState<SocialThread | null>(null),
        [error, setError] = useState(''),
        [options, setOptions] = useState(false),
        [picker, setPicker] = useState(false),
        [olderBusy, setOlderBusy] = useState(false),
        [newMail, setNewMail] = useState(false);
    const threadRef = useRef<SocialThread | null>(null),
        outboxRef = useRef(outbox),
        area = useRef<HTMLDivElement>(null),
        previewHeights = useRef(new Map<string, number>()),
        atBottom = useRef(true),
        first = useRef(true),
        prepend = useRef<{height: number; top: number;} | null>(null),
        busy = useRef(false),
        readSeq = useRef(0),
        sending = useRef(new Set<string>()),
        disposed = useRef(false),
        warnStorage = useRef(false);
    const updateOutbox = useCallback((update: (previous: OutgoingLetter[]) => OutgoingLetter[]) => {
        const next = update(outboxRef.current);
        outboxRef.current = next;
        if (!writeLocal(outboxKey, next) && !warnStorage.current) {
            warnStorage.current = true;
            toast('浏览器暂时不能保存草稿，请保持这一页打开。');
        }
        setOutbox(next);
    }, [outboxKey]);
    const saveDraft = (value: string) => {
        setDraft(value);
        if (!writeLocal(draftKey, value) && !warnStorage.current) {
            warnStorage.current = true;
            toast('浏览器暂时不能保存草稿，请保持这一页打开。');
        }
    };
    const markRead = useCallback(async () => {
        const current = threadRef.current, element = area.current;
        if (
            !current || !element || document.visibilityState !== 'visible'
            || element.scrollHeight - element.scrollTop - element.clientHeight > 40
        ) return;
        const seq = current.items.at(-1)?.seq || 0;
        if (seq <= readSeq.current) return;
        const previous = readSeq.current;
        readSeq.current = seq;
        try {
            await socialWrite(`/conversations/${enc(id)}/read`, {seq}, 'PUT');
            await refresh();
        } catch {
            readSeq.current = previous;
        }
    }, [id, refresh]);
    const load = useCallback(async () => {
        if (busy.current || document.visibilityState === 'hidden') return;
        busy.current = true;
        try {
            let current = threadRef.current;
            if (current) {
                area.current?.querySelectorAll<HTMLElement>('[data-shared-message]').forEach(element => {
                    if (element.dataset.sharedMessage) {
                        previewHeights.current.set(element.dataset.sharedMessage, element.offsetHeight);
                    }
                });
                current = {...current, items: concealSharedPreviews(current.items, 'checking')};
                threadRef.current = current;
                setThread(current);
            }
            let data = await socialApi<SocialThread>(`/conversations/${enc(id)}`);
            let incoming = data.items;
            if (current?.items.length) {
                let cursor = current.items.at(-1)!.seq;
                if (data.items[0]?.seq > cursor + 1) {
                    let more = true;
                    while (more) {
                        const delta = await socialApi<SocialThread>(`/conversations/${enc(id)}?after=${cursor}`);
                        incoming = mergeLetters(incoming, delta.items);
                        const last = delta.items.at(-1)?.seq || cursor;
                        more = delta.hasMore && last > cursor;
                        cursor = last;
                    }
                }
                data = {
                    ...data,
                    items: mergeLetters(current.items, incoming),
                    hasMore: current.hasMore,
                    nextBefore: current.nextBefore
                };
                if (!atBottom.current && (data.items.at(-1)?.seq || 0) > (current.items.at(-1)?.seq || 0)) {
                    setNewMail(true);
                }
            }
            data = {...data, items: applyShareVerifications(data.items, await verifyOlderShares(data.items))};
            if (disposed.current) return;
            const latestCurrent = threadRef.current;
            if (latestCurrent && latestCurrent !== current) {
                data = {
                    ...data,
                    items: mergeLetters(latestCurrent.items, data.items),
                    hasMore: latestCurrent.hasMore,
                    nextBefore: latestCurrent.nextBefore
                };
            }
            threadRef.current = data;
            setThread(data);
            setError('');
            updateOutbox(previous => reconcileOutbox(previous, data.items, me.id));
        } catch (requestError) {
            if (!disposed.current) {
                const current = threadRef.current;
                if (current) {
                    const safe = {...current, items: concealSharedPreviews(current.items, 'unavailable')};
                    threadRef.current = safe;
                    setThread(safe);
                }
                setError(messageOf(requestError));
            }
        } finally {
            busy.current = false;
        }
    }, [id, me.id, updateOutbox]);
    useEffect(() => {
        disposed.current = false;
        setThreadPresence(id, true);
        void load();
        const timer = setInterval(() => void load(), 15000);
        const visible = () => {
            if (document.visibilityState === 'visible') {
                void load();
                void markRead();
            }
        };
        document.addEventListener('visibilitychange', visible);
        window.addEventListener('focus', visible);
        return () => {
            disposed.current = true;
            setThreadPresence(id, null);
            clearInterval(timer);
            document.removeEventListener('visibilitychange', visible);
            window.removeEventListener('focus', visible);
        };
    }, [id, load, markRead, setThreadPresence]);
    useLayoutEffect(() => {
        const element = area.current;
        if (!element || !thread) return;
        if (prepend.current) {
            element.scrollTop = element.scrollHeight - prepend.current.height + prepend.current.top;
            prepend.current = null;
        } else if (first.current || atBottom.current) {
            element.scrollTop = element.scrollHeight;
            first.current = false;
            atBottom.current = true;
            void markRead();
        }
    }, [thread, outbox, markRead]);
    async function older () {
        if (!thread?.hasMore || olderBusy) return;
        setOlderBusy(true);
        try {
            const data = await socialApi<SocialThread>(
                `/conversations/${enc(id)}?before=${thread.items[0]?.seq || thread.nextBefore}`
            );
            if (area.current) prepend.current = {height: area.current.scrollHeight, top: area.current.scrollTop};
            const current = threadRef.current;
            if (!current) return;
            const next = {
                ...current,
                items: mergeLetters(data.items, current.items),
                hasMore: data.hasMore,
                nextBefore: data.nextBefore
            };
            threadRef.current = next;
            setThread(next);
        } catch (requestError) {
            setError(messageOf(requestError));
        } finally {
            setOlderBusy(false);
        }
    }
    async function deliver (letter: OutgoingLetter) {
        if (sending.current.has(letter.clientMessageId)) return;
        if (!threadRef.current?.canSend) {
            updateOutbox(previous =>
                previous.map(item =>
                    item.clientMessageId === letter.clientMessageId
                        ? {...item, status: 'failed', error: '当前不能寄信，重新结缘后可以重试。'}
                        : item
                )
            );
            return;
        }
        sending.current.add(letter.clientMessageId);
        updateOutbox(previous =>
            previous.map(item =>
                item.clientMessageId === letter.clientMessageId ? {...item, status: 'sending', error: ''} : item
            )
        );
        try {
            const message = await socialWrite<SocialMessage>(`/conversations/${enc(id)}/messages`, {
                clientMessageId: letter.clientMessageId,
                type: letter.type,
                ...(letter.type === 'text' ? {text: letter.text} : {cardId: letter.cardId})
            });
            if (disposed.current) {
                const pending = restoreOutbox(readLocal<unknown>(outboxKey, [])).filter(item =>
                    item.clientMessageId !== letter.clientMessageId
                );
                writeLocal(outboxKey, pending);
                return;
            }
            const current = threadRef.current;
            if (current) {
                const next = {...current, items: mergeLetters(current.items, [message])};
                threadRef.current = next;
                setThread(next);
            }
            updateOutbox(previous => previous.filter(item => item.clientMessageId !== letter.clientMessageId));
            await refresh();
        } catch (requestError) {
            const message = messageOf(requestError);
            if (disposed.current) {
                const pending = restoreOutbox(readLocal<unknown>(outboxKey, [])).map(item =>
                    item.clientMessageId === letter.clientMessageId
                        ? {...item, status: 'failed' as const, error: message}
                        : item
                );
                writeLocal(outboxKey, pending);
                return;
            }
            updateOutbox(previous =>
                previous.map(item =>
                    item.clientMessageId === letter.clientMessageId ? {...item, status: 'failed', error: message} : item
                )
            );
            void load();
        } finally {
            sending.current.delete(letter.clientMessageId);
        }
    }
    function sendText () {
        const text = draft.trim();
        if (!text) return;
        if (!threadRef.current?.canSend) {
            setError('当前不能寄信，你的草稿仍会保留。');
            void load();
            return;
        }
        if ([...text].length > 1000) {
            setError('这封信有些长，请控制在 1,000 字以内。');
            return;
        }
        const letter: OutgoingLetter = {clientMessageId: crypto.randomUUID(), type: 'text', text, status: 'sending'};
        const next = appendOutbox(outboxRef.current, letter);
        if (!next) {
            setError('待寄书信有些多，请先处理之前的书信。草稿会保留。');
            return;
        }
        updateOutbox(() => next);
        saveDraft('');
        atBottom.current = true;
        void deliver(letter);
    }
    function sendCard (card: {id: string; sentence: string; gloss: string; level: string;}) {
        if (!threadRef.current?.canSend) {
            setPicker(false);
            setError('当前不能寄信，请重新结缘后再分享。');
            void load();
            return;
        }
        const letter: OutgoingLetter = {
            clientMessageId: crypto.randomUUID(),
            type: 'card',
            cardId: card.id,
            card,
            status: 'sending'
        };
        const next = appendOutbox(outboxRef.current, letter);
        if (!next) {
            setPicker(false);
            setError('待寄书信有些多，请先处理之前的书信。');
            return;
        }
        updateOutbox(() => next);
        setPicker(false);
        atBottom.current = true;
        void deliver(letter);
    }
    const jumpToEnd = () => {
        if (area.current) area.current.scrollTop = area.current.scrollHeight;
        atBottom.current = true;
        setNewMail(false);
        void markRead();
    };
    if (!thread) {
        return (
            <>
                <Backbar title="一来一往" back="/friend/inbox" />
                {error
                    ? <ErrorPanel message={error} onRetry={() => void load()} />
                    : <p className="rz-loading" role="status">正在翻开书信…</p>}
            </>
        );
    }
    return (
        <>
            <Backbar title="一来一往" back="/friend/inbox">
                <button type="button" className="rz-icon" aria-label="书信设置" onClick={() => setOptions(true)}>
                    <MoreHorizontal size={22} />
                </button>
            </Backbar>
            <Link className="rz-thread-person" to={`/friend/profile/${enc(thread.peer.id)}`}>
                <Portrait user={thread.peer} />
                <span>
                    <strong>{thread.peer.name}</strong>
                    <small>{thread.canSend ? '一来一往，慢慢说。' : '既有书信已归档'}</small>
                </span>
            </Link>
            {error && <ErrorPanel message={error} onRetry={() => void load()} />}
            <div
                className="rz-thread-area"
                ref={area}
                aria-label={`与${thread.peer.name}的书信`}
                onScroll={() => {
                    const element = area.current;
                    if (!element) return;
                    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
                    setThreadPresence(id, atBottom.current);
                    if (atBottom.current) {
                        setNewMail(false);
                        void markRead();
                    }
                }}
            >
                {thread.hasMore && (
                    <button
                        type="button"
                        className="rz-older"
                        disabled={olderBusy}
                        onClick={() => void older()}
                    >
                        {olderBusy ? '正在翻开…' : '更早的书信 ↑'}
                    </button>
                )}
                <p className="rz-thread-date">不显示在线状态与已读回执</p>
                {!thread.items.length && !outbox.length && (
                    <Empty mark="信" title="第一句，从问候开始。">
                        <p>こんにちは。很高兴认识你。</p>
                    </Empty>
                )}
                {thread.items.map(message => (
                    <article className={`rz-letter${message.senderId === me.id ? ' mine' : ''}`} key={message.id}>
                        <div>
                            <strong>{message.senderId === me.id ? '我' : thread.peer.name}</strong>
                            <time>{socialDate(message.createdAt)}</time>
                        </div>
                        {message.type === 'card'
                            ? message.cardVerification
                                ? (
                                    <div className="rz-shared-slip" data-shared-message={message.id}
                                        style={{minHeight: previewHeights.current.get(message.id) || 88}}>
                                        <p>{message.cardVerification === 'checking' ? '正在确认这张日签…' : '暂时无法确认这张日签，请稍后再试。'}</p>
                                    </div>
                                )
                                : message.revoked
                                ? <p className="rz-revoked">这张日签已收回。</p>
                                : !message.card
                                ? <p className="rz-revoked">暂时无法确认这张日签，请稍后再试。</p>
                                : (
                                    <Link
                                        className="rz-shared-slip"
                                        data-shared-message={message.id}
                                        to={`/friend/share/${enc(message.shareId || message.id)}`}
                                    >
                                        <small>日々のことば · {message.card.level}</small>
                                        <strong lang="ja">{message.card.sentence}</strong>
                                        <p>{message.card.gloss}</p>
                                        <span>
                                            {message.senderId === me.id ? '重温我寄出的这札' : '展开这张日签'}{' '}
                                            <ArrowUpRight size={16} />
                                        </span>
                                    </Link>
                                )
                            : <p>{message.text}</p>}
                        {message.senderId === me.id && <small className="rz-delivery">已送达</small>}
                    </article>
                ))}
                {outbox.map(letter => (
                    <article className="rz-letter mine" key={letter.clientMessageId}>
                        <div>
                            <strong>我</strong>
                            <span>待确认</span>
                        </div>
                        {letter.type === 'text' ? <p>{letter.text}</p> : (
                            <div className="rz-shared-slip">
                                <small>附上一张日签</small>
                                <strong lang="ja">{letter.card?.sentence || '我选择的日签'}</strong>
                                <p>{letter.card?.gloss}</p>
                            </div>
                        )}
                        <small className={`rz-delivery${letter.status === 'failed' ? ' failed' : ''}`}>
                            {letter.status === 'sending' ? '正在寄出…' : (
                                <>
                                    {letter.error || '这封没有寄出。'}
                                    <button
                                        type="button"
                                        disabled={!thread.canSend}
                                        onClick={() => void deliver(letter)}
                                    >
                                        {thread.canSend ? '重试同一封信' : '重新结缘后才能重试'}
                                    </button>
                                </>
                            )}
                        </small>
                    </article>
                ))}
            </div>
            {newMail && <button type="button" className="rz-new-mail" onClick={jumpToEnd}>有新来信，往下看看 ↓</button>}
            {thread.canSend
                ? (
                    <form
                        className="rz-composer"
                        onSubmit={event => {
                            event.preventDefault();
                            sendText();
                        }}
                    >
                        <button
                            type="button"
                            className="rz-icon"
                            aria-label="附上一张日签"
                            onClick={() => setPicker(true)}
                        >
                            <Plus size={22} />
                        </button>
                        <textarea
                            aria-label="写一句问候"
                            placeholder="写一句问候…"
                            value={draft}
                            onChange={event => saveDraft(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    sendText();
                                }
                            }}
                            rows={1}
                            maxLength={4000}
                        />
                        <button
                            type="submit"
                            className="rz-icon"
                            aria-label="寄出书信"
                            disabled={!draft.trim() || [...draft.trim()].length > 1000}
                        >
                            <Send size={20} />
                        </button>
                    </form>
                )
                : (
                    <div className="rz-archived">
                        <p>当前不能继续寄信，既有书信仍保留。{draft && '你的草稿也已保留。'}</p>
                        <Link to="/friend/invite">重新结缘 →</Link>
                    </div>
                )}
            <p className="rz-compose-note">
                {[...draft].length > 900 ? `${[...draft].length} / 1,000 字 · ` : ''}Enter 寄出 · Shift+Enter 换行
            </p>
            {picker && <CardPicker onPick={sendCard} onClose={() => setPicker(false)} />}
            {options && (
                <FriendOptions
                    user={thread.peer}
                    conversationId={id}
                    canSend={thread.canSend}
                    muted={thread.muted}
                    onClose={() => setOptions(false)}
                    onChanged={() => void load()}
                />
            )}
        </>
    );
}
