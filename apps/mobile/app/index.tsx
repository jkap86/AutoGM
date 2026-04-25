import { Redirect } from 'expo-router'
import { useAuth } from '@sleepier/shared'

export default function Index() {
  const { session, restoring } = useAuth()

  if (restoring) return null

  if (session?.user_id) {
    return <Redirect href="/(app)" />
  }

  return <Redirect href="/(auth)/login" />
}
