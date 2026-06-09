import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ResetPasswordCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Get the full URL with hash
    const hash = window.location.hash
    
    if (hash) {
      // Redirect to the main reset page with the hash
      window.location.href = `/reset-password${hash}`
    } else {
      navigate('/login')
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl text-blue-600 mb-2">Redirecting...</div>
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}