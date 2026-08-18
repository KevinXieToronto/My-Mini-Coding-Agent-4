import OpenAI from "openai"

// 自动从环境变量读取 OPENAI_API_KEY。
export const client = new OpenAI()

/**
 * 把对话发送给模型并返回助手消息。
 * `messages` 必须包含到目前为止的全部对话——API 是无状态的。
 */
export async function complete(
  model: string,
  system: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<OpenAI.Chat.ChatCompletionMessage> {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: 16000,
    messages: [{ role: "system", content: system }, ...messages],
  })
  return response.choices[0].message
}

/** 从助手消息中提取出可读文本。 */
export function textOf(message: OpenAI.Chat.ChatCompletionMessage): string {
  return message.content ?? ""
}

/**
 * 与 complete() 类似，但每当有文本片段抵达时都会调用 onText(chunk)，
 * 并且最终仍然以完整的最终消息 resolve。
 */
export async function streamComplete(
  model: string,
  system: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  onText: (chunk: string) => void,
): Promise<OpenAI.Chat.ChatCompletionMessage> {
  const stream = client.chat.completions.stream({
    model,
    max_completion_tokens: 16000,
    messages: [{ role: "system", content: system }, ...messages],
  })
  stream.on("content", (delta) => onText(delta))
  const completion = await stream.finalChatCompletion()
  return completion.choices[0].message
}
