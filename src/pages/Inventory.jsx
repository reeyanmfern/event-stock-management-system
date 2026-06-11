import React, { useState, useEffect, useRef } from 'react'
import supabase from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pastedImage, setPastedImage] = useState(null)
  const imageInputRef = useRef(null)
  
  // Stock update modal states
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockTarget, setStockTarget] = useState(null) // { type: 'product' or 'variation', data: item, productName: string }
  const [stockUpdate, setStockUpdate] = useState({ type: 'add', quantity: 1, reason: '' })
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [categories, setCategories] = useState(['All'])

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Bags',
    sub_category: '',
    size: 'One Size',
    variety: '',
    material: '',
    weight_grams: '',
    dimensions: '',
    price: 0,
    main_sku: '',
    image_url: '',
    status: 'active',
    quantity: 0
  })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [products, searchTerm, selectedCategory])

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
      alert('Error fetching products: ' + error.message)
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

  async function uploadImage(file) {
    if (!file) return null
    
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${uuidv4()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)
      
      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const imageUrl = await uploadImage(file)
          if (imageUrl) {
            setFormData({...formData, image_url: imageUrl})
            setPastedImage(imageUrl)
          }
        }
        break
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', editingProduct.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert([formData])
        
        if (error) throw error
      }
      
      await fetchProducts()
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Error saving product: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id)
        
        if (error) throw error
        await fetchProducts()
      } catch (error) {
        console.error('Error deleting product:', error)
        alert('Error deleting product: ' + error.message)
      }
    }
  }

  // Open stock modal for product (no variations)
  function openProductStockModal(product, actionType) {
    setStockTarget({
      type: 'product',
      data: product,
      productName: product.name,
      currentStock: product.quantity || 0
    })
    setStockUpdate({ type: actionType, quantity: 1, reason: '' })
    setShowStockModal(true)
  }

  // Open stock modal for variation
  function openVariationStockModal(variation, productName, actionType) {
    setStockTarget({
      type: 'variation',
      data: variation,
      productName: productName,
      variationName: `${variation.variation_type}: ${variation.variation_value}`,
      currentStock: variation.quantity || 0
    })
    setStockUpdate({ type: actionType, quantity: 1, reason: '' })
    setShowStockModal(true)
  }

  // Submit stock update
  async function submitStockUpdate() {
    const { type, data } = stockTarget
    const newQuantity = stockUpdate.type === 'add' 
      ? (data.quantity || 0) + stockUpdate.quantity
      : (data.quantity || 0) - stockUpdate.quantity
    
    if (newQuantity < 0) {
      alert('Cannot reduce stock below 0!')
      return
    }
    
    // Update local state immediately
    if (type === 'product') {
      setProducts(prevProducts => prevProducts.map(p => 
        p.id === data.id ? { ...p, quantity: newQuantity } : p
      ))
    } else {
      setProducts(prevProducts => prevProducts.map(p => ({
        ...p,
        product_variations: p.product_variations?.map(v => 
          v.id === data.id ? { ...v, quantity: newQuantity } : v
        )
      })))
    }
    
    setShowStockModal(false)
    
    // Update database in background
    try {
      if (type === 'product') {
        const { error } = await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_variations')
          .update({ quantity: newQuantity })
          .eq('id', data.id)
        if (error) throw error
      }
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Error updating stock: ' + error.message)
      await fetchProducts() // Revert on error
    }
  }

  function exportToExcel() {
    const exportData = filteredProducts.map(product => ({
      'Code': product.code,
      'Product Name': product.name,
      'Category': product.category,
      'Sub Category': product.sub_category,
      'Size': product.size,
      'Material': product.material,
      'Price (RM)': product.price,
      'Stock': product.product_variations?.length > 0 
        ? product.product_variations.reduce((s, v) => s + (v.quantity || 0), 0)
        : (product.quantity || 0),
      'Status': product.status
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    
    const date = new Date()
    const filename = `inventory_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      category: 'Bags',
      sub_category: '',
      size: 'One Size',
      variety: '',
      material: '',
      weight_grams: '',
      dimensions: '',
      price: 0,
      main_sku: '',
      image_url: '',
      status: 'active',
      quantity: 0
    })
    setPastedImage(null)
    setEditingProduct(null)
  }

  function editProduct(product) {
    setEditingProduct(product)
    setFormData({
      code: product.code || '',
      name: product.name,
      category: product.category,
      sub_category: product.sub_category || '',
      size: product.size,
      variety: product.variety || '',
      material: product.material || '',
      weight_grams: product.weight_grams || '',
      dimensions: product.dimensions || '',
      price: product.price || 0,
      main_sku: product.main_sku || '',
      image_url: product.image_url || '',
      status: product.status || 'active',
      quantity: product.quantity || 0
    })
    setShowModal(true)
  }

  function clearFilters() {
    setSearchTerm('')
    setSelectedCategory('All')
  }

  const totalProducts = products.length
  const totalStock = products.reduce((sum, p) => {
    if (p.product_variations?.length > 0) {
      return sum + p.product_variations.reduce((s, v) => s + (v.quantity || 0), 0)
    }
    return sum + (p.quantity || 0)
  }, 0)
  const totalValue = products.reduce((sum, p) => {
    const qty = p.product_variations?.length > 0
      ? p.product_variations.reduce((s, v) => s + (v.quantity || 0), 0)
      : (p.quantity || 0)
    return sum + qty * (p.price || 0)
  }, 0)

  function stockColor(qty) {
    if (qty === 0) return 'text-rose-600'
    if (qty < 10) return 'text-amber-600'
    return 'text-emerald-600'
  }

  function stockBadge(qty) {
    if (qty === 0) return 'bg-rose-50 text-rose-700'
    if (qty < 10) return 'bg-amber-50 text-amber-700'
    return 'bg-emerald-50 text-emerald-700'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <p className="text-sm font-medium text-blue-600 mb-1">Catalog</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">Manage products, variations, and stock levels</p>
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
            onClick={() => { resetForm(); setShowModal(true) }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 text-sm transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total Products</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600"></div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total Stock Units</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{totalStock.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-violet-600"></div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Inventory Value</p>
          <p className="text-3xl font-bold text-violet-600 mt-1">RM {totalValue.toLocaleString()}</p>
        </div>
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
              placeholder="Search by product name..."
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
        {(searchTerm || selectedCategory !== 'All') && (
          <button onClick={clearFilters} className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-3">
            Clear filters
          </button>
        )}
      </div>

      {/* Products List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-16 px-6">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">No products found</p>
          <p className="text-gray-400 text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const hasVariations = product.product_variations && product.product_variations.length > 0
            const totalProductStock = hasVariations
              ? product.product_variations.reduce((s, v) => s + (v.quantity || 0), 0)
              : (product.quantity || 0)
            
            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="p-5 sm:p-6">
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div className="flex gap-4 flex-1 min-w-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border border-gray-100 flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start flex-wrap gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                {product.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-sm text-gray-500">
                              <span className="font-medium text-gray-700">{product.code || 'N/A'}</span>
                              {product.main_sku && <span>SKU: {product.main_sku}</span>}
                            </div>
                            <p className="text-sm text-gray-500 mt-1.5">
                              {product.category}{product.sub_category && ` · ${product.sub_category}`}
                            </p>
                            <p className="text-sm text-gray-500">
                              {product.size}{product.material && ` · ${product.material}`}
                            </p>
                            <p className="text-base font-bold text-gray-900 mt-2">RM {product.price}</p>
                          </div>
                          
                          {/* Stock Control for products without variations */}
                          {!hasVariations && (
                            <div className="bg-gray-50 rounded-xl p-4 min-w-[180px]">
                              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1.5">Current Stock</p>
                              <div className="flex items-center justify-between gap-3">
                                <span className={`text-2xl font-bold ${stockColor(product.quantity || 0)}`}>
                                  {product.quantity || 0}
                                </span>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => openProductStockModal(product, 'add')}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white w-8 h-8 rounded-lg text-base font-bold flex items-center justify-center transition-colors"
                                    title="Add stock"
                                  >
                                    +
                                  </button>
                                  <button
                                    onClick={() => openProductStockModal(product, 'remove')}
                                    className="bg-rose-500 hover:bg-rose-600 text-white w-8 h-8 rounded-lg text-base font-bold flex items-center justify-center transition-colors"
                                    title="Remove stock"
                                  >
                                    −
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => editProduct(product)}
                        className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                        title="Edit product"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                        title="Delete product"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Variations Table (if exists) */}
                  {hasVariations && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Variations</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stockBadge(totalProductStock)}`}>
                          {totalProductStock} total units
                        </span>
                      </div>
                      <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {product.product_variations.map((variation) => (
                              <tr key={variation.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 px-2 text-gray-700">{variation.variation_type}</td>
                                <td className="py-2.5 px-2 font-medium text-gray-900">{variation.variation_value}</td>
                                <td className="py-2.5 px-2 text-xs text-gray-400">{variation.sku || '-'}</td>
                                <td className="text-right py-2.5 px-2 font-bold">
                                  <span className={stockColor(variation.quantity || 0)}>
                                    {variation.quantity || 0}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2">
                                  <div className="flex gap-1.5 justify-center">
                                    <button
                                      onClick={() => openVariationStockModal(variation, product.name, 'add')}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-white w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                                    >
                                      +
                                    </button>
                                    <button
                                      onClick={() => openVariationStockModal(variation, product.name, 'remove')}
                                      className="bg-rose-500 hover:bg-rose-600 text-white w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                                    >
                                      −
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Stock Update Modal */}
      {showStockModal && stockTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${stockUpdate.type === 'add' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <svg className={`w-6 h-6 ${stockUpdate.type === 'add' ? 'text-emerald-600' : 'text-rose-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {stockUpdate.type === 'add' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                )}
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {stockUpdate.type === 'add' ? 'Add Stock' : 'Remove Stock'}
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              <span className="font-semibold text-gray-700">{stockTarget.productName}</span>
              {stockTarget.variationName && (
                <span className="block text-sm text-gray-400">
                  {stockTarget.variationName}
                </span>
              )}
              <span className="block mt-1">
                Current stock: <span className="font-semibold text-blue-600">{stockTarget.currentStock}</span>
              </span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
              <input
                type="number"
                min="1"
                value={stockUpdate.quantity}
                onChange={(e) => setStockUpdate({...stockUpdate, quantity: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={stockUpdate.reason}
                onChange={(e) => setStockUpdate({...stockUpdate, reason: e.target.value})}
                placeholder="e.g. New batch, Sold, Damaged"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStockModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitStockUpdate}
                className={`flex-1 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm ${stockUpdate.type === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                Confirm {stockUpdate.type === 'add' ? 'Add' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal (Add/Edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onPaste={handlePaste}>
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{editingProduct ? 'Update product details' : 'Add a new item to your catalog'}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Code</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name *</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                  <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                    <option>Bags</option>
                    <option>Home & Decor</option>
                    <option>Pet</option>
                    <option>Accessories</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sub Category</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.sub_category} onChange={(e) => setFormData({...formData, sub_category: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Size</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.size} onChange={(e) => setFormData({...formData, size: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.material} onChange={(e) => setFormData({...formData, material: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dimensions</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.dimensions} onChange={(e) => setFormData({...formData, dimensions: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (RM)</label>
                  <input type="number" step="0.01" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.price} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Main SKU</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.main_sku} onChange={(e) => setFormData({...formData, main_sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Initial Stock</label>
                  <input type="number" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="discontinued">Discontinued</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Image</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 transition-colors" onPaste={handlePaste}>
                  <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Press Ctrl+V (Cmd+V on Mac) to paste an image</p>
                  <p className="text-xs text-gray-400 mt-1">or</p>
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2">
                    Click to upload file
                  </button>
                  <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files[0]
                    if (file) {
                      const imageUrl = await uploadImage(file)
                      if (imageUrl) setFormData({...formData, image_url: imageUrl})
                    }
                  }} />
                </div>
                {formData.image_url && (
                  <div className="mt-3 relative inline-block">
                    <img src={formData.image_url} alt="Preview" className="w-28 h-28 object-cover rounded-xl border border-gray-100 mx-auto" />
                    <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full w-6 h-6 text-xs font-bold flex items-center justify-center shadow-sm">
                      ✕
                    </button>
                  </div>
                )}
                {uploading && (
                  <p className="text-sm text-blue-600 text-center mt-2 flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                    Uploading...
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
