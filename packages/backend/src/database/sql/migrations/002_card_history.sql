-- card_history: 存储用户浏览过的卡片记录，关联音频和插图的 R2 URL
CREATE TABLE IF NOT EXISTS card_history (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    sentence TEXT NOT NULL,
    sentence_html TEXT NOT NULL,
    audio_url VARCHAR(1024) DEFAULT NULL,
    illustration_url VARCHAR(1024) DEFAULT NULL,
    level VARCHAR(8) DEFAULT 'N5',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_card_history_user_created
    ON card_history(user_id, created_at DESC);
