-- sentence_memory: 存储用户已见过的 AI 生成句子，用于避免重复
CREATE TABLE IF NOT EXISTS sentence_memory (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    sentence TEXT NOT NULL,
    sentence_hash VARCHAR(64) NOT NULL,
    level VARCHAR(8) DEFAULT 'N5',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_sentence (user_id, sentence_hash)
);

CREATE INDEX idx_sentence_memory_user_created
    ON sentence_memory(user_id, created_at DESC);
