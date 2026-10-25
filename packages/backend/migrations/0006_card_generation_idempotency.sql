-- 同一用户、同一把 Idempotency-Key 只预扣一次。重试读这张表，不再 reserve。
CREATE TABLE "card_generation_idempotency" (
    "user_id" text NOT NULL,
    "idempotency_key" text NOT NULL,
    "state" text NOT NULL,
    "http_status" integer,
    "response_json" text,
    "created_at" integer NOT NULL,
    PRIMARY KEY ("user_id", "idempotency_key")
);
