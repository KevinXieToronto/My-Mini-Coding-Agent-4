const ESC = "\x1b["

/** 用 ANSI 样式包裹文本，之后总是重置。 */
function style(code: string) {
  return (text: string) => `${ESC}${code}m${text}${ESC}0m`
}

export const color = {
  bold: style("1"),
  dim: style("2"),
  red: style("31"),
  green: style("32"),
  yellow: style("33"),
  cyan: style("36"),
}

/**
 * 显示一个带标签的动画 spinner。返回一个 stop() 函数，
 * 它会擦除 spinner 所在的行，让真正的输出取代它的位置。
 */
export function spinner(label: string): () => void {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  let i = 0
  const timer = setInterval(() => {
    process.stdout.write(`\r${color.cyan(frames[i++ % frames.length])} ${color.dim(label)}`)
  }, 80)
  return () => {
    clearInterval(timer)
    process.stdout.write("\r" + " ".repeat(label.length + 2) + "\r")
  }
}

/** 工具调用的单行摘要：名称 + 截断后的输入。 */
export function toolCallLine(name: string, input: unknown): string {
  let summary = JSON.stringify(input)
  if (summary.length > 100) summary = summary.slice(0, 100) + "…"
  return `${color.yellow("●")} ${color.bold(name)} ${color.dim(summary)}`
}

/** 工具结果的单行摘要。 */
export function toolResultLine(name: string, result: string, isError: boolean): string {
  if (isError) return `${color.red("✗")} ${color.bold(name)} ${color.red(firstLine(result))}`
  return `${color.green("✓")} ${color.bold(name)} ${color.dim(`${result.length} chars`)}`
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/)[0]
  return line.length > 120 ? line.slice(0, 120) + "…" : line
}
