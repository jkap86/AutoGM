import { Stack, Redirect } from 'expo-router'
import { useAuth } from '@sleepier/shared'

export default function AuthLayout() {
  const { session, restoring } = useAuth()

  if (restoring) return null

  if (session?.user_id) {
    return <Redirect href="/(app)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}
