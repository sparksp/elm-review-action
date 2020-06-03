import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import {issueCommand} from '@actions/core/lib/command'
import {Octokit} from '@octokit/action'
import {GetResponseTypeFromEndpointMethod} from '@octokit/types'
import {wrap} from './wrap'

type CreateCheckResponseType = GetResponseTypeFromEndpointMethod<
  typeof octokit.checks.create
>
type UpdateCheckResponseType = GetResponseTypeFromEndpointMethod<
  typeof octokit.checks.update
>

const octokit = new Octokit()
const {owner, repo} = github.context.repo
// eslint-disable-next-line camelcase
const head_sha =
  github.context.payload.pull_request?.head?.sha || github.context.sha

const checkName = core.getInput('name', {required: true})
const checkMessageWrap = 80

const inputElmReview = core.getInput('elm_review', {required: true})
const inputElmReviewConfig = core.getInput('elm_review_config')
const inputElmCompiler = core.getInput('elm_compiler')
const inputElmFormat = core.getInput('elm_format')
const inputElmJson = core.getInput('elm_json')
const inputElmFiles = core.getInput('elm_files')
const inputFixAll = core.getInput('fix_all', {required: true})

const elmReviewArgs = (): string[] => {
  const arg = (flag_: string, value: string): string[] => {
    if (value === '') {
      return []
    }
    return [flag_, value]
  }

  const flag = (flag_: string, value: string): string[] => {
    if (value !== 'true') {
      return []
    }
    return [flag_]
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
    ...arg('--elmjson', inputElmJson),
    ...flag('--fix-all-without-prompt', inputFixAll)
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
          title: `${message.rule}: ${message.message}`,
          message: wrap(checkMessageWrap, message.details.join('\n\n'))
        }
      }
    )
  })
}
/* eslint-enable camelcase */

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
async function createCheckSuccess(): Promise<CreateCheckResponseType> {
  return octokit.checks.create({
    owner,
    repo,
    name: checkName,
    head_sha,
    status: 'completed',
    conclusion: 'success',
    output: {
      title: 'No problems to report',
      summary: 'I found no problems while reviewing!'
    }
  })
}

async function updateCheckAnnotations(
  check_run_id: number,
  annotations: OctokitAnnotation[],
  title: string,
  summary: string
): Promise<UpdateCheckResponseType> {
  return octokit.checks.update({
    owner,
    repo,
    check_run_id,
    status: 'completed',
    conclusion: 'failure',
    output: {
      title,
      summary,
      annotations
    }
  })
}

async function createCheckAnnotations(
  annotations: OctokitAnnotation[]
): Promise<void> {
  const chunkSize = 50
  const annotationCount = annotations.length
  const firstAnnotations = annotations.slice(0, chunkSize)
  const title = `${annotationCount} ${
    annotationCount === 1 ? 'problem' : 'problems'
  } found`
  const summary = `I found ${annotationCount} ${
    annotationCount === 1 ? 'problem' : 'problems'
  } while reviewing your project.`

  // Push first 50 annotations
  const check = await octokit.checks.create({
    owner,
    repo,
    name: checkName,
    head_sha,
    status: 'completed',
    conclusion: 'failure',
    output: {
      title,
      summary,
      annotations: firstAnnotations
    }
  })

  // Push remaining annotations, 50 at a time
  for (let i = chunkSize, len = annotations.length; i < len; i += chunkSize) {
    await updateCheckAnnotations(
      check.data.id,
      annotations.slice(i, i + chunkSize),
      title,
      summary
    )
  }
}
/* eslint-enable camelcase */

async function run(): Promise<void> {
  try {
    const report = await runElmReview()
    const annotations = reportErrors(report)

    if (annotations.length > 0) {
      await createCheckAnnotations(annotations)
    } else {
      await createCheckSuccess()
    }
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
