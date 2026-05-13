import { useEffect } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRootStore } from '@/stores/rootStore'

export default function AnonymousGate({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useRootStore()

  useEffect(() => {
    if (!user) {
      signInAnonymously(auth).then((cred) => {
        setUser({
          uid: cred.user.uid,
          displayName: 'Agent',
          avatarUrl: '\uD83E\uDD16',
        })
      })
    }
  }, [user, setUser])

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center text-text-3">
        Getting ready...
      </div>
    )
  }

  return <>{children}</>
}
