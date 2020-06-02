import {wrap} from '../src/wrap'

test('it does not wrap paragraphs shorter than the given length', () => {
  const input = 'The quick brown fox jumps over the lazy dog.'
  const result = wrap(80, input)
  expect(result).toEqual(input)
})

test('it wraps paragraphs longer than the given length', () => {
  const input = 'The quick brown fox jumps over the lazy dog.'
  const result = wrap(10, input)
  expect(result).toEqual('The quick\n\
brown fox\n\
jumps over\n\
the lazy\n\
dog.')
})

test('it keeps new lines in paragraphs longer than the given length', () => {
  const input = 'The quick brown\nfox jumps over the lazy dog.'
  const result = wrap(10, input)
  expect(result).toEqual('The quick\n\
brown\n\
fox jumps\n\
over the\n\
lazy dog.')
})

test('it maintains paragraphs shorter than the given length', () => {
  const input =
    'The quick brown fox jumps over the lazy dog.\n\n\
The quick brown fox jumps over the lazy dog.'
  const result = wrap(80, input)
  expect(result).toEqual(input)
})

test('it wraps multiple paragraphs longer than the given length', () => {
  const input =
    'The quick brown fox jumps over the lazy dog.\n\n\
The quick brown fox jumps over the lazy dog.'
  const result = wrap(10, input)
  expect(result).toEqual(
    'The quick\n\
brown fox\n\
jumps over\n\
the lazy\n\
dog.\n\n\
The quick\n\
brown fox\n\
jumps over\n\
the lazy\n\
dog.'
  )
})

test('it keeps each line longer than the given length', () => {
  const input =
    'The quick brown\nfox jumps over the lazy dog.\n\n\
The quick brown fox jumps over the\nlazy dog.'
  const result = wrap(10, input)
  expect(result).toEqual(
    'The quick\n\
brown\n\
fox jumps\n\
over the\n\
lazy dog.\n\n\
The quick\n\
brown fox\n\
jumps over\n\
the\n\
lazy dog.'
  )
})
