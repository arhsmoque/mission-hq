import { useNavigate } from 'react-router-dom'

export default function ParentDashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-6">
      <button onClick={() => navigate('/')} className="mb-4 text-text-2">Back to Home</button>
      <h1 className="font-display text-2xl font-black text-primary">Parent Dashboard</h1>
      <p className="mt-2 text-text-3">Read-only mission review coming in Phase 6</p>
    </div>
  )
}
