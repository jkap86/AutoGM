import { useCallback, useState } from 'react'
import type { CreatePollResult, CreatePollMessageResult } from '@autogm/shared'
import { mobileDataClient } from '../data-client'
import {
  findBlockingRecord,
  findRecentRecord,
  recordOperation,
  pollOperationKey,
} from '../operation-store'

type State = {
  loading: boolean
  error: string | null
}

type CreatePollParams = {
  prompt: string
  choices: string[]
  poll_type: string
  privacy: string
  group_id: string
  league_id: string
  text?: string
}

export function useCreatePoll() {
  const [state, setState] = useState<State>({ loading: false, error: null })

  const createPoll = useCallback(async (params: CreatePollParams) => {
    setState({ loading: true, error: null })
    try {
      const opKey = pollOperationKey({
        league_id: params.league_id,
        group_id: params.group_id,
        prompt: params.prompt,
        choices: params.choices,
        poll_type: params.poll_type,
        privacy: params.privacy,
      })

      // If poll was created remotely but message failed, retry only the message
      const prior = await findRecentRecord(opKey)
      if (prior?.status === 'poll_created' && prior.result_id) {
        await mobileDataClient.graphql('createPollMessage', {
          parent_id: params.league_id,
          attachment_id: prior.result_id,
          text: params.text ?? '',
        }) as CreatePollMessageResult
        await recordOperation(opKey, 'success', prior.result_id)
        setState({ loading: false, error: null })
        return {
          poll_id: prior.result_id,
          choices_order: [] as string[],
        }
      }

      const blocking = await findBlockingRecord(opKey)
      if (blocking) {
        throw new Error(`Duplicate poll blocked (status: ${blocking.status})`)
      }

      await recordOperation(opKey, 'pending')

      const sleeperPollType = params.poll_type === 'multiple' ? 'multi' : params.poll_type
      let poll_id: string
      let choices_order: string[]

      try {
        const pollResult = await mobileDataClient.graphql('createPoll', {
          prompt: params.prompt,
          choices: params.choices,
          k_metadata: ['poll_type', 'privacy'],
          v_metadata: [sleeperPollType, params.privacy],
        }) as CreatePollResult

        poll_id = pollResult.create_poll.poll_id
        choices_order = pollResult.create_poll.choices_order as string[]

        // Record poll_created so retry skips createPoll
        await recordOperation(opKey, 'poll_created', poll_id)
      } catch (e) {
        await recordOperation(opKey, 'failed')
        throw e
      }

      await mobileDataClient.graphql('createPollMessage', {
        parent_id: params.league_id,
        attachment_id: poll_id,
        text: params.text ?? '',
      }) as CreatePollMessageResult

      await recordOperation(opKey, 'success', poll_id)

      setState({ loading: false, error: null })
      return { poll_id, choices_order }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState({ loading: false, error })
      throw e
    }
  }, [])

  return { ...state, createPoll }
}
