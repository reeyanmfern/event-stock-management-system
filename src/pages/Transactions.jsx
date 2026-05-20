import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [filteredTransactions, setFilteredTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, searchTerm, typeFilter, dateFrom, dateTo])

  async function fetchTransactions() {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          events (name, event_date),
          products (name, category, size, price)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTransactions(data || [])
      setFilteredTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
      alert('Error fetching transactions: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...transactions]
    
    // Search by person name or product name
    if (searchTerm) {
      filtered = filtered.filter(tx =>
        (tx.person_name && tx.person_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.products?.name && tx.products.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.events?.name && tx.events.name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    
    // Filter by type (checkout/checkin)
    if (typeFilter !== 'All') {
      filtered = filtered.filter(tx => tx.type === typeFilter)
    }
    
    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(tx => new Date(tx.created_at) >= new Date(dateFrom))
    }
    if (dateTo) {
      filtered = filtered.filter(tx => new Date(tx.created_at) <= new Date(dateTo))
    }
    
    setFilteredTransactions(filtered)
  }

  function clearFilters() {
    setSearchTerm('')
    setTypeFilter('All')
    setDateFrom('')
    setDateTo('')
  }

  function exportToExcel() {
    if (filteredTransactions.length === 0) {
      alert('No transactions to export!')
      return
    }

    const exportData = filteredTransactions.map(tx => ({
      'Date': new Date(tx.created_at).toLocaleString(),
      'Event': tx.events?.name || '-',
      'Product': tx.products?.name || '-',
      'Category': tx.products?.category || '-',
      'Size': tx.products?.size || '-',
      'Quantity': tx.quantity,
      'Type': tx.type === 'checkout' ? 'Check Out' : 'Check In',
      'Person': tx.person_name || '-',
      'Price (RM)': tx.products?.price || '-',
      'Receipt': tx.receipt_url ? 'Yes' : 'No'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    
    const date = new Date()
    const filename = `transactions_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.xlsx`
    XLSX.writeFile(wb, filename)
    
    alert(`Exported ${filteredTransactions.length} transactions to ${filename}`)
  }

  // Calculate summary stats
  const totalCheckouts = filteredTransactions.filter(t => t.type === 'checkout').length
  const totalCheckins = filteredTransactions.filter(t => t.type === 'checkin').length
  const totalItems = filteredTransactions.reduce((sum, t) => sum + t.quantity, 0)

  if (loading) {
    return <div className="text-center py-8">Loading transactions...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Transaction History</h1>
        <button
          onClick={exportToExcel}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
        >
          📊 Export to Excel
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Checkouts</p>
              <p className="text-2xl font-bold text-orange-600">{totalCheckouts}</p>
            </div>
            <div className="text-3xl">📤</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Checkins</p>
              <p className="text-2xl font-bold text-green-600">{totalCheckins}</p>
            </div>
            <div className="text-3xl">📥</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Items Moved</p>
              <p className="text-2xl font-bold text-blue-600">{totalItems}</p>
            </div>
            <div className="text-3xl">📦</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by person, product, or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="All">All</option>
              <option value="checkout">Check Out</option>
              <option value="checkin">Check In</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-600">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>
          {(searchTerm || typeFilter !== 'All' || dateFrom || dateTo) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Date & Time</th>
                <th className="text-left py-3 px-4">Event</th>
                <th className="text-left py-3 px-4">Product</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Quantity</th>
                <th className="text-left py-3 px-4">Person</th>
                <th className="text-left py-3 px-4">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium">{tx.events?.name || '-'}</span>
                      <br />
                      <span className="text-xs text-gray-500">
                        {tx.events?.event_date ? new Date(tx.events.event_date).toLocaleDateString() : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium">{tx.products?.name || '-'}</span>
                      <br />
                      <span className="text-xs text-gray-500">
                        {tx.products?.category} - {tx.products?.size}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        tx.type === 'checkout' 
                          ? 'bg-orange-100 text-orange-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {tx.type === 'checkout' ? 'Check Out' : 'Check In'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{tx.quantity}</td>
                    <td className="py-3 px-4">{tx.person_name || '-'}</td>
                    <td className="py-3 px-4">
                      {tx.receipt_url ? (
                        <a 
                          href={tx.receipt_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-sm"
                        >
                          View Receipt
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">No receipt</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}