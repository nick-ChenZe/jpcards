-- 每个用户一行，记下北京时间当天已生成的次数和上一次点「生成」的时间。
CREATE TABLE "daily_card_quota" (
    "user_id" text PRIMARY KEY NOT NULL,
    "day_key" text NOT NULL,
    "used" integer NOT NULL DEFAULT 0,
    "last_generated_at" integer NOT NULL DEFAULT 0
);
