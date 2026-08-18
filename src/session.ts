import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import type OpenAI from "openai"
import { configDir } from "./config.js"

// 在 %USERPROFILE%\.mini-agent\ 中打开（或创建）数据库文件
fs.mkdirSync(configDir(), { recursive: true })
const db = new Database(path.join(configDir(), "sessions.db"))

// 首次运行时创建表。IF NOT EXISTS 使得每次启动都执行这段代码也是安全的。
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL REFERENCES sessions(id),
    role         TEXT NOT NULL,
    message_json TEXT NOT NULL
  );
`)

export interface SessionInfo {
  id: number
  title: string
  created_at: string
}

export function createSession(title: string): number {
  const result = db
    .prepare("INSERT INTO sessions (title) VALUES (?)")
    .run(title.slice(0, 80))
  return Number(result.lastInsertRowid)
}

export function listSessions(): SessionInfo[] {
  return db
    .prepare("SELECT id, title, created_at FROM sessions ORDER BY id DESC LIMIT 20")
    .all() as SessionInfo[]
}

export function saveMessage(
  sessionId: number,
  message: OpenAI.Chat.ChatCompletionMessageParam,
): void {
  db.prepare(
    "INSERT INTO messages (session_id, role, message_json) VALUES (?, ?, ?)",
  ).run(sessionId, message.role, JSON.stringify(message))
}

export function loadMessages(sessionId: number): OpenAI.Chat.ChatCompletionMessageParam[] {
  const rows = db
    .prepare("SELECT message_json FROM messages WHERE session_id = ? ORDER BY id")
    .all(sessionId) as { message_json: string }[]
  return rows.map((row) => JSON.parse(row.message_json) as OpenAI.Chat.ChatCompletionMessageParam)
}

export function sessionExists(sessionId: number): boolean {
  return db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(sessionId) !== undefined
}
