CREATE TABLE "user" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "emailVerified" integer NOT NULL,
    "image" text,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL,
    "username" text,
    "displayUsername" text
);

CREATE UNIQUE INDEX "user_email_unique" ON "user" ("email");
CREATE UNIQUE INDEX "user_username_unique" ON "user" ("username");

CREATE TABLE "session" (
    "id" text PRIMARY KEY NOT NULL,
    "expiresAt" integer NOT NULL,
    "token" text NOT NULL,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX "session_token_unique" ON "session" ("token");

CREATE TABLE "account" (
    "id" text PRIMARY KEY NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" integer,
    "refreshTokenExpiresAt" integer,
    "scope" text,
    "password" text,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
);

CREATE TABLE "verification" (
    "id" text PRIMARY KEY NOT NULL,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expiresAt" integer NOT NULL,
    "createdAt" integer,
    "updatedAt" integer
);

CREATE TABLE "card_history" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "sentence" text NOT NULL,
    "sentence_html" text NOT NULL,
    "audio_url" text,
    "illustration_url" text,
    "level" text DEFAULT 'N5',
    "created_at" text DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_card_history_user_created" ON "card_history" ("user_id", "created_at");

CREATE TABLE "sentence_memory" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "sentence" text NOT NULL,
    "sentence_hash" text NOT NULL,
    "level" text DEFAULT 'N5',
    "created_at" text DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "uk_user_sentence" ON "sentence_memory" ("user_id", "sentence_hash");
CREATE INDEX "idx_sentence_memory_user_created" ON "sentence_memory" ("user_id", "created_at");
