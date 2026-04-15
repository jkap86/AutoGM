import { BROWSER_HEADERS } from '../browser-headers'

const ENDPOINT = 'https://sleeper.com/graphql'

export type GraphQLError = {
  message: string
  path?: (string | number)[]
  extensions?: Record<string, unknown>
}

export class GraphQLRequestError extends Error {
  constructor(public errors: GraphQLError[]) {
    super(errors.map((e) => e.message).join('; '))
    this.name = 'GraphQLRequestError'
  }
}

export type GqlRequestOptions = {
  operationName?: string
  headers?: Record<string, string>
}

let _getToken: () => string | null = () => null

export function configureClient(opts: { getToken: () => string | null }) {
  _getToken = opts.getToken
}

export async function gqlRequest<TResult, TVars = Record<string, unknown>>(
  query: string,
  variables?: TVars,
  options?: GqlRequestOptions
): Promise<TResult> {
  const token = _getToken()

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: token } : {}),
      ...options?.headers,
    },
    body: JSON.stringify({
      query,
      variables,
      ...(options?.operationName
        ? { operationName: options.operationName }
        : {}),
    }),
  })

  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    data?: TResult
    errors?: GraphQLError[]
  }

  if (json.errors && json.errors.length > 0) {
    throw new GraphQLRequestError(json.errors)
  }

  if (!json.data) {
    throw new Error('GraphQL response missing data')
  }

  return json.data
}
