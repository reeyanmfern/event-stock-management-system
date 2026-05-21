import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState(null)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockUpdate, setStockUpdate] = useState({ type: 'add', quantity: 1, reason: '' })
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [stockFilter, setStockFilter] = useState('All')
  
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
    status: 'active'
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      
      // Fetch products with their variations
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variations (*)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('Error fetching products: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStockUpdate(variation, type) {
    setSelectedVariation(variation)
    setStockUpdate({ type, quantity: 1, reason: '' })
    setShowStockModal(true)
  }

  async function submitStockUpdate() {
    try {
      const variation = selectedVariation
      const newQuantity = stockUpdate.type === 'add' 
        ? (variation.quantity || 0) + stockUpdate.quantity
        : (variation.quantity || 0) - stockUpdate.quantity
      
      if (newQuantity < 0) {
        alert('Cannot reduce stock below 0!')
        return
      }

      // Update variation quantity
      const { error: updateError } = await supabase
        .from('product_variations')
        .update({ quantity: newQuantity })
        .eq('id', variation.id)
      
      if (updateError) throw updateError

      // Record inventory movement
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert([{
          product_id: variation.product_id,
          variation_id: variation.id,
          movement_type: stockUpdate.type === 'add' ? 'in' : 'out',
          quantity: stockUpdate.quantity,
          previous_quantity: variation.quantity || 0,
          new_quantity: newQuantity,
          reason: stockUpdate.reason || (stockUpdate.type === 'add' ? 'Stock added' : 'Stock removed'),
          created_by: 'Admin'
        }])
      
      if (movementError) throw movementError

      await fetchProducts()
      setShowStockModal(false)
      setSelectedVariation(null)
      alert(`Stock ${stockUpdate.type === 'add' ? 'added' : 'removed'} successfully!`)
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Error updating stock: ' + error.message)
    }
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
    if (confirm('Are you sure you want to delete this product and all its variations?')) {
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
      status: 'active'
    })
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
      status: product.status || 'active'
    })
    setShowModal(true)
  }

  // Filter products
  const filteredProducts = products.filter(product => {
    if (searchTerm && !product.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (selectedCategory !== 'All' && product.category !== selectedCategory) {
      return false
    }
    return true
  })

  const [categories, setCategories] = useState(['All'])
  // Fetch unique categories from database
useEffect(() => {
  async function fetchCategories() {
    const { data } = await supabase
      .from('products')
      .select('category')
      .not('category', 'is', null)
    
    if (data) {
      const uniqueCategories = ['All', ...new Set(data.map(p => p.category).filter(Boolean))]
      setCategories(uniqueCategories)
    }
  }
  fetchCategories()
}, [])
// Add this after your existing useEffect
useEffect(() => {
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
  fetchCategories()
}, [])

  // Calculate total stock
  const totalProducts = products.length
  const totalStock = products.reduce((sum, p) => {
    const variationStock = p.product_variations?.reduce((s, v) => s + (v.quantity || 0), 0) || 0
    return sum + variationStock
  }, 0)
  const lowStockCount = products.filter(p => {
    return p.product_variations?.some(v => (v.quantity || 0) < 10 && (v.quantity || 0) > 0)
  }).length

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
        >
          + Add Product
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-500 text-sm">Total Products</p>
          <p className="text-2xl font-bold text-blue-600">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-500 text-sm">Total Stock Units</p>
          <p className="text-2xl font-bold text-green-600">{totalStock}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-500 text-sm">Low Stock Items</p>
          <p className="text-2xl font-bold text-orange-600">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-500 text-sm">Active Products</p>
          <p className="text-2xl font-bold text-purple-600">{products.filter(p => p.status === 'active').length}</p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by product name..."
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

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-8">Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No products found.</div>
      ) : (
        <div className="space-y-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{product.name}</h2>
                    <div className="flex gap-2 mt-1">
                      <span className="text-sm text-gray-500">Code: {product.code || 'N/A'}</span>
                      <span className="text-sm text-gray-500">SKU: {product.main_sku || 'N/A'}</span>
                      <span className={`text-sm px-2 py-0.5 rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {product.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Category: {product.category} {product.sub_category && `> ${product.sub_category}`}</p>
                    {product.material && <p className="text-sm text-gray-500">Material: {product.material}</p>}
                    {product.dimensions && <p className="text-sm text-gray-500">Dimensions: {product.dimensions}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editProduct(product)} className="text-blue-600 hover:text-blue-800">✏️ Edit</button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800">🗑️ Delete</button>
                  </div>
                </div>

                {/* Variations Table */}
                {product.product_variations && product.product_variations.length > 0 ? (
                  <div className="mt-4">
                    <h3 className="font-medium text-gray-700 mb-2">Variations & Stock:</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Type</th>
                            <th className="text-left py-2">Value</th>
                            <th className="text-left py-2">SKU</th>
                            <th className="text-left py-2">Stock</th>
                            <th className="text-left py-2">Actions</th>
                          </tr>
                                                </thead>
                        <tbody>
                          {product.product_variations.map((variation) => (
                            <tr key={variation.id} className="border-b">
                              <td className="py-2">{variation.variation_type}</td>
                              <td className="py-2">{variation.variation_value}</td>
                              <td className="py-2 text-xs">{variation.sku || '-'}</td>
                              <td className="py-2">
                                <span className={`font-semibold ${(variation.quantity || 0) < 10 && (variation.quantity || 0) > 0 ? 'text-orange-600' : (variation.quantity || 0) === 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {variation.quantity || 0}
                                </span>
                              </td>
                              <td className="py-2">
                                <div className="flex gap-2">
                                  <button onClick={() => handleStockUpdate(variation, 'add')} className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs">
                                    + Add Stock
                                  </button>
                                  <button onClick={() => handleStockUpdate(variation, 'remove')} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">
                                    - Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-gray-400">No variations - add variations to track stock</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stock Update Modal */}
      {showStockModal && selectedVariation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {stockUpdate.type === 'add' ? 'Add Stock' : 'Remove Stock'}
            </h2>
            <p className="text-gray-600 mb-4">
              Product: {selectedVariation.variation_type} - {selectedVariation.variation_value}
              <br />
              Current Stock: <span className="font-semibold">{selectedVariation.quantity || 0}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={stockUpdate.quantity}
                onChange={(e) => setStockUpdate({...stockUpdate, quantity: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
              <input
                type="text"
                value={stockUpdate.reason}
                onChange={(e) => setStockUpdate({...stockUpdate, reason: e.target.value})}
                placeholder="e.g., New batch received, Sold at event"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex space-x-3">
              <button onClick={submitStockUpdate} className={`flex-1 text-white font-semibold py-2 px-4 rounded-lg ${stockUpdate.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                Confirm {stockUpdate.type === 'add' ? 'Add' : 'Remove'}
              </button>
              <button onClick={() => setShowStockModal(false)} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal (Add/Edit) - Simplified for now */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Product Code</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Product Name *</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required>
                  <option>Bags</option>
                  <option>Shopping Bags</option>
                  <option>Rugs</option>
                  <option>Ottomans</option>
                  <option>Pet</option>
                  <option>Accessories</option>
                  <option>Blankets</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Size</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.size} onChange={(e) => setFormData({...formData, size: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Price (RM)</label>
                <input type="number" step="0.01" className="w-full px-4 py-2 border rounded-lg" value={formData.price} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})} />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="discontinued">Discontinued</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex-1">Save</button>
                <button type="button" onClick={() => setShowModal(false)} className="bg-gray-500 text-white px-4 py-2 rounded-lg flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}