export function wrap(length: number, text: string): string {
  return text
    .split('\n\n')
    .map(paragraph => {
      const words = paragraph.replace('\n', ' ').split(' ')
      return wrapper(length, words, '')
    })
    .join('\n\n')
}

function wrapper(length: number, words: string[], line: string): string {
  if (words.length === 0) {
    return line
  } else {
    const [nextWord, ...remainingWords] = words

    if (line.length + nextWord.length + 1 > length) {
      return `${line}\n${wrapper(length, remainingWords, nextWord)}`
    } else if (line.length === 0) {
      return wrapper(length, remainingWords, nextWord)
    } else {
      return wrapper(length, remainingWords, `${line} ${nextWord}`)
    }
  }
}
