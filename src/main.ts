import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {issueCommand} from '@actions/core/lib/command'

const inputElmReview = core.getInput('elm_review', {required: true})
const inputElmReviewConfig = core.getInput('elm_review_config')
const inputElmCompiler = core.getInput('elm_compiler')
const inputElmFormat = core.getInput('elm_format')
const inputElmJson = core.getInput('elm_json')
const inputElmFiles = core.getInput('elm_files')

const elmReviewArgs = (): string[] => {
  const arg = (flag: string, value: string): string[] => {
    if (value === '') {
      return []
    }
    return [flag, value]
  }

  const globFiles = (pattern: string): string[] => {
    if (pattern === '') {
      return []
    }
    return pattern.split('\n')
  }

  return [
    ...globFiles(inputElmFiles),
    '--report=json',
    ...arg('--config', inputElmReviewConfig),
    ...arg('--compiler', inputElmCompiler),
    ...arg('--elm-format-path', inputElmFormat),
    ...arg('--elmjson', inputElmJson)
  ]
}

const runElmReview = async (): Promise<ReviewErrors> => {
  let output = ''
  let errput = ''

  const options = {
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      },
      stderr: (data: Buffer) => {
        errput += data.toString()
      }
    },
    silent: true
  }

  await exec.exec(inputElmReview, elmReviewArgs(), options)

  if (errput.length > 0) {
    throw Error(errput)
  }

  try {
    return JSON.parse(output)
  } catch (_) {
    throw Error(output)
  }
}

type ReviewErrors = {
  type: 'review-errors'
  errors: ReviewError[]
}

type ReviewError = {
  path: string
  errors: ReviewMessage[]
}

type ReviewMessage = {
  message: string
  rule: string
  details: string[]
  region: Region
}

type Region = {
  start: Location
  end: Location
}

type Location = {
  line: number
  column: number
}

const reportErrors = (errors: ReviewErrors): number => {
  let reported = 0
  for (const error of errors.errors) {
    for (const message of error.errors) {
      issueError(message.message, {
        file: error.path,
        line: message.region.start.line,
        col: message.region.start.column
      })

      reported++
    }
  }
  return reported
}

const reportFailure = (reported: number): void => {
  if (reported) {
    core.setFailed(
      `elm-review reported ${reported} ${reported === 1 ? 'error' : 'errors'}`
    )
  }
}

type CliError = {
  type: 'error'
  title: string
  path: string
  message: string
}

type UnexpectedError = {
  title: string
  path: string
  error: string
}

type ErrorOpts = {
  file?: string
  line?: number
  col?: number
}

function issueError(message: string, opts: ErrorOpts): void {
  issueCommand('error', opts, message.trim().replace('\n', '%0A'))
  process.exitCode = core.ExitCode.Failure
}

function reportCliError(error: Error): void
function reportCliError(error: CliError): void
function reportCliError(error: UnexpectedError): void

function reportCliError(error: Error | CliError | UnexpectedError): void {
  let message: string
  if ('message' in error) {
    message = error.message
  } else {
    message = error.error
  }

  const opts: ErrorOpts = {}
  if ('path' in error) {
    opts.file = error.path
  }

  issueError(message, opts)
}

async function run(): Promise<void> {
  try {
    const report = await runElmReview()
    reportFailure(reportErrors(report))
  } catch (e) {
    try {
      const error = JSON.parse(e.message)
      reportCliError(error)
    } catch (_) {
      reportCliError(e)
    }
  }
}

run()
