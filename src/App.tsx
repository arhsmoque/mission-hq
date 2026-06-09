import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useRootStore } from './stores/rootStore'


// Lazy-loaded routes for code splitting
const Dashboard = lazy(() => import('./routes/Dashboard'))
const NewMission = lazy(() => import('./routes/NewMission'))
const MissionView = lazy(() => import('./routes/MissionView'))
const ChineseLab = lazy(() => import('./routes/ChineseLab'))
const Toolbelt = lazy(() => import('./routes/Toolbelt'))
const LessonBuilder = lazy(() => import('./routes/LessonBuilder'))
const LessonPlayer = lazy(() => import('./routes/LessonPlayer'))
const ParentDashboard = lazy(() => import('./routes/ParentDashboard'))

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg font-body text-text">
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-text-2">Loading...</div>}>
        {children}
      </Suspense>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useRootStore((s) => s.user)
  const profileId = useRootStore((s) => s.profileId)
  const authReady = useRootStore((s) => s.authReady)
  if (!authReady) return <div className="flex h-screen items-center justify-center text-text-2">Getting ready...</div>
  if (!user || !profileId) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-mission" element={<PrivateRoute><NewMission /></PrivateRoute>} />
          <Route path="/mission/:missionId" element={<PrivateRoute><MissionView /></PrivateRoute>} />
          <Route path="/chinese-lab" element={<PrivateRoute><ChineseLab /></PrivateRoute>} />
          <Route path="/toolbelt" element={<PrivateRoute><Toolbelt /></PrivateRoute>} />
          <Route path="/lesson-builder" element={<PrivateRoute><LessonBuilder /></PrivateRoute>} />
          <Route path="/lesson-builder/:lessonId" element={<PrivateRoute><LessonBuilder /></PrivateRoute>} />
          <Route path="/lesson/:lessonId" element={<PrivateRoute><LessonPlayer /></PrivateRoute>} />
          <Route path="/parent" element={<ParentDashboard />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
