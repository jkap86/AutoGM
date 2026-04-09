import { getToken } from '../lib/auth'

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

export async function gqlRequest<TResult, TVars = Record<string, unknown>>(
  query: string,
  variables?: TVars,
  options?: GqlRequestOptions
): Promise<TResult> {
  const token = getToken()

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Pretend like a browser request so any origin/referer checks pass.
      Origin: 'https://sleeper.com',
      Referer: 'https://sleeper.com/',
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
