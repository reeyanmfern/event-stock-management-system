import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'

export default function DebugEvents() {
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function testFetch() {
      try {
        console.log("1. Starting fetch...")
        
        const { data, error, status } = await supabase
          .from('events')
          .select('*')
        
        console.log("2. Response status:", status)
        console.log("3. Error object:", error)
        console.log("4. Data received:", data)
        
        if (error) throw error
        
        setEvents(data || [])
      } catch (err) {
        console.error("5. Caught error:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    testFetch()
  }, [])

  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Events Page</h1>
      <p className="mb-4">Found {events.length} events in database</p>
      
      {events.length === 0 ? (
        <div className="bg-yellow-100 p-4 rounded">
          No events found in database. Please add an event in Supabase first.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="border p-4 rounded bg-white">
              <strong>{event.name}</strong> - {event.event_date}
              <p className="text-sm text-gray-600">{event.description}</p>
            </div>
          ))}
        </div>
      )}
      
      <button 
        onClick={() => window.location.reload()}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Refresh
      </button>
    </div>
  )
}