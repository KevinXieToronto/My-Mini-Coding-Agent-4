import { parseArgs } from "node:util"
import readline from "node:readline/promises"
import { loadConfig } from "./config.js"
import type OpenAI from "openai"
import { streamComplete, textOf } from "./llm.js"

// ---------- 1. 命令行标志 ----------
const { values: flags } = parseArgs({
  options: {
    model: { type: "string", short: "m" },
    help: { type: "boolean", short: "h" },
  },
})

if (flags.help) {
  console.log(`
Usage: mini-agent [options]

Options:
  -m, --model <id>   Override the model from config.json
  -h, --help         Show this help and exit
`)
  process.exit(0)
}

// ---------- 2. 配置（默认值 <- 文件 <- 标志） ----------
const config = loadConfig()
if (flags.model) config.model = flags.model

// ---------- 3. REPL ----------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

console.log(`mini-agent — model: ${config.model}`)
console.log(`Type a message, or /help for commands.`)

function printHelp() {
  console.log(`
Commands:
  /help    Show this help
  /exit    Quit mini-agent
Anything else is sent to the assistant.`)
}

const history: OpenAI.Chat.ChatCompletionMessageParam[] = []

while (true) {
  const line = (await rl.question("\n> ")).trim()
  if (!line) continue

  if (line.startsWith("/")) {
    if (line === "/exit") break
    if (line === "/help") {
      printHelp()
      continue
    }
    console.log(`Unknown command: ${line} (try /help)`)
    continue
  }

  history.push({ role: "user", content: line })
  console.log() // 回答之前空一行
  const message = await streamComplete(
    config.model,
    config.systemPrompt,
    history,
    (chunk) => process.stdout.write(chunk),
  )
  history.push(message)
  console.log() // 回答之后换行
}

rl.close()
console.log("Bye!")
