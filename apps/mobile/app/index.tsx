import { Redirect } from 'expo-router'
import { useAuth } from '@sleepier/shared'

export default function Index() {
  const { session } = useAuth()

  if (session?.user_id) {
    return <Redirect href="/(app)" />
  }

  return <Redirect href="/(auth)/login" />
}
