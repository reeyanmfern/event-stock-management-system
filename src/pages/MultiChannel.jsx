import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function MultiChannel() {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [categories, setCategories] = useState(['All'])

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [products, searchTerm, selectedCategory, selectedChannel])

  async function fetchProducts() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variations (*)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setProducts(data || [])
      setFilteredProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
      
      if (error) throw error
      
      if (data) {
        const uniqueCategories = ['All', ...new Set(data.map(p => p.category))]
        setCategories(uniqueCategories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  function applyFilters() {
    let filtered = [...products]
    
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }
    
    setFilteredProducts(filtered)
  }

  function getChannelStock(product, channel) {
    if (product.product_variations && product.product_variations.length > 0) {
      return product.product_variations.reduce((sum, v) => sum + (v[`stock_${channel}`] || 0), 0)
    }
    return product[`stock_${channel}`] || 0
  }

  function getTotalStock(product) {
    if (product.product_variations && product.product_variations.length > 0) {
      return product.product_variations.reduce((sum, v) => sum + (v.quantity || 0), 0)
    }
    return product.quantity || 0
  }

  function exportToExcel() {
    const exportData = filteredProducts.map(product => {
      const row = {
        'Code': product.code,
        'Product Name': product.name,
        'Category': product.category,
        'U4B Label': getChannelStock(product, 'u4b'),
        '1World Label': getChannelStock(product, '1world'),
        'Zalora': getChannelStock(product, 'zalora'),
        'Website': getChannelStock(product, 'website'),
        'Total Stock': getTotalStock(product)
      }
      return row
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Multi_Channel_Stock')
    
    const date = new Date()
    const filename = `multi_channel_stock_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  // Calculate channel totals
  const channelTotals = {
    u4b: products.reduce((sum, p) => sum + getChannelStock(p, 'u4b'), 0),
    '1world': products.reduce((sum, p) => sum + getChannelStock(p, '1world'), 0),
    zalora: products.reduce((sum, p) => sum + getChannelStock(p, 'zalora'), 0),
    website: products.reduce((sum, p) => sum + getChannelStock(p, 'website'), 0)
  }

  const channels = [
    {
      key: 'u4b',
      label: 'U4B Label',
      accent: 'from-violet-500 to-violet-600',
      textColor: 'text-violet-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      )
    },
    {
      key: '1world',
      label: '1World Label',
      accent: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      )
    },
    {
      key: 'zalora',
      label: 'Zalora',
      accent: 'from-pink-500 to-rose-500',
      textColor: 'text-pink-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
      )
    },
    {
      key: 'website',
      label: 'Website',
      accent: 'from-emerald-500 to-emerald-600',
      textColor: 'text-emerald-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <p className="text-sm font-medium text-blue-600 mb-1">Distribution</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Multi-Channel Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">Stock allocation across all sales channels</p>
        </div>
        <button
          onClick={exportToExcel}
          className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl border border-gray-200 flex items-center gap-2 text-sm transition-colors w-fit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Channel Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {channels.map(ch => (
          <div key={ch.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${ch.accent}`}></div>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ch.accent} flex items-center justify-center shadow-sm`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {ch.icon}
                </svg>
              </div>
            </div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{ch.label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${ch.textColor}`}>{channelTotals[ch.key].toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">U4B</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">1World</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zalora</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Website</th>
                <th className="text-right py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map((product) => {
                const totalStock = getTotalStock(product)
                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 sm:px-6">
                      <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{product.code || '-'}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.category}</td>
                    <td className="text-right py-3 px-4 font-semibold text-violet-600 text-sm">
                      {getChannelStock(product, 'u4b').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-blue-600 text-sm">
                      {getChannelStock(product, '1world').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-pink-600 text-sm">
                      {getChannelStock(product, 'zalora').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-emerald-600 text-sm">
                      {getChannelStock(product, 'website').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 sm:px-6 font-bold text-gray-900 text-sm">
                      {totalStock.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-16 text-gray-400 text-sm">
                    No products found
                  </td>
                 </tr>
              )}
            </tbody>
            {filteredProducts.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-100">
                <tr>
                  <td colSpan="2" className="py-3 px-4 sm:px-6 font-bold text-gray-900 text-sm">Total</td>
                  <td className="text-right py-3 px-4 font-bold text-violet-700 text-sm">{channelTotals.u4b.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 font-bold text-blue-700 text-sm">{channelTotals['1world'].toLocaleString()}</td>
                  <td className="text-right py-3 px-4 font-bold text-pink-700 text-sm">{channelTotals.zalora.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 font-bold text-emerald-700 text-sm">{channelTotals.website.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 sm:px-6 font-bold text-gray-900 text-sm">{Object.values(channelTotals).reduce((a,b) => a + b, 0).toLocaleString()}</td>
                 </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Note about stock management */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </div>
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> Stock quantities shown are per sales channel.
          Total stock = U4B + 1World + Zalora + Website.
          Use the Inventory page to add or remove stock from individual channels.
        </p>
      </div>
    </div>
  )
}
