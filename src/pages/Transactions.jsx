import React, { useState, useEffect, useRef } from 'react'
import supabase from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [filteredTransactions, setFilteredTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // New Sale form
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [products, setProducts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const [saleData, setSaleData] = useState({
    event_name: '',
    product_id: '',
    quantity: 1,
    person_name: '',
    receipt_url: ''
  })

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, searchTerm, dateFrom, dateTo])

  async function fetchTransactions() {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
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

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('quantity', 0)
        .order('name')
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      alert('Error loading products: ' + error.message)
    }
  }

  function openSaleModal() {
    setSaleData({ event_name: '', product_id: '', quantity: 1, person_name: '', receipt_url: '' })
    setReceiptPreview(null)
    fetchProducts()
    setShowSaleModal(true)
  }

  async function handleReceiptFile(file) {
    if (!file) return

    const localPreview = URL.createObjectURL(file)
    setReceiptPreview(localPreview)

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${uuidv4()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      setSaleData(prev => ({ ...prev, receipt_url: publicUrl }))
    } catch (error) {
      alert('Failed to upload receipt: ' + error.message)
      setReceiptPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function removeReceipt() {
    setReceiptPreview(null)
    setSaleData(prev => ({ ...prev, receipt_url: '' }))
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  async function handleRecordSale(e) {
    e.preventDefault()

    if (!saleData.event_name.trim()) {
      alert('Please enter an event name.')
      return
    }
    if (!saleData.product_id) {
      alert('Please select a product.')
      return
    }
    if (!saleData.person_name.trim()) {
      alert('Please enter the person in charge.')
      return
    }

    setSubmitting(true)
    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', saleData.product_id)
        .single()

      if (productError) throw productError

      if (product.quantity < saleData.quantity) {
        alert(`Only ${product.quantity} item(s) left in stock!`)
        setSubmitting(false)
        return
      }

      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          event_name: saleData.event_name.trim(),
          product_id: saleData.product_id,
          quantity: saleData.quantity,
          type: 'checkout',
          person_name: saleData.person_name.trim(),
          receipt_url: saleData.receipt_url || null
        }])

      if (txError) throw txError

      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: product.quantity - saleData.quantity })
        .eq('id', saleData.product_id)

      if (updateError) throw updateError

      await fetchTransactions()
      setShowSaleModal(false)
      setReceiptPreview(null)
      setSaleData({ event_name: '', product_id: '', quantity: 1, person_name: '', receipt_url: '' })
    } catch (error) {
      alert('Error recording sale: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function applyFilters() {
    let filtered = [...transactions]

    if (searchTerm) {
      filtered = filtered.filter(tx =>
        (tx.person_name && tx.person_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.products?.name && tx.products.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.event_name && tx.event_name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

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
      'Event': tx.event_name || '-',
      'Product': tx.products?.name || '-',
      'Category': tx.products?.category || '-',
      'Size': tx.products?.size || '-',
      'Quantity': tx.quantity,
      'Person In Charge': tx.person_name || '-',
      'Price (RM)': tx.products?.price || '-',
      'Total (RM)': ((tx.products?.price || 0) * tx.quantity).toLocaleString(),
      'Receipt': tx.receipt_url ? 'Yes' : 'No'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')

    const date = new Date()
    const filename = `transactions_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const totalSales = filteredTransactions.length
  const totalItems = filteredTransactions.reduce((sum, t) => sum + t.quantity, 0)
  const totalRevenue = filteredTransactions.reduce((sum, t) => sum + ((t.products?.price || 0) * t.quantity), 0)

  const selectedProduct = products.find(p => p.id === saleData.product_id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">Sales history at events</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl border border-gray-200 flex items-center gap-2 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={openSaleModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 text-sm transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Sale
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-gray-500 text-sm">Total Sales</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{totalSales}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-gray-500 text-sm">Items Sold</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{totalItems}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-gray-500 text-sm">Total Revenue</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">RM {totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
            <input
              type="text"
              placeholder="Person, product, or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-500">
            Showing {filteredTransactions.length} of {transactions.length}
          </p>
          {(searchTerm || dateFrom || dateTo) && (
            <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total (RM)</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Person in Charge</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-400 text-sm">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 text-sm">{tx.event_name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 text-sm">{tx.products?.name || '-'}</span>
                      <br />
                      <span className="text-xs text-gray-400">
                        {tx.products?.category} {tx.products?.size ? `· ${tx.products.size}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-sm">{tx.quantity}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {((tx.products?.price || 0) * tx.quantity).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{tx.person_name || '-'}</td>
                    <td className="py-3 px-4">
                      {tx.receipt_url ? (
                        <a
                          href={tx.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          View
                        </a>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Sale Modal */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">New Sale</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Record a stock sale at an event</p>
                </div>
                <button
                  onClick={() => setShowSaleModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleRecordSale} className="p-6 space-y-4">
              {/* Event Name (free text) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sunway Pyramid Pop-up, June 2026"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                  value={saleData.event_name}
                  onChange={(e) => setSaleData({ ...saleData, event_name: e.target.value })}
                  required
                />
              </div>

              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                  value={saleData.product_id}
                  onChange={(e) => setSaleData({ ...saleData, product_id: e.target.value, quantity: 1 })}
                  required
                >
                  <option value="">Select product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.size ? `(${p.size})` : ''} — {p.quantity} in stock
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Quantity {selectedProduct ? `(max ${selectedProduct.quantity})` : ''}
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct?.quantity || undefined}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                  value={saleData.quantity}
                  onChange={(e) => setSaleData({ ...saleData, quantity: parseInt(e.target.value) || 1 })}
                  required
                />
                {selectedProduct && (
                  <p className="text-xs text-gray-400 mt-1">
                    Total: RM {((selectedProduct.price || 0) * saleData.quantity).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Person in charge */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Person in Charge</label>
                <input
                  type="text"
                  placeholder="Name of staff handling this sale"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                  value={saleData.person_name}
                  onChange={(e) => setSaleData({ ...saleData, person_name: e.target.value })}
                  required
                />
              </div>

              {/* Receipt photo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Receipt Photo</label>

                {receiptPreview ? (
                  <div className="relative">
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="w-full h-48 object-cover rounded-xl border border-gray-200"
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {!uploading && (
                      <button
                        type="button"
                        onClick={removeReceipt}
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-1.5 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {!uploading && saleData.receipt_url && (
                      <span className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                        Uploaded
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-gray-500 hover:text-blue-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-medium">Take Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-gray-500 hover:text-blue-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">Choose File</span>
                    </button>
                  </div>
                )}

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                />

                <p className="text-xs text-gray-400 mt-1.5">Optional — but recommended for record-keeping</p>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Recording...
                    </span>
                  ) : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
