import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {issueCommand} from '@actions/core/lib/command'

const elmReviewCmd = core.getInput('elm_review', {required: true})

const elmJson = core.getInput('elm_json', {required: true})

const elmFiles = core.getInput('elm_files')

const globFiles = async (pattern: string | null): Promise<string[]> => {
  if (pattern === null) {
    return []
  }
  return pattern.split('\n')
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

  const files = await globFiles(elmFiles)
  await exec.exec(
    elmReviewCmd,
    [...files, '--elmjson', elmJson, '--report=json'],
    options
  )

  if (errput.length > 0) {
    throw Error(errput)
  }

  return JSON.parse(output)
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

type GlobalError = {
  type: 'error'
  title: string
  path: string
  message: string
}

const issueErrors = (report: Report): number => {
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

const issueReviewError = (report: GlobalError): void => {
  issueCommand(
    'error',
    {
      file: report.path
    },
    report.message.replace('\n', '%0A')
  )
}

const reportFailure = (reported: number): void => {
  if (reported) {
    core.setFailed(
      `elm-review reported ${reported} ${reported === 1 ? 'error' : 'errors'}`
    )
  }
}

async function run(): Promise<void> {
  try {
    const report = await runElmReview()
    reportFailure(issueErrors(report))
  } catch (error) {
    try {
      const elmReviewError = JSON.parse(error.message)
      issueReviewError(elmReviewError)
    } catch (_) {
      core.setFailed(error.message)
    }
  }
}

run()
