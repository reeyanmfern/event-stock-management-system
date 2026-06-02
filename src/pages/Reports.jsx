import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState({
    totalStockValue: 0,
    totalItems: 0,
    lowStockItems: [],
    outOfStockItems: [],
    categorySummary: [], 
    topProducts: [],
    slowMovingItems: []
  }) 
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [reportType, setReportType] = useState('inventory')

  useEffect(() => {
    fetchReportData()
  }, [])

  async function fetchReportData() {
    setLoading(true)
    try {
      // Get all products with variations
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_variations (*)
        `)
      
      if (productsError) throw productsError

      // Calculate total stock value
      let totalValue = 0
      let totalQty = 0
      const categoryMap = {}
      const productStockMap = []

      products.forEach(product => {
        let productTotalQty = 0
        let productTotalValue = 0

        if (product.product_variations && product.product_variations.length > 0) {
          product.product_variations.forEach(variation => {
            const qty = variation.quantity || 0
            const value = qty * (product.price || 0)
            productTotalQty += qty
            productTotalValue += value
          })
        } else {
          const qty = product.quantity || 0
          productTotalQty = qty
          productTotalValue = qty * (product.price || 0)
        }

        totalQty += productTotalQty
        totalValue += productTotalValue

        // Category summary
        const cat = product.category || 'Uncategorized'
        if (!categoryMap[cat]) {
          categoryMap[cat] = { quantity: 0, value: 0, count: 0 }
        }
        categoryMap[cat].quantity += productTotalQty
        categoryMap[cat].value += productTotalValue
        categoryMap[cat].count += 1

        // Product stock for top products
        productStockMap.push({
          name: product.name,
          code: product.code,
          category: product.category,
          quantity: productTotalQty,
          value: productTotalValue,
          price: product.price
        })
      })

      // Get low stock items (quantity < 10 and > 0)
      const lowStock = []
      const outOfStock = []

      products.forEach(product => {
        if (product.product_variations && product.product_variations.length > 0) {
          product.product_variations.forEach(variation => {
            const qty = variation.quantity || 0
            if (qty > 0 && qty < 10) {
              lowStock.push({
                name: `${product.name} - ${variation.variation_value}`,
                category: product.category,
                quantity: qty,
                sku: variation.sku
              })
            } else if (qty === 0) {
              outOfStock.push({
                name: `${product.name} - ${variation.variation_value}`,
                category: product.category,
                sku: variation.sku
              })
            }
          })
        } else {
          const qty = product.quantity || 0
          if (qty > 0 && qty < 10) {
            lowStock.push({
              name: product.name,
              category: product.category,
              quantity: qty,
              sku: product.main_sku
            })
          } else if (qty === 0) {
            outOfStock.push({
              name: product.name,
              category: product.category,
              sku: product.main_sku
            })
          }
        }
      })

      // Top products by quantity
      const topProducts = [...productStockMap]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)

      // Slow moving items (lowest quantity but not zero)
      const slowMovingItems = [...productStockMap]
        .filter(p => p.quantity > 0 && p.quantity < 20)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 10)

      // Category summary array
      const categorySummary = Object.entries(categoryMap).map(([name, data]) => ({
        name,
        ...data
      }))

      setReportData({
        totalStockValue: totalValue,
        totalItems: totalQty,
        lowStockItems: lowStock,
        outOfStockItems: outOfStock,
        categorySummary,
        topProducts,
        slowMovingItems
      })
    } catch (error) {
      console.error('Error fetching report data:', error)
      alert('Error generating report: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function exportToExcel() {
    let exportData = []
    
    if (reportType === 'inventory') {
      exportData = reportData.categorySummary.map(cat => ({
        'Category': cat.name,
        'Product Count': cat.count,
        'Total Quantity': cat.quantity,
        'Total Value (RM)': cat.value.toFixed(2)
      }))
    } else if (reportType === 'lowstock') {
      exportData = reportData.lowStockItems.map(item => ({
        'Product Name': item.name,
        'Category': item.category,
        'Current Stock': item.quantity,
        'SKU': item.sku,
        'Status': 'Low Stock'
      }))
    } else if (reportType === 'top') {
      exportData = reportData.topProducts.map((p, i) => ({
        'Rank': i + 1,
        'Product Name': p.name,
        'Code': p.code,
        'Category': p.category,
        'Quantity': p.quantity,
        'Value (RM)': p.value.toFixed(2),
        'Price (RM)': p.price
      }))
    }

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Report_${reportType}`)
    
    const date = new Date()
    const filename = `${reportType}_report_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  if (loading) {
    return <div className="text-center py-8">Loading reports...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Reports & Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Total Inventory Value</p>
          <p className="text-3xl font-bold text-green-600">
            RM {reportData.totalStockValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Total Items in Stock</p>
          <p className="text-3xl font-bold text-blue-600">
            {reportData.totalItems.toLocaleString()} pcs
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Low Stock Items</p>
          <p className="text-3xl font-bold text-orange-600">
            {reportData.lowStockItems.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Out of Stock</p>
          <p className="text-3xl font-bold text-red-600">
            {reportData.outOfStockItems.length}
          </p>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setReportType('inventory')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportType === 'inventory' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Inventory Summary
            </button>
            <button
              onClick={() => setReportType('lowstock')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportType === 'lowstock' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ⚠️ Low Stock Alert
            </button>
            <button
              onClick={() => setReportType('top')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportType === 'top' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🏆 Top Products
            </button>
          </div>
          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
          >
            📥 Export to Excel
          </button>
        </div>
      </div>

      {/* Inventory Summary Report */}
      {reportType === 'inventory' && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-800">Inventory by Category</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-right py-3 px-4">Products</th>
                  <th className="text-right py-3 px-4">Total Quantity</th>
                  <th className="text-right py-3 px-4">Total Value (RM)</th>
                  <th className="text-right py-3 px-4">% of Value</th>
                </tr>
              </thead>
              <tbody>
                {reportData.categorySummary.map((cat, i) => {
                  const percentage = (cat.value / reportData.totalStockValue * 100).toFixed(1)
                  return (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{cat.name}</td>
                      <td className="text-right py-3 px-4">{cat.count}</td>
                      <td className="text-right py-3 px-4">{cat.quantity.toLocaleString()}</td>
                      <td className="text-right py-3 px-4">RM {cat.value.toLocaleString()}</td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <span>{percentage}%</span>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 rounded-full h-2" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 px-4">TOTAL</td>
                  <td className="text-right py-3 px-4">{reportData.categorySummary.reduce((a,b) => a + b.count, 0)}</td>
                  <td className="text-right py-3 px-4">{reportData.totalItems.toLocaleString()}</td>
                  <td className="text-right py-3 px-4">RM {reportData.totalStockValue.toLocaleString()}</td>
                  <td className="text-right py-3 px-4">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock Report */}
      {reportType === 'lowstock' && (
        <div className="space-y-6">
          {reportData.lowStockItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-orange-200 bg-orange-100">
                <h2 className="text-xl font-semibold text-orange-800">⚠️ Low Stock Items (&lt;10 units)</h2>
                <p className="text-orange-600 text-sm mt-1">These items need restocking soon</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-orange-100">
                    <tr>
                      <th className="text-left py-3 px-4">Product Name</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-right py-3 px-4">Current Stock</th>
                      <th className="text-left py-3 px-4">SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.lowStockItems.map((item, i) => (
                      <tr key={i} className="border-b border-orange-100">
                        <td className="py-3 px-4">{item.name}</td>
                        <td className="py-3 px-4">{item.category}</td>
                        <td className="text-right py-3 px-4 font-semibold text-orange-700">{item.quantity}</td>
                        <td className="py-3 px-4 text-sm">{item.sku || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportData.outOfStockItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-red-200 bg-red-100">
                <h2 className="text-xl font-semibold text-red-800">❌ Out of Stock Items</h2>
                <p className="text-red-600 text-sm mt-1">These items need immediate attention</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="text-left py-3 px-4">Product Name</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-left py-3 px-4">SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.outOfStockItems.map((item, i) => (
                      <tr key={i} className="border-b border-red-100">
                        <td className="py-3 px-4">{item.name}</td>
                        <td className="py-3 px-4">{item.category}</td>
                        <td className="py-3 px-4 text-sm">{item.sku || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportData.lowStockItems.length === 0 && reportData.outOfStockItems.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <p className="text-green-600">🎉 No low stock or out of stock items! Great job!</p>
            </div>
          )}
        </div>
      )}

      {/* Top Products Report */}
      {reportType === 'top' && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-800">Top 10 Products by Stock Quantity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4">Rank</th>
                  <th className="text-left py-3 px-4">Product Name</th>
                  <th className="text-left py-3 px-4">Code</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-right py-3 px-4">Quantity</th>
                  <th className="text-right py-3 px-4">Price (RM)</th>
                  <th className="text-right py-3 px-4">Value (RM)</th>
                 </tr>
              </thead>
              <tbody>
                {reportData.topProducts.map((product, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold">#{i + 1}</td>
                    <td className="py-3 px-4">{product.name}</td>
                    <td className="py-3 px-4 text-sm">{product.code || '-'}</td>
                    <td className="py-3 px-4">{product.category}</td>
                    <td className="text-right py-3 px-4 font-semibold">{product.quantity.toLocaleString()}</td>
                    <td className="text-right py-3 px-4">RM {product.price?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4">RM {product.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}