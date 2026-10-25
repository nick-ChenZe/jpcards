-- 注册短窗计数。scope 是 ip 或 email，bucket_key 是规范化后的 IP 或邮箱。
-- 每个键一行，从该键第一次尝试起算 10 分钟。过期行由下次注册删掉。
CREATE TABLE "register_rate_limit" (
    "scope" text NOT NULL,
    "bucket_key" text NOT NULL,
    "window_start" integer NOT NULL,
    "count" integer NOT NULL DEFAULT 0,
    PRIMARY KEY ("scope", "bucket_key")
);
