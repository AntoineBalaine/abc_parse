let hadError = false

export const getError = () => hadError
export const setError = (setter: boolean) => (hadError = setter)
export const error = (line: number, message: string) => {
  report(line, "", message)
}
export const report = (line: number, where: string, message: string) => {
  setError(true)
  console.error(`[line ${line}] Error ${where}: ${message}`)
}
