import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  })
  const [recentMovements, setRecentMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      // Get all products with variations
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variations (*)
        `)
      
      if (error) throw error

      let totalStock = 0
      let totalValue = 0
      let lowStock = 0
      let outOfStock = 0

      products.forEach(product => {
        let productStock = 0
        let productValue = 0

        if (product.product_variations && product.product_variations.length > 0) {
          product.product_variations.forEach(variation => {
            const qty = variation.quantity || 0
            productStock += qty
            productValue += qty * (product.price || 0)
            if (qty > 0 && qty < 10) lowStock++
            if (qty === 0) outOfStock++
          })
        } else {
          const qty = product.quantity || 0
          productStock = qty
          productValue = qty * (product.price || 0)
          if (qty > 0 && qty < 10) lowStock++
          if (qty === 0) outOfStock++
        }

        totalStock += productStock
        totalValue += productValue
      })

      // Get recent stock movements (last 10)
      const { data: movements } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          products (name, code)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      setStats({
        totalProducts: products.length,
        totalStock,
        totalValue,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock
      })
      setRecentMovements(movements || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts.toLocaleString(),
      accent: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      )
    },
    {
      label: 'Total Stock',
      value: stats.totalStock.toLocaleString(),
      accent: 'from-emerald-500 to-emerald-600',
      textColor: 'text-emerald-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6.75 4.5v6m4.5-6v6m4.875-12L18 4.5m2.625 3L18 4.5m0 0L15.375 7.5M3.375 7.5L6 4.5m-2.625 3L6 4.5m0 0L8.625 7.5" />
      )
    },
    {
      label: 'Total Value',
      value: `RM ${stats.totalValue.toLocaleString()}`,
      accent: 'from-violet-500 to-violet-600',
      textColor: 'text-violet-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      )
    },
    {
      label: 'Low Stock',
      sublabel: 'fewer than 10 units',
      value: stats.lowStockCount.toLocaleString(),
      accent: 'from-amber-500 to-orange-500',
      textColor: 'text-amber-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      )
    },
    {
      label: 'Out of Stock',
      sublabel: 'needs reordering',
      value: stats.outOfStockCount.toLocaleString(),
      accent: 'from-rose-500 to-red-500',
      textColor: 'text-rose-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      )
    }
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm font-medium text-blue-600 mb-1">Overview</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">A snapshot of your stock, value, and recent activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200 relative overflow-hidden group"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.accent}`}></div>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center shadow-sm`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {card.icon}
                </svg>
              </div>
            </div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{card.label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${card.textColor}`}>{card.value}</p>
            {card.sublabel && (
              <p className="text-xs text-gray-400 mt-1">{card.sublabel}</p>
            )}
          </div>
        ))}
      </div>

      {/* Recent Stock Movements */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Recent Stock Movements</h2>
            <p className="text-sm text-gray-500 mt-0.5">Latest changes across your inventory</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
        </div>

        {recentMovements.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">No stock movements yet</p>
            <p className="text-gray-400 text-xs mt-1">Activity will appear here as stock is added or sold</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 sm:px-6">
                      <span className="font-medium text-gray-900 text-sm">{movement.products?.name || '-'}</span>
                      {movement.products?.code && (
                        <span className="text-xs text-gray-400 ml-1.5">({movement.products.code})</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        movement.movement_type === 'in'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          movement.movement_type === 'in' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}></span>
                        {movement.movement_type === 'in' ? 'Stock In' : 'Stock Out'}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">{movement.quantity}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{movement.reason || '-'}</td>
                    <td className="py-3 px-4 sm:px-6 text-sm text-gray-500">{new Date(movement.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
