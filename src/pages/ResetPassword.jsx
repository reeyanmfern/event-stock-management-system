import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isValidToken, setIsValidToken] = useState(false)
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const handleResetToken = async () => {
      // Get the hash fragment from URL (e.g., #access_token=xyz&type=recovery)
      const hash = window.location.hash
      console.log('Hash:', hash)
      
      if (!hash || !hash.includes('access_token')) {
        setError('No reset token found. Please request a new password reset link.')
        setChecking(false)
        return
      }

      // Parse the hash parameters
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')

      console.log('Token type:', type)
      console.log('Has access token:', !!accessToken)

      if (accessToken && type === 'recovery') {
        try {
          // Set the session with the recovery token
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          
          if (error) {
            console.error('Session error:', error)
            setError('Invalid or expired reset link. Please request a new one.')
          } else {
            console.log('Session set successfully')
            setIsValidToken(true)
            setMessage('Link verified! You can now set a new password.')
          }
        } catch (err) {
          console.error('Error:', err)
          setError('Failed to verify reset link. Please try again.')
        }
      } else {
        setError('Invalid reset link. Please request a new password reset.')
      }
      
      setChecking(false)
    }

    handleResetToken()
  }, [])

  async function handleResetPassword(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match!')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters!')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setMessage('Password updated successfully! Redirecting to login...')
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="text-2xl text-blue-600 mb-2">Verifying reset link...</div>
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Set New Password
          </h1>
          <p className="text-gray-600 mt-2">
            {isValidToken ? 'Enter your new password below' : 'Password Reset'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
            <div className="mt-2">
              <button
                onClick={() => navigate('/')}
                className="text-red-700 underline text-sm"
              >
                Return to Login
              </button>
            </div>
          </div>
        )}

        {message && !error && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
            {message}
          </div>
        )}

        {isValidToken && !error && (
          <form onSubmit={handleResetPassword}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}