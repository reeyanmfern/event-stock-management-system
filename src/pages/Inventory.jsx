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
  const [editingQuantity, setEditingQuantity] = useState(null)
  
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

  // Direct quantity update for products (no variations)
  async function updateProductQuantity(product, newQuantity) {
    if (newQuantity < 0) {
      alert('Quantity cannot be negative!')
      return
    }
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', product.id)
      
      if (error) throw error
      await fetchProducts()
      setEditingQuantity(null)
    } catch (error) {
      console.error('Error updating quantity:', error)
      alert('Error updating quantity: ' + error.message)
    }
  }

  // Direct quantity update for variations
  async function updateVariationQuantity(variation, newQuantity) {
    if (newQuantity < 0) {
      alert('Quantity cannot be negative!')
      return
    }
    
    try {
      const { error } = await supabase
        .from('product_variations')
        .update({ quantity: newQuantity })
        .eq('id', variation.id)
      
      if (error) throw error
      await fetchProducts()
      setEditingQuantity(null)
    } catch (error) {
      console.error('Error updating quantity:', error)
      alert('Error updating quantity: ' + error.message)
    }
  }

  // Quick add/remove (no modal, no reason)
  async function quickStockUpdate(item, type, isVariation = false) {
    const currentQty = isVariation ? (item.quantity || 0) : (item.quantity || 0)
    const newQuantity = type === 'add' ? currentQty + 1 : currentQty - 1
    
    if (newQuantity < 0) {
      alert('Cannot go below 0!')
      return
    }
    
    try {
      if (isVariation) {
        const { error } = await supabase
          .from('product_variations')
          .update({ quantity: newQuantity })
          .eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', item.id)
        if (error) throw error
      }
      await fetchProducts()
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Error updating stock: ' + error.message)
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
    
    alert(`Exported ${filteredProducts.length} products`)
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2">
            📊 Export to Excel
          </button>
          <button onClick={() => { resetForm(); setShowModal(true) }} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg">
            + Add Product
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-500 text-sm">Total Products</p>
          <p className="text-2xl font-bold text-blue-600">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-500 text-sm">Total Stock Units</p>
          <p className="text-2xl font-bold text-green-600">{totalStock.toLocaleString()}</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="🔍 Search by product name..."
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
        {(searchTerm || selectedCategory !== 'All') && (
          <button onClick={clearFilters} className="text-blue-600 hover:text-blue-800 text-sm mt-3">
            Clear Filters
          </button>
        )}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-8">Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No products found.</div>
      ) : (
        <div className="space-y-6">
          {filteredProducts.map((product) => {
            const hasVariations = product.product_variations && product.product_variations.length > 0
            const totalProductStock = hasVariations
              ? product.product_variations.reduce((s, v) => s + (v.quantity || 0), 0)
              : (product.quantity || 0)
            
            return (
              <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div className="flex gap-4 flex-1">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} className="w-24 h-24 object-cover rounded-lg" />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start flex-wrap gap-4">
                          <div>
                            <h2 className="text-xl font-semibold text-gray-800">{product.name}</h2>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-sm text-gray-500">Code: {product.code || 'N/A'}</span>
                              <span className="text-sm text-gray-500">SKU: {product.main_sku || 'N/A'}</span>
                              <span className={`text-sm px-2 py-0.5 rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {product.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">Category: {product.category} {product.sub_category && `> ${product.sub_category}`}</p>
                            <p className="text-sm text-gray-500">Size: {product.size} | Material: {product.material || 'N/A'}</p>
                            <p className="text-sm text-gray-500 font-semibold mt-1">Price: RM {product.price}</p>
                          </div>
                          
                          {/* Stock Control for products without variations */}
                          {!hasVariations && (
                            <div className="bg-gray-50 rounded-lg p-3 min-w-[180px]">
                              <p className="text-xs text-gray-500 mb-1">Current Stock</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => quickStockUpdate(product, 'remove', false)}
                                  className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full font-bold text-lg flex items-center justify-center"
                                >
                                  -
                                </button>
                                
                                {editingQuantity === product.id ? (
                                  <input
                                    type="number"
                                    className="w-20 text-center py-1 border border-blue-500 rounded-lg focus:outline-none"
                                    defaultValue={product.quantity || 0}
                                    onBlur={(e) => {
                                      updateProductQuantity(product, parseInt(e.target.value) || 0)
                                    }}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        updateProductQuantity(product, parseInt(e.target.value) || 0)
                                      }
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <span 
                                    className="text-2xl font-bold text-blue-600 cursor-pointer px-3 py-1 rounded-lg hover:bg-blue-50"
                                    onClick={() => setEditingQuantity(product.id)}
                                  >
                                    {product.quantity || 0}
                                  </span>
                                )}
                                
                                <button
                                  onClick={() => quickStockUpdate(product, 'add', false)}
                                  className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full font-bold text-lg flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">Click number to edit</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => editProduct(product)} className="text-blue-600 hover:text-blue-800">✏️ Edit</button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800">🗑️ Delete</button>
                    </div>
                  </div>

                  {/* Variations Table (if exists) */}
                  {hasVariations && (
                    <div className="mt-4">
                      <h3 className="font-medium text-gray-700 mb-2">📦 Variations & Stock:</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Type</th>
                              <th className="text-left py-2">Value</th>
                              <th className="text-left py-2">SKU</th>
                              <th className="text-center py-2" colSpan="3">Stock Control</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.product_variations.map((variation) => (
                              <tr key={variation.id} className="border-b">
                                <td className="py-2">{variation.variation_type}</td>
                                <td className="py-2">{variation.variation_value}</td>
                                <td className="py-2 text-xs">{variation.sku || '-'}</td>
                                <td className="py-2 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => quickStockUpdate(variation, 'remove', true)}
                                      className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full font-bold text-sm"
                                    >
                                      -
                                    </button>
                                    
                                    {editingQuantity === variation.id ? (
                                      <input
                                        type="number"
                                        className="w-16 text-center py-1 border border-blue-500 rounded-lg text-sm"
                                        defaultValue={variation.quantity || 0}
                                        onBlur={(e) => {
                                          updateVariationQuantity(variation, parseInt(e.target.value) || 0)
                                        }}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            updateVariationQuantity(variation, parseInt(e.target.value) || 0)
                                          }
                                        }}
                                        autoFocus
                                      />
                                    ) : (
                                      <span 
                                        className="font-bold text-blue-600 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 min-w-[40px] text-center"
                                        onClick={() => setEditingQuantity(variation.id)}
                                      >
                                        {variation.quantity || 0}
                                      </span>
                                    )}
                                    
                                    <button
                                      onClick={() => quickStockUpdate(variation, 'add', true)}
                                      className="bg-green-500 hover:bg-green-600 text-white w-7 h-7 rounded-full font-bold text-sm"
                                    >
                                      +
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

      {/* Product Modal (Add/Edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onPaste={handlePaste}>
            <h2 className="text-xl font-bold mb-4">{editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Product Code</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Product Name *</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select className="w-full px-4 py-2 border rounded-lg" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                    <option>Bags</option>
                    <option>Home & Decor</option>
                    <option>Pet</option>
                    <option>Accessories</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sub Category</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.sub_category} onChange={(e) => setFormData({...formData, sub_category: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Size</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.size} onChange={(e) => setFormData({...formData, size: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Material</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.material} onChange={(e) => setFormData({...formData, material: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dimensions</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.dimensions} onChange={(e) => setFormData({...formData, dimensions: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (RM)</label>
                  <input type="number" step="0.01" className="w-full px-4 py-2 border rounded-lg" value={formData.price} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Main SKU</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.main_sku} onChange={(e) => setFormData({...formData, main_sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Initial Stock</label>
                  <input type="number" className="w-full px-4 py-2 border rounded-lg" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="w-full px-4 py-2 border rounded-lg" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="discontinued">Discontinued</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-6 mt-4">
                <label className="block text-sm font-medium mb-1">Product Image</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center" onPaste={handlePaste}>
                  <p className="text-sm text-gray-500 mb-2">📋 Press Ctrl+V (Cmd+V on Mac) to paste an image</p>
                  <p className="text-xs text-gray-400">or</p>
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="text-sm text-blue-600 hover:text-blue-800 mt-2">
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
                  <div className="mt-3 relative">
                    <img src={formData.image_url} alt="Preview" className="w-32 h-32 object-cover rounded-lg mx-auto" />
                    <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="absolute top-0 right-1/3 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 text-xs font-bold">
                      ✕
                    </button>
                  </div>
                )}
                {uploading && <p className="text-sm text-blue-600 text-center mt-2">Uploading...</p>}
              </div>

              <div className="flex space-x-3">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex-1">Save Product</button>
                <button type="button" onClick={() => setShowModal(false)} className="bg-gray-500 text-white px-4 py-2 rounded-lg flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}