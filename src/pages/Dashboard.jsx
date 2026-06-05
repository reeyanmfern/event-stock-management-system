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

      // Get recent stock movements
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
    return <div className="text-center py-8">Loading dashboard...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Inventory Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Total Products</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Total Stock</p>
          <p className="text-3xl font-bold text-green-600">{stats.totalStock.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Total Value</p>
          <p className="text-3xl font-bold text-purple-600">RM {stats.totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Low Stock (&lt;10)</p>
          <p className="text-3xl font-bold text-orange-600">{stats.lowStockCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-500 text-sm">Out of Stock</p>
          <p className="text-3xl font-bold text-red-600">{stats.outOfStockCount}</p>
        </div>
      </div>

      {/* Recent Stock Movements */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Stock Movements</h2>
        {recentMovements.length === 0 ? (
          <p className="text-gray-500">No stock movements yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">Quantity</th>
                  <th className="text-left py-2">Reason</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((movement) => (
                  <tr key={movement.id} className="border-b">
                    <td className="py-2">{movement.products?.name || '-'} (<span className="text-xs">{movement.products?.code}</span>)</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        movement.movement_type === 'in' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {movement.movement_type === 'in' ? '+ Stock In' : '- Stock Out'}
                      </span>
                    </td>
                    <td className="text-right py-2 font-semibold">{movement.quantity}</td>
                    <td className="py-2 text-sm">{movement.reason || '-'}</td>
                    <td className="py-2 text-sm">{new Date(movement.created_at).toLocaleDateString()}</td>
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