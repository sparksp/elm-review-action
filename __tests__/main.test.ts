import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

const defaultEnv = {
  ...process.env,
  INPUT_ELM_REVIEW: 'elm-review'
}

const elmPath = (...file: string[]): string => {
  return path.join('__tests__', 'elm', ...file)
}

const runAction = (options: cp.ExecSyncOptions): Buffer => {
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  return cp.execSync(`node ${ip}`, options)
}

test('runs quietly on success', () => {
  const env = {
    ...defaultEnv,
    INPUT_ELM_FILES: path.join('src', 'Good.elm')
  }

  let stdout = ''
  let status = 0
  try {
    const output = runAction({
      cwd: path.join(__dirname, 'elm'),
      env
    })
    stdout = output.toString()
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe('')
  expect(status).toBe(0) // Success!
})

test('configures elm-review path', () => {
  const env = {
    ...defaultEnv,
    INPUT_ELM_REVIEW: path.join(__dirname, 'bin', 'elm-review-args')
  }

  let stdout = ''
  let status = 0
  try {
    runAction({env})
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe('::error::elm-review --report=json\n')
  expect(status).toBe(1)
})

test('configures elm compiler path', () => {
  const env = {
    ...defaultEnv,
    INPUT_ELM_REVIEW: path.join(__dirname, 'bin', 'elm-review-args'),
    INPUT_ELM_COMPILER: '/path/to/elm'
  }

  let stdout = ''
  let status = 0
  try {
    runAction({env})
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe(
    '::error::elm-review --report=json --compiler /path/to/elm\n'
  )
  expect(status).toBe(1)
})

test('configures elm-format path', () => {
  const env = {
    ...defaultEnv,
    INPUT_ELM_REVIEW: path.join(__dirname, 'bin', 'elm-review-args'),
    INPUT_ELM_FORMAT: '/path/to/elm-format'
  }

  let stdout = ''
  let status = 0
  try {
    runAction({env})
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe(
    '::error::elm-review --report=json --elm-format-path /path/to/elm-format\n'
  )
  expect(status).toBe(1)
})

test('configures elm.json path', () => {
  const env = {
    ...defaultEnv,
    INPUT_ELM_REVIEW: path.join(__dirname, 'bin', 'elm-review-args'),
    INPUT_ELM_JSON: '/path/to/elm.json'
  }

  let stdout = ''
  let status = 0
  try {
    runAction({env})
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe(
    '::error::elm-review --report=json --elmjson /path/to/elm.json\n'
  )
  expect(status).toBe(1)
})

test('reports errors', () => {
  const env = {
    ...defaultEnv,
    INPUT_ELM_JSON: elmPath('elm.json'),
    INPUT_ELM_FILES: elmPath('src', 'Bad.elm')
  }

  let stdout = ''
  let status = 0
  try {
    runAction({env})
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe(
    '::error file=__tests__/elm/src/Bad.elm,line=3,col=22::Prefer listing what you wish to import and/or using qualified imports\n' +
      '::error file=__tests__/elm/src/Bad.elm,line=1,col=21::Module exposes everything implicitly "(..)"\n' +
      '::error::elm-review reported 2 errors\n'
  )
  expect(status).toBe(1)
})
