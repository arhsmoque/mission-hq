import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import { useRootStore } from './stores/rootStore'
import './index.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

onAuthStateChanged(auth, (firebaseUser) => {
  const { user, setUser, setAuthReady } = useRootStore.getState()
  if (firebaseUser) {
    if (!user || user.uid !== firebaseUser.uid) {
      setUser({
        uid: firebaseUser.uid,
        displayName: user?.displayName ?? 'Agent',
        avatarUrl: user?.avatarUrl ?? '🤖',
      })
    }
  } else {
    setUser(null)
  }
  setAuthReady(true)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
