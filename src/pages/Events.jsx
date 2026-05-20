import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default function Events() {
  const [events, setEvents] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    event_date: '',
    description: ''
  })
  const [checkoutData, setCheckoutData] = useState({
    product_id: '',
    quantity: 1,
    person_name: '',
    receipt_url: ''
  })

  useEffect(() => {
    fetchEvents()
    fetchProducts()
  }, [])

  async function fetchEvents() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false })
      
      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('quantity', 0)
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  async function uploadReceipt(file) {
    if (!file) return null
    
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${uuidv4()}.${fileExt}`
      const filePath = `${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath)
      
      return publicUrl
    } catch (error) {
      console.error('Error uploading receipt:', error)
      alert('Failed to upload receipt')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('events')
        .insert([formData])
      
      if (error) throw error
      
      await fetchEvents()
      setShowModal(false)
      setFormData({ name: '', event_date: '', description: '' })
      alert('Event created successfully!')
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  async function handleCheckout(e) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', checkoutData.product_id)
        .single()

      if (productError) throw productError

      if (product.quantity < checkoutData.quantity) {
        alert(`Only ${product.quantity} items available!`)
        setLoading(false)
        return
      }

      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          event_id: selectedEvent.id,
          product_id: checkoutData.product_id,
          quantity: checkoutData.quantity,
          type: 'checkout',
          person_name: checkoutData.person_name,
          receipt_url: checkoutData.receipt_url
        }])

      if (txError) throw txError

      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: product.quantity - checkoutData.quantity })
        .eq('id', checkoutData.product_id)

      if (updateError) throw updateError

      await fetchEvents()
      await fetchProducts()
      setShowCheckoutModal(false)
      setCheckoutData({ product_id: '', quantity: 1, person_name: '', receipt_url: '' })
      alert('Items checked out successfully!')
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Event Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
        >
          + Create Event
        </button>
      </div>

      <div className="space-y-4">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{event.name}</h2>
                <p className="text-sm text-gray-500">
                  {new Date(event.event_date).toLocaleDateString()}
                </p>
                {event.description && (
                  <p className="text-gray-600 mt-1">{event.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedEvent(event)
                  setShowCheckoutModal(true)
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Check Out Items
              </button>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No events yet. Click "Create Event" to get started.
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create Event</h2>
            <form onSubmit={handleCreateEvent}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Event Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Event Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formData.event_date}
                  onChange={(e) => setFormData({...formData, event_date: e.target.value})}
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex-1">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="bg-gray-500 text-white px-4 py-2 rounded-lg flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Check Out - {selectedEvent.name}</h2>
            <form onSubmit={handleCheckout}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Product</label>
                <select
                  className="w-full px-4 py-2 border rounded-lg"
                  value={checkoutData.product_id}
                  onChange={(e) => setCheckoutData({...checkoutData, product_id: e.target.value})}
                  required
                >
                  <option value="">Select product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - Stock: {p.quantity}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={checkoutData.quantity}
                  onChange={(e) => setCheckoutData({...checkoutData, quantity: parseInt(e.target.value)})}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Person Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={checkoutData.person_name}
                  onChange={(e) => setCheckoutData({...checkoutData, person_name: e.target.value})}
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Payment Receipt</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full px-4 py-2 border rounded-lg"
                  onChange={async (e) => {
                    const file = e.target.files[0]
                    if (file) {
                      const url = await uploadReceipt(file)
                      if (url) setCheckoutData({...checkoutData, receipt_url: url})
                    }
                  }}
                />
                {uploading && <p className="text-blue-600 text-sm mt-1">Uploading...</p>}
                {checkoutData.receipt_url && <p className="text-green-600 text-sm mt-1">✓ Receipt uploaded</p>}
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg flex-1">Check Out</button>
                <button type="button" onClick={() => setShowCheckoutModal(false)} className="bg-gray-500 text-white px-4 py-2 rounded-lg flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}