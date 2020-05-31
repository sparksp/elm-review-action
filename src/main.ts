import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {issueCommand} from '@actions/core/lib/command'
import {Octokit} from '@octokit/action'
import {GetResponseTypeFromEndpointMethod} from '@octokit/types'

type CreateCheckResponseType = GetResponseTypeFromEndpointMethod<
  typeof octokit.checks.create
>
type UpdateCheckResponseType = GetResponseTypeFromEndpointMethod<
  typeof octokit.checks.update
>

const octokit = new Octokit()
const [gitHubOwner, gitHubRepo]: string[] = (
  process.env.GITHUB_REPOSITORY || ''
).split('/')
const gitHubSha: string = process.env.GITHUB_SHA || ''

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

/* eslint-disable camelcase */
type OctokitAnnotation = {
  path: string
  start_line: number
  start_column?: number
  end_line: number
  end_column?: number
  annotation_level: 'notice' | 'warning' | 'failure'
  message: string
  title?: string
  raw_details?: string
}

const reportErrors = (errors: ReviewErrors): OctokitAnnotation[] => {
  return errors.errors.flatMap((error: ReviewError) => {
    return error.errors.map(
      (message: ReviewMessage): OctokitAnnotation => {
        return {
          path: error.path,
          annotation_level: 'failure',
          start_line: message.region.start.line,
          start_column: message.region.start.column,
          end_line: message.region.end.line,
          end_column: message.region.end.column,
          title: message.message,
          message: message.details.join('\n')
        }
      }
    )
  })
}
/* eslint-enable camelcase */

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

/* eslint-disable camelcase */
async function createCheck(): Promise<CreateCheckResponseType> {
  return octokit.checks.create({
    owner: gitHubOwner,
    repo: gitHubRepo,
    name: 'elm-review',
    head_sha: gitHubSha,
    status: 'in_progress',
    output: {
      title: 'Elm Review',
      summary: ''
    }
  })
}

async function updateCheckSuccess(
  check_run_id: number
): Promise<UpdateCheckResponseType> {
  return octokit.checks.update({
    owner: gitHubOwner,
    repo: gitHubRepo,
    check_run_id,
    status: 'completed',
    conclusion: 'success'
  })
}

async function updateCheckAnnotations(
  check_run_id: number,
  annotations: OctokitAnnotation[]
): Promise<UpdateCheckResponseType> {
  return octokit.checks.update({
    owner: gitHubOwner,
    repo: gitHubRepo,
    check_run_id,
    status: 'completed',
    conclusion: 'failure',
    output: {
      title: 'Elm Review',
      summary: '',
      annotations
    }
  })
}

async function updateCheckFailure(
  check_run_id: number,
  annotations: OctokitAnnotation[]
): Promise<void> {
  const chunkSize = 50
  for (let i = 0, len = annotations.length; i < len; i += chunkSize) {
    await updateCheckAnnotations(
      check_run_id,
      annotations.slice(i, i + chunkSize)
    )
  }
}
/* eslint-enable camelcase */

async function run(): Promise<void> {
  const check = await createCheck()

  try {
    const report = await runElmReview()
    const annotations = reportErrors(report)

    if (annotations.length > 0) {
      await updateCheckFailure(check.data.id, annotations)
      reportFailure(annotations.length)
    } else {
      await updateCheckSuccess(check.data.id)
    }
  } catch (e) {
    try {
      const error = JSON.parse(e.message)
      reportCliError(error)
      await updateCheckFailure(check.data.id, [])
    } catch (_) {
      reportCliError(e)
      await updateCheckFailure(check.data.id, [])
    }
  }
}

run()
