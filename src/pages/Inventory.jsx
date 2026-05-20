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
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [stockFilter, setStockFilter] = useState('All')
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'Bag',
    size: 'Medium',
    variety: '',
    quantity: 0,
    price: 0,
    image_url: ''
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  // Apply filters
  useEffect(() => {
    let filtered = [...products]
    
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }
    
    if (stockFilter === 'Low Stock') {
      filtered = filtered.filter(product => product.quantity < 10 && product.quantity > 0)
    } else if (stockFilter === 'Out of Stock') {
      filtered = filtered.filter(product => product.quantity === 0)
    } else if (stockFilter === 'In Stock') {
      filtered = filtered.filter(product => product.quantity > 0)
    }
    
    setFilteredProducts(filtered)
  }, [products, searchTerm, selectedCategory, stockFilter])

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
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

  // Handle paste event for images
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

  async function uploadImage(file) {
    if (!file) return null
    
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${uuidv4()}.${fileExt}`
      const filePath = `${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)
      
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

  async function handleDelete(id) {
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

  function exportToExcel() {
    if (filteredProducts.length === 0) {
      alert('No products to export!')
      return
    }

    const exportData = filteredProducts.map(product => ({
      'Product Name': product.name,
      'Category': product.category,
      'Size': product.size,
      'Variety': product.variety || '-',
      'Quantity': product.quantity,
      'Price (RM)': product.price,
      'Stock Status': product.quantity === 0 ? 'Out of Stock' : 
                      product.quantity < 10 ? 'Low Stock' : 'In Stock'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    
    const date = new Date()
    const filename = `inventory_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.xlsx`
    XLSX.writeFile(wb, filename)
    
    alert(`Exported ${filteredProducts.length} products to ${filename}`)
  }

  function resetForm() {
    setFormData({
      name: '',
      category: 'Bag',
      size: 'Medium',
      variety: '',
      quantity: 0,
      price: 0,
      image_url: ''
    })
    setPastedImage(null)
    setEditingProduct(null)
  }

  function editProduct(product) {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      category: product.category,
      size: product.size,
      variety: product.variety || '',
      quantity: product.quantity,
      price: product.price,
      image_url: product.image_url || ''
    })
    setShowModal(true)
  }

  function clearFilters() {
    setSearchTerm('')
    setSelectedCategory('All')
    setStockFilter('All')
  }

  const categories = ['All', 'Rug', 'Shopping Bag', 'Bag', 'Pouch']
  const sizes = ['Small', 'Medium', 'Large', 'Extra Large']
  const rugSizes = ['2x3 ft', '4x6 ft', '6x9 ft', '2x8 ft']

  const lowStockCount = products.filter(p => p.quantity < 10 && p.quantity > 0).length
  const outOfStockCount = products.filter(p => p.quantity === 0).length

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
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

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input type="text" placeholder="Search by product name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              <option value="All">All Items</option>
              <option value="In Stock">In Stock (&gt;0)</option>
              <option value="Low Stock">Low Stock (&lt;10)</option>
              <option value="Out of Stock">Out of Stock (0)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-between items-center mt-4">
          <div className="flex gap-2 text-sm">
            <span className="text-gray-600">Total: {filteredProducts.length} products</span>
            {lowStockCount > 0 && <span className="text-orange-600">⚠️ {lowStockCount} low stock</span>}
            {outOfStockCount > 0 && <span className="text-red-600">❌ {outOfStockCount} out of stock</span>}
          </div>
          {(searchTerm || selectedCategory !== 'All' || stockFilter !== 'All') && (
            <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-800">Clear All Filters</button>
          )}
        </div>
      </div>

      {/* Products Grid */}
      {loading && products.length === 0 ? (
        <div className="text-center py-8">Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No products found matching your filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400">No image</span>
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
                  {product.quantity < 10 && product.quantity > 0 && <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">Low Stock</span>}
                  {product.quantity === 0 && <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">Out of Stock</span>}
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600"><span className="font-medium">Category:</span> {product.category}</p>
                  <p className="text-sm text-gray-600"><span className="font-medium">Size:</span> {product.size}</p>
                  {product.variety && <p className="text-sm text-gray-600"><span className="font-medium">Variety:</span> {product.variety}</p>}
                  <p className="text-sm text-gray-600"><span className="font-medium">Quantity:</span> <span className={`ml-1 font-bold ${product.quantity < 10 && product.quantity > 0 ? 'text-orange-600' : product.quantity === 0 ? 'text-red-600' : 'text-green-600'}`}>{product.quantity}</span></p>
                  <p className="text-sm text-gray-600"><span className="font-medium">Price:</span> RM {product.price}</p>
                </div>
                <div className="mt-4 flex space-x-2">
                  <button onClick={() => editProduct(product)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition">Edit</button>
                  <button onClick={() => handleDelete(product.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal with Paste Image Support */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onPaste={handlePaste}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                    {categories.filter(c => c !== 'All').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={formData.size} onChange={(e) => setFormData({...formData, size: e.target.value})}>
                    {(formData.category === 'Rug' ? rugSizes : sizes).map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Variety (Optional)</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={formData.variety} onChange={(e) => setFormData({...formData, variety: e.target.value})} placeholder="e.g., Paper, Backpack, Makeup pouch" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} required />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (RM)</label>
                  <input type="number" step="0.01" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={formData.price} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})} required />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
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
                    <div className="mt-3">
                      <img src={formData.image_url} alt="Preview" className="w-32 h-32 object-cover rounded-lg mx-auto" />
                      <p className="text-xs text-green-600 text-center mt-1">✓ Image ready</p>
                    </div>
                  )}
                  {uploading && <p className="text-sm text-blue-600 text-center mt-2">Uploading...</p>}
                </div>
                <div className="flex space-x-3">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex-1" disabled={loading || uploading}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}