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
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const reportTabs = [
    {
      id: 'inventory',
      label: 'Inventory Summary',
      activeClass: 'bg-blue-600 text-white shadow-sm',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      )
    },
    {
      id: 'lowstock',
      label: 'Low Stock Alert',
      activeClass: 'bg-amber-500 text-white shadow-sm',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      )
    },
    {
      id: 'top',
      label: 'Top Products',
      activeClass: 'bg-emerald-600 text-white shadow-sm',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      )
    }
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm font-medium text-blue-600 mb-1">Insights</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Stock value, category breakdowns, and alerts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600"></div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total Inventory Value</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">
            RM {reportData.totalStockValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total Items in Stock</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">
            {reportData.totalItems.toLocaleString()} <span className="text-base font-medium text-gray-400">pcs</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Low Stock Items</p>
          <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1">
            {reportData.lowStockItems.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-500"></div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Out of Stock</p>
          <p className="text-2xl sm:text-3xl font-bold text-rose-600 mt-1">
            {reportData.outOfStockItems.length}
          </p>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {reportTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setReportType(tab.id)}
                className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 flex items-center gap-2 ${
                  reportType === tab.id
                    ? tab.activeClass
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {tab.icon}
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportToExcel}
            className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl border border-gray-200 flex items-center gap-2 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Inventory Summary Report */}
      {reportType === 'inventory' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Inventory by Category</h2>
            <p className="text-sm text-gray-500 mt-0.5">Stock distribution and value across categories</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Quantity</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value (RM)</th>
                  <th className="text-right py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">% of Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reportData.categorySummary.map((cat, i) => {
                  const percentage = (cat.value / reportData.totalStockValue * 100).toFixed(1)
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 sm:px-6 font-medium text-gray-900 text-sm">{cat.name}</td>
                      <td className="text-right py-3 px-4 text-sm text-gray-600">{cat.count}</td>
                      <td className="text-right py-3 px-4 text-sm text-gray-600">{cat.quantity.toLocaleString()}</td>
                      <td className="text-right py-3 px-4 text-sm font-semibold text-gray-900">RM {cat.value.toLocaleString()}</td>
                      <td className="text-right py-3 px-4 sm:px-6">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-gray-600 w-12 text-right">{percentage}%</span>
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 rounded-full h-1.5" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 px-4 sm:px-6 text-sm text-gray-900">Total</td>
                  <td className="text-right py-3 px-4 text-sm text-gray-900">{reportData.categorySummary.reduce((a,b) => a + b.count, 0)}</td>
                  <td className="text-right py-3 px-4 text-sm text-gray-900">{reportData.totalItems.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 text-sm text-gray-900">RM {reportData.totalStockValue.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 sm:px-6 text-sm text-gray-900">100%</td>
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Low Stock Items</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Fewer than 10 units — restock soon</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Stock</th>
                      <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reportData.lowStockItems.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 sm:px-6 text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.category}</td>
                        <td className="text-right py-3 px-4">
                          <span className="bg-amber-50 text-amber-700 font-semibold text-sm px-2.5 py-1 rounded-full">{item.quantity}</span>
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-sm text-gray-400">{item.sku || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportData.outOfStockItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Out of Stock Items</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Needs immediate attention</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reportData.outOfStockItems.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 sm:px-6 text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.category}</td>
                        <td className="py-3 px-4 sm:px-6 text-sm text-gray-400">{item.sku || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportData.lowStockItems.length === 0 && reportData.outOfStockItems.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-900 font-semibold">All stock levels look healthy</p>
              <p className="text-gray-400 text-sm mt-1">No low stock or out of stock items</p>
            </div>
          )}
        </div>
      )}

      {/* Top Products Report */}
      {reportType === 'top' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Top 10 Products by Stock Quantity</h2>
            <p className="text-sm text-gray-500 mt-0.5">Your most-stocked items right now</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price (RM)</th>
                  <th className="text-right py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value (RM)</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reportData.topProducts.map((product, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 sm:px-6">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-gray-200 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{product.code || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.category}</td>
                    <td className="text-right py-3 px-4 text-sm font-semibold text-gray-900">{product.quantity.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-sm text-gray-600">RM {product.price?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 sm:px-6 text-sm font-semibold text-gray-900">RM {product.value.toFixed(2)}</td>
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
