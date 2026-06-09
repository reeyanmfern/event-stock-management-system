import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import supabase from './lib/supabase'
import Inventory from './pages/Inventory'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Reports from './pages/Reports'
import MultiChannel from './pages/MultiChannel'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl text-blue-600 mb-2">Loading...</div>
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <Router>
      <div className="min-h-screen">
        {/* Navigation Bar */}
        <nav className="bg-white shadow-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  U4B Inventory System
                </h1>
                <div className="hidden md:flex space-x-4">
                  <Link to="/" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium transition">
                    📊 Dashboard
                  </Link>
                  <Link to="/inventory" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium transition">
                    📦 Inventory
                  </Link>
                  <Link to="/reports" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium transition">
                    📈 Reports
                  </Link>
                  <Link to="/multichannel" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium transition">
                    🏪 Multi-Channel
                  </Link>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">{session.user.email}</span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/multichannel" element={<MultiChannel />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App