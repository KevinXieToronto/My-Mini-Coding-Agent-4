import type OpenAI from "openai"
import { client } from "./llm.js"
import { executeTool, toolDefinitions } from "./tools.js"

/** 安全阀：一个陷入困惑、无限重试的模型不该整夜烧掉你的 token。 */
const MAX_ITERATIONS = 25

/** 会改变机器状态、因而需要用户批准的工具。 */
const DESTRUCTIVE = new Set(["write_file", "run_command"])

/** 循环如何与 UI 通信——由 index.ts 提供这些回调。 */
export interface AgentCallbacks {
  onText: (chunk: string) => void
  onToolStart: (name: string, input: unknown) => void
  onToolEnd: (name: string, result: string, isError: boolean) => void
  confirm: (question: string) => Promise<boolean>
}

/**
 * 把用户的一个回合运行到底：不断调用模型并执行它请求的工具，
 * 直到它以纯文本作答（或者我们撞到上限）。
 * 原地修改 `history`——每条消息在产生时就被追加进去。
 */
export async function runAgent(
  model: string,
  system: string,
  history: OpenAI.Chat.ChatCompletionMessageParam[],
  cb: AgentCallbacks,
): Promise<void> {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // 1. 调用模型（流式，与教程 04 完全一样——只是多了 `tools`）
    const stream = client.chat.completions.stream({
      model,
      max_completion_tokens: 16000,
      tools: toolDefinitions,
      messages: [{ role: "system", content: system }, ...history],
    })
    stream.on("content", (delta) => cb.onText(delta))
    const completion = await stream.finalChatCompletion()
    const message = completion.choices[0].message

    // 2. 规则 1：把助手消息原样回传
    history.push(message)

    // 3. 没有工具请求？那么刚才流式输出的文本就是最终答案。
    const toolCalls = message.tool_calls ?? []
    if (toolCalls.length === 0) return

    // 4. 规则 2 和 3：按顺序回应每个调用，各自一条消息
    for (const call of toolCalls) {
      // 这个 SDK 版本的联合类型里还有 custom 工具调用——我们只处理 function。
      if (call.type !== "function") {
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Error: unsupported tool call type.",
        })
        continue
      }
      const name = call.function.name

      // 模型给出的参数是一个 JSON 字符串——而且可能格式不合法。
      let input: unknown
      try {
        input = JSON.parse(call.function.arguments)
      } catch {
        cb.onToolEnd(name, "invalid JSON arguments", true)
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: `Error: arguments were not valid JSON: ${call.function.arguments}`,
        })
        continue
      }

      if (DESTRUCTIVE.has(name)) {
        const ok = await cb.confirm(`${name} ${JSON.stringify(input)}`)
        if (!ok) {
          cb.onToolEnd(name, "denied by user", true)
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: "Error: the user denied this tool call. Ask before retrying, or try another approach.",
          })
          continue
        }
      }

      cb.onToolStart(name, input)
      let output: string
      let isError = false
      try {
        output = await executeTool(name, input)
      } catch (err) {
        output = `Error: ${err instanceof Error ? err.message : String(err)}`
        isError = true
      }
      cb.onToolEnd(name, output, isError)

      history.push({ role: "tool", tool_call_id: call.id, content: output })
    }
    // ……然后带着历史里的这些结果回到第 1 步
  }

  cb.onText(`\n[Stopped after ${MAX_ITERATIONS} iterations — the task may be incomplete.]`)
}
