import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ExpenseList from './pages/ExpenseList'
import ExpenseDetail from './pages/ExpenseDetail'
import CategoryManager from './pages/CategoryManager'
import InsightsPage from './pages/InsightsPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<ExpenseList />} />
        <Route path="/expenses/:id" element={<ExpenseDetail />} />
        <Route path="/categories" element={<CategoryManager />} />
        <Route path="/insights" element={<InsightsPage />} />
      </Route>
    </Routes>
  )
}

export default App
