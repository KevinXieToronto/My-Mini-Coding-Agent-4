import { exec } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import type OpenAI from "openai"

const execAsync = promisify(exec)

/**
 * 发送给 API 的声明。这些描述是伪装的提示词：
 * 它们告诉模型该在「什么时候」使用每个工具，而不只是它能做什么。
 */
export const toolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a text file and return its full contents. " +
        "Call this before proposing changes to any file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path, relative to the current directory or absolute" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create or overwrite a text file with the given content. " +
        "Parent directories are created automatically. " +
        "When modifying an existing file, read it first and write back the complete new contents.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write" },
          content: { type: "string", description: "The complete new file contents" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description:
        "List the files and subdirectories of a directory. " +
        "Call this to explore the project before reading specific files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory to list. Defaults to the current directory." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a shell command via cmd.exe and return its stdout and stderr. " +
        "Use for things files can't tell you: running tests, npm scripts, git status, type-checking.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command line to execute" },
        },
        required: ["command"],
      },
    },
  },
]

/** 执行一次工具调用，并以字符串返回其输出。失败时抛出异常。 */
export async function executeTool(name: string, input: unknown): Promise<string> {
  const args = input as Record<string, string>

  switch (name) {
    case "read_file":
      return fs.readFile(args.path, "utf8")

    case "write_file": {
      const target = path.resolve(args.path)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, args.content, "utf8")
      return `Wrote ${args.content.length} characters to ${target}`
    }

    case "list_dir": {
      const dir = args.path || "."
      const entries = await fs.readdir(dir, { withFileTypes: true })
      if (entries.length === 0) return "(empty directory)"
      return entries
        .map((e) => (e.isDirectory() ? e.name + "\\" : e.name))
        .join("\n")
    }

    case "run_command": {
      const { stdout, stderr } = await execAsync(args.command, {
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      })
      const parts = [stdout.trim(), stderr.trim() && `[stderr]\n${stderr.trim()}`]
      return parts.filter(Boolean).join("\n") || "(command produced no output)"
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
