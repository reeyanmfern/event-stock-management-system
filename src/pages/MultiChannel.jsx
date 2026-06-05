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

  const channelIcons = {
    u4b: '🏪',
    '1world': '🌍',
    zalora: '🛍️',
    website: '💻'
  }

  const channelColors = {
    u4b: 'bg-purple-100 text-purple-700',
    '1world': 'bg-blue-100 text-blue-700',
    zalora: 'bg-pink-100 text-pink-700',
    website: 'bg-green-100 text-green-700'
  }

  if (loading) {
    return <div className="text-center py-8">Loading multi-channel inventory...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Multi-Channel Inventory</h1>
        <button
          onClick={exportToExcel}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
        >
          📥 Export to Excel
        </button>
      </div>

      {/* Channel Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-purple-50 rounded-xl shadow-md p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm">🏪 U4B Label</p>
              <p className="text-2xl font-bold text-purple-700">{channelTotals.u4b.toLocaleString()}</p>
            </div>
            <div className="text-3xl">🏪</div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl shadow-md p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm">🌍 1World Label</p>
              <p className="text-2xl font-bold text-blue-700">{channelTotals['1world'].toLocaleString()}</p>
            </div>
            <div className="text-3xl">🌍</div>
          </div>
        </div>
        <div className="bg-pink-50 rounded-xl shadow-md p-4 border border-pink-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-pink-600 text-sm">🛍️ Zalora</p>
              <p className="text-2xl font-bold text-pink-700">{channelTotals.zalora.toLocaleString()}</p>
            </div>
            <div className="text-3xl">🛍️</div>
          </div>
        </div>
        <div className="bg-green-50 rounded-xl shadow-md p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm">💻 Website</p>
              <p className="text-2xl font-bold text-green-700">{channelTotals.website.toLocaleString()}</p>
            </div>
            <div className="text-3xl">💻</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="🔍 Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Product</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-right py-3 px-4">🏪 U4B</th>
                <th className="text-right py-3 px-4">🌍 1World</th>
                <th className="text-right py-3 px-4">🛍️ Zalora</th>
                <th className="text-right py-3 px-4">💻 Website</th>
                <th className="text-right py-3 px-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const totalStock = getTotalStock(product)
                return (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-500">Code: {product.code || '-'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">{product.category}</td>
                    <td className="text-right py-3 px-4 font-semibold text-purple-600">
                      {getChannelStock(product, 'u4b').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-blue-600">
                      {getChannelStock(product, '1world').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-pink-600">
                      {getChannelStock(product, 'zalora').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-green-600">
                      {getChannelStock(product, 'website').toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 font-bold">
                      {totalStock.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No products found
                  </td>
                 </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr className="border-t">
                <td colSpan="2" className="py-3 px-4">TOTAL</td>
                <td className="text-right py-3 px-4 text-purple-700">{channelTotals.u4b.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-blue-700">{channelTotals['1world'].toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-pink-700">{channelTotals.zalora.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-green-700">{channelTotals.website.toLocaleString()}</td>
                <td className="text-right py-3 px-4">{Object.values(channelTotals).reduce((a,b) => a + b, 0).toLocaleString()}</td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Note about stock management */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          📌 <strong>Note:</strong> Stock quantities shown are per sales channel. 
          Total stock = U4B + 1World + Zalora + Website. 
          Use the Inventory page to add/remove stock from individual channels.
        </p>
      </div>
    </div>
  )
}