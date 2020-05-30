import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

const defaultEnv = {
  INPUT_ELM_REVIEW: 'elm-review',
  INPUT_ELM_JSON: 'elm.json'
}

const elmPath = (...file: string[]): string => {
  return path.join('__tests__', 'elm', ...file)
}

test('runs quietly on success', () => {
  const env = {
    ...process.env,
    ...defaultEnv,
    INPUT_ELM_FILES: path.join('src', 'Good.elm')
  }

  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecSyncOptions = {
    cwd: path.join(__dirname, 'elm'),
    env
  }

  let stdout = ''
  let status = 0
  try {
    cp.execSync(`node ${ip}`, options)
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe('')
  expect(status).toBe(0) // Success!
})

test('configures elm-review path', () => {
  const env = {
    ...process.env,
    ...defaultEnv,
    INPUT_ELM_REVIEW: path.join(__dirname, 'bin', 'not-elm-review')
  }

  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecSyncOptions = {env}

  let stdout = ''
  let status = 0
  try {
    cp.execSync(`node ${ip}`, options)
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe('::error::This is not elm-review!\n')
  expect(status).toBe(1)
})

test('allows configurable elm.json', () => {
  const env = {
    ...process.env,
    ...defaultEnv,
    INPUT_ELM_JSON: elmPath('elm.json'),
    INPUT_ELM_FILES: elmPath('src', 'Good.elm')
  }

  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecSyncOptions = {env}

  let stdout = ''
  let status = 0
  try {
    cp.execSync(`node ${ip}`, options)
  } catch (e) {
    stdout = e.stdout.toString()
    status = e.status
  }
  expect(stdout).toBe('')
  expect(status).toBe(0) // Success!
})

test('reports errors', () => {
  const env = {
    ...process.env,
    ...defaultEnv,
    INPUT_ELM_JSON: elmPath('elm.json'),
    INPUT_ELM_FILES: elmPath('src', 'Bad.elm')
  }
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecSyncOptions = {env}

  let stdout = ''
  let status = 0
  try {
    cp.execSync(`node ${ip}`, options)
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
