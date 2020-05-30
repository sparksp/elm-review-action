import * as core from '@actions/core'
import * as exec from '@actions/exec'

const elmReviewCmd = core.getInput('elm_review', {
  required: true
})

const elmFiles = core.getInput('elm_files', {
  required: true
})

const globFiles = async (pattern: string): Promise<string[]> => {
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
  if (files.length === 0) {
    throw Error('No Elm files found, please check your ELM_FILES')
  }

  await exec.exec(elmReviewCmd, [...files, '--report=json'], options)

  if (errput.length > 0) {
    throw Error(errput)
  }

  return JSON.parse(output)
}

type Report = {
  type: string
  errors: []
}

const issueErrors = (report: Report): number => {
  return report.errors.length
}

const reportFailure = (reported: number): void => {
  if (reported) {
    core.setFailed(
      `elm-review reported errors with ${reported} ${
        reported === 1 ? 'file' : 'files'
      }`
    )
  }
}

async function run(): Promise<void> {
  try {
    const report = await runElmReview()
    reportFailure(issueErrors(report))
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
