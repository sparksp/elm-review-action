import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

test('runs quietly on success', () => {
  process.env['INPUT_ELM_REVIEW'] = 'elm-review'
  process.env['INPUT_ELM_FILES'] = 'src/'
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecSyncOptions = {
    cwd: path.join(__dirname, 'elm'),
    env: process.env
  }

  let status = 0
  try {
    cp.execSync(`node ${ip}`, options)
  } catch (e) {
    status = e.status
  }
  expect(status).toBe(0) // Success!
})
