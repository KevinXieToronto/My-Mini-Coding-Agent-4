import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export interface Config {
  /** 要使用的 Anthropic 模型 ID */
  model: string
  /** 每次请求都发送给模型的指令 */
  systemPrompt: string
}

const DEFAULTS: Config = {
  model: "gpt-5",
  systemPrompt:
    "You are mini-agent, a concise coding assistant running in a Windows terminal. " +
    "Prefer short, direct answers with code blocks where helpful.",
}

/** mini-agent 存放文件的目录：C:\Users\<你的用户名>\.mini-agent */
export function configDir(): string {
  return path.join(os.homedir(), ".mini-agent")
}

/** 如果 config.json 存在则加载它，并叠加在默认值之上。 */
export function loadConfig(): Config {
  const file = path.join(configDir(), "config.json")
  if (!fs.existsSync(file)) return { ...DEFAULTS }
  const raw = fs.readFileSync(file, "utf8")
  const fromFile = JSON.parse(raw) as Partial<Config>
  return { ...DEFAULTS, ...fromFile }
}
