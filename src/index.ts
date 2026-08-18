import { parseArgs } from "node:util"
import readline from "node:readline/promises"
import { loadConfig } from "./config.js"
import type OpenAI from "openai"
import { runAgent } from "./agent.js"

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

const system = `${config.systemPrompt}
The user's current working directory is: ${process.cwd()}
The platform is Windows; shell commands run under cmd.exe.`

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
  console.log()
  await runAgent(config.model, system, history, {
    onText: (chunk) => process.stdout.write(chunk),
    onToolStart: (name, input) =>
      console.log(`
[tool] ${name} ${JSON.stringify(input).slice(0, 120)}`),
    onToolEnd: (name, result, isError) =>
      console.log(
        isError
          ? `[tool] ${name} FAILED: ${result.slice(0, 200)}`
          : `[tool] ${name} ok (${result.length} chars)`,
      ),
    confirm: async (question) => {
      const answer = await rl.question(`
⚠ Allow ${question}? [y/N] `)
      return answer.trim().toLowerCase() === "y"
    },
  })
  console.log()
}

rl.close()
console.log("Bye!")
