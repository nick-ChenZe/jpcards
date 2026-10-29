-- 社交数据独立于个人日签墙；无示例人物或信件。
CREATE TABLE social_profile (
    user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    handle TEXT NOT NULL COLLATE NOCASE UNIQUE,
    letters INTEGER NOT NULL DEFAULT 1 CHECK (letters IN (0, 1)),
    requests INTEGER NOT NULL DEFAULT 1 CHECK (requests IN (0, 1)),
    system INTEGER NOT NULL DEFAULT 1 CHECK (system IN (0, 1)),
    discoverable INTEGER NOT NULL DEFAULT 1 CHECK (discoverable IN (0, 1))
);

CREATE TABLE social_relationship (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    user_low TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    user_high TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'removed', 'declined')),
    since INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (user_low, user_high),
    CHECK (user_low < user_high),
    CHECK (requester_id = user_low OR requester_id = user_high)
);
CREATE INDEX idx_social_relationship_low ON social_relationship(user_low, status);
CREATE INDEX idx_social_relationship_high ON social_relationship(user_high, status);

CREATE TABLE social_member (
    conversation_id TEXT NOT NULL REFERENCES social_relationship(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    last_read_seq INTEGER NOT NULL DEFAULT 0,
    muted INTEGER NOT NULL DEFAULT 0 CHECK (muted IN (0, 1)),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE social_block (
    blocker_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);
CREATE INDEX idx_social_block_blocked ON social_block(blocked_id, blocker_id);

CREATE TABLE social_message (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    conversation_id TEXT NOT NULL REFERENCES social_relationship(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    client_message_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'card')),
    text TEXT,
    source_card_id TEXT,
    snapshot_json TEXT,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE (conversation_id, sender_id, client_message_id),
    CHECK ((type = 'text' AND length(trim(text)) BETWEEN 1 AND 1000)
        OR (type = 'card' AND source_card_id IS NOT NULL))
);
CREATE INDEX idx_social_message_conversation ON social_message(conversation_id, seq);

-- 与发送同一写入时刻检查权限，避免先查后写的屏蔽/解除竞态。
CREATE TRIGGER social_message_permission BEFORE INSERT ON social_message
WHEN NOT EXISTS (
    SELECT 1 FROM social_relationship r
    JOIN social_member m ON m.conversation_id = r.id AND m.user_id = NEW.sender_id
    WHERE r.id = NEW.conversation_id AND r.status = 'accepted'
      AND NEW.sender_id IN (r.user_low, r.user_high)
      AND NOT EXISTS (
          SELECT 1 FROM social_block b
          WHERE (b.blocker_id = r.user_low AND b.blocked_id = r.user_high)
             OR (b.blocker_id = r.user_high AND b.blocked_id = r.user_low)
      )
)
BEGIN
    SELECT RAISE(ABORT, 'SOCIAL_SEND_FORBIDDEN');
END;

CREATE TRIGGER social_card_permission BEFORE INSERT ON social_message
WHEN NEW.type = 'card' AND NOT EXISTS (
    SELECT 1 FROM card_history c WHERE c.id = NEW.source_card_id AND c.user_id = NEW.sender_id
)
BEGIN
    SELECT RAISE(ABORT, 'SOCIAL_CARD_FORBIDDEN');
END;

CREATE TABLE social_notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('friend', 'system')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
    UNIQUE (recipient_id, event_key)
);
CREATE INDEX idx_social_notification_recipient ON social_notification(recipient_id, id);

CREATE TABLE social_rate_limit (
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, scope)
);

CREATE TABLE social_report (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    reported_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    message_id TEXT,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    CHECK (reporter_id != reported_id)
);
CREATE INDEX idx_social_report_status ON social_report(status, created_at);
