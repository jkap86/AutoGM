import { gqlRequest } from '../client'
import type { ReactionVars, ReactionResult, DeleteReactionResult } from './types'

const CREATE_MUTATION = `
  mutation create_reaction(
    $message_id: Snowflake!,
    $parent_id: Snowflake!,
    $reaction: String!
  ) {
    create_reaction(
      message_id: $message_id,
      parent_id: $parent_id,
      reaction: $reaction
    ) {
      message_id reactor_id reaction
    }
  }
`

const DELETE_MUTATION = `
  mutation delete_reaction(
    $message_id: Snowflake!,
    $parent_id: Snowflake!,
    $reaction: String!
  ) {
    delete_reaction(
      message_id: $message_id,
      parent_id: $parent_id,
      reaction: $reaction
    ) {
      message_id reactor_id reaction
    }
  }
`

export async function createReaction(vars: ReactionVars): Promise<ReactionResult> {
  return gqlRequest<ReactionResult>(CREATE_MUTATION, vars, {
    operationName: 'create_reaction',
  })
}

export async function deleteReaction(vars: ReactionVars): Promise<DeleteReactionResult> {
  return gqlRequest<DeleteReactionResult>(DELETE_MUTATION, vars, {
    operationName: 'delete_reaction',
  })
}
