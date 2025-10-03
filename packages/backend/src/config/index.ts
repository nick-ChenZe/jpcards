import dotenv from 'dotenv'
dotenv.config()

export const config = {
    env: {
        chatApiKey: process.env.CHAT_API_KEY!,
        chatApiEndpoint: process.env.CHAT_API_ENDPOINT!,
        volcApiAk: process.env.VOLC_API_AK!,
        volcApiSk: process.env.VOLC_API_SK!,
        databasePath: process.env.DATABASE_PATH || './japanese-cards.db',
        mysqlDatabase: process.env.MYSQL_DATABASE,
        mysqlUser: process.env.MYSQL_USER,
        mysqlPassword: process.env.MYSQL_PASSWORD,
    }
}