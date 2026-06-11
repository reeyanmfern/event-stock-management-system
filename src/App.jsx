import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import supabase from './lib/supabase'
import Inventory from './pages/Inventory'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Reports from './pages/Reports'
import MultiChannel from './pages/MultiChannel'
import Transactions from './pages/Transactions'
import UpdatePassword from './pages/UpdatePassword'

function AppContent() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  // KEY FIX: track when Supabase fires a PASSWORD_RECOVERY event
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchUserRole(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // KEY FIX: when a password reset link is clicked, Supabase fires PASSWORD_RECOVERY
      // We must show the UpdatePassword page regardless of whether session exists
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setSession(session)
        setLoading(false)
        return
      }

      // If user just updated their password, clear recovery mode
      if (event === 'USER_UPDATED') {
        setIsPasswordRecovery(false)
      }

      setSession(session)
      if (session) {
        fetchUserRole(session.user.id)
      } else {
        setUserRole(null)
        setIsPasswordRecovery(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserRole(userId) {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setUserRole(data?.role || 'staff')
    } catch (error) {
      console.error('Error fetching user role:', error)
      setUserRole('staff')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">Loading...</div>
        </div>
      </div>
    )
  }

  // KEY FIX: Always show UpdatePassword when in password recovery mode,
  // even if a session exists (the recovery session must not log the user in)
  if (isPasswordRecovery) {
    return (
      <Routes>
        <Route path="*" element={<UpdatePassword onDone={() => setIsPasswordRecovery(false)} />} />
      </Routes>
    )
  }

  // Not logged in — show login or update-password (for direct URL access)
  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  // Authenticated routes
  const isAdmin = userRole === 'admin'

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/transactions', label: 'Transactions' },
    { to: '/reports', label: 'Reports' },
    { to: '/multichannel', label: 'Multi-Channel' },
  ]

  function isActive(path) {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">U4</span>
                </div>
                <h1 className="text-lg font-bold text-gray-900">U4B Inventory</h1>
              </div>
              <div className="hidden md:flex space-x-1">
                {navLinks.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive(link.to)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isAdmin && (
                <span className="hidden sm:inline-block text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Admin</span>
              )}
              <span className="text-sm text-gray-500 hidden lg:block">{session.user.email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="hidden md:inline-flex bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border border-gray-200 hover:border-red-200"
              >
                Sign out
              </button>

              {/* Hamburger button - mobile only */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-500 truncate pr-3">
                  {session.user.email}
                  {isAdmin && (
                    <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
                  )}
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border border-gray-200 hover:border-red-200 flex-shrink-0"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/multichannel" element={<MultiChannel />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
