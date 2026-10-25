-- 朗读高亮用的分词。JSON 数组，每项是 surface、reading、moraWeight。
-- 旧卡片这一列为空，播放时不高亮。分词失败时也写成空，不挡住生卡。
ALTER TABLE "card_history" ADD COLUMN "reading_tokens" text;
