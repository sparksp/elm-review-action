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

const runElmReview = async (): Promise<Report> => {
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

type Report = {
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
  region: {
    start: Region
    end: Region
  }
}

type Region = {
  line: number
  column: number
}

const issueReport = (report: Report): number => {
  let reported = 0
  for (const error of report.errors) {
    for (const message of error.errors) {
      issueCommand(
        'error',
        {
          file: error.path,
          line: message.region.start.line,
          col: message.region.start.column
        },
        message.message
      )

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

function issueError(error: Error): void
function issueError(error: CliError): void
function issueError(error: UnexpectedError): void

function issueError(error: Error | CliError | UnexpectedError): void {
  let message: string
  if ('message' in error) {
    message = error.message
  } else {
    message = error.error
  }

  const opts: {file?: string} = {}
  if ('path' in error) {
    opts.file = error.path
  }

  issueCommand('error', opts, message.trim().replace('\n', '%0A'))
  process.exitCode = core.ExitCode.Failure
}

async function run(): Promise<void> {
  try {
    const report = await runElmReview()
    reportFailure(issueReport(report))
  } catch (e) {
    try {
      const error = JSON.parse(e.message)
      issueError(error)
    } catch (_) {
      issueError(e)
    }
  }
}

run()
