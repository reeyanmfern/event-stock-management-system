import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalEvents: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    recentTransactions: []
  })
  const [lowStockProducts, setLowStockProducts] = useState([])
  const [outOfStockProducts, setOutOfStockProducts] = useState([])
  const [categoryData, setCategoryData] = useState({})
  const [monthlyData, setMonthlyData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      // Get total products
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      // Get total events
      const { count: eventCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })

      // Get low stock items
      const { data: lowStock } = await supabase
        .from('products')
        .select('*')
        .lt('quantity', 10)
        .gt('quantity', 0)
        .order('quantity', { ascending: true })

      // Get out of stock items
      const { data: outOfStock } = await supabase
        .from('products')
        .select('*')
        .eq('quantity', 0)
        .order('name', { ascending: true })

      // Get all products for category breakdown
      const { data: allProducts } = await supabase
        .from('products')
        .select('category, quantity')

      // Calculate category distribution
      const categoryCount = {}
      allProducts?.forEach(product => {
        const cat = product.category
        if (!categoryCount[cat]) categoryCount[cat] = 0
        categoryCount[cat] += product.quantity
      })
      setCategoryData(categoryCount)

      // Get transactions for monthly trend
      const { data: transactions } = await supabase
        .from('transactions')
        .select('created_at, type, quantity')
        .order('created_at', { ascending: true })

      // Calculate monthly checkouts
      const monthlyCheckouts = {}
      transactions?.forEach(tx => {
        if (tx.type === 'checkout') {
          const month = new Date(tx.created_at).toLocaleString('default', { month: 'short' })
          if (!monthlyCheckouts[month]) monthlyCheckouts[month] = 0
          monthlyCheckouts[month] += tx.quantity
        }
      })
      setMonthlyData(monthlyCheckouts)

      // Get recent transactions
      const { data: recentTx } = await supabase
        .from('transactions')
        .select(`
          *,
          events (name),
          products (name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        totalProducts: productCount || 0,
        totalEvents: eventCount || 0,
        lowStockItems: lowStock?.length || 0,
        outOfStockItems: outOfStock?.length || 0,
        recentTransactions: recentTx || []
      })
      setLowStockProducts(lowStock || [])
      setOutOfStockProducts(outOfStock || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data
  const pieChartData = {
    labels: Object.keys(categoryData),
    datasets: [
      {
        data: Object.values(categoryData),
        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
        borderWidth: 0,
      },
    ],
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Stock Distribution by Category',
        font: {
          size: 16,
        },
      },
    },
  }

  const barChartData = {
    labels: Object.keys(monthlyData),
    datasets: [
      {
        label: 'Items Checked Out',
        data: Object.values(monthlyData),
        backgroundColor: '#3B82F6',
        borderRadius: 8,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly Checkout Trends',
        font: {
          size: 16,
        },
      },
    },
  }

  if (loading) {
    return <div className="text-center py-8">Loading dashboard...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Products</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalProducts}</p>
            </div>
            <div className="text-4xl">📦</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Events</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalEvents}</p>
            </div>
            <div className="text-4xl">🎪</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Low Stock Items</p>
              <p className="text-3xl font-bold text-orange-600">{stats.lowStockItems}</p>
            </div>
            <div className="text-4xl">⚠️</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Out of Stock</p>
              <p className="text-3xl font-bold text-red-600">{stats.outOfStockItems}</p>
            </div>
            <div className="text-4xl">❌</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pie Chart - Category Distribution */}
        <div className="bg-white rounded-xl shadow-md p-6">
          {Object.keys(categoryData).length > 0 ? (
            <div className="h-80">
              <Pie data={pieChartData} options={pieChartOptions} />
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No data available yet. Add some products to see charts!
            </div>
          )}
        </div>

        {/* Bar Chart - Monthly Trends */}
        <div className="bg-white rounded-xl shadow-md p-6">
          {Object.keys(monthlyData).length > 0 ? (
            <div className="h-80">
              <Bar data={barChartData} options={barChartOptions} />
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No checkout data available yet.
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert Section */}
      {(stats.lowStockItems > 0 || stats.outOfStockItems > 0) && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">⚠️ Stock Alerts</h2>
          
          {outOfStockProducts.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-700 mb-2">❌ Out of Stock - Need Immediate Restock!</h3>
              <div className="space-y-2">
                {outOfStockProducts.map(product => (
                  <div key={product.id} className="flex justify-between items-center bg-white rounded p-3">
                    <div>
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.category} - {product.size}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-600 font-bold">0 left</p>
                      <p className="text-sm text-gray-500">RM {product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lowStockProducts.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
              <h3 className="font-semibold text-orange-700 mb-2">⚠️ Low Stock - Order Soon!</h3>
              <div className="space-y-2">
                {lowStockProducts.map(product => (
                  <div key={product.id} className="flex justify-between items-center bg-white rounded p-3">
                    <div>
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.category} - {product.size}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-600 font-bold">{product.quantity} left</p>
                      <p className="text-sm text-gray-500">RM {product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Transactions</h2>
        {stats.recentTransactions.length === 0 ? (
          <p className="text-gray-500">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Event</th>
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Quantity</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b">
                    <td className="py-2">{tx.events?.name || '-'}</td>
                    <td className="py-2">{tx.products?.name || '-'}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        tx.type === 'checkout' 
                          ? 'bg-orange-100 text-orange-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2">{tx.quantity}</td>
                    <td className="py-2">{new Date(tx.created_at).toLocaleDateString()}</td>
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