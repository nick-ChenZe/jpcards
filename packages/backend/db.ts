import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function openDb() {
  return open({
    filename: './japanese-cards.db',
    driver: sqlite3.Database,
  });
}

export async function initializeDb() {
  const db = await openDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      japanese TEXT NOT NULL,
      reading TEXT NOT NULL,
      meaning TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy', 'Normal', 'Hard'))
    )
  `);
  console.log('Database initialized');
}