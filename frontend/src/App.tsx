import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ExpenseList from './pages/ExpenseList'
import ExpenseForm from './pages/ExpenseForm'
import ExpenseDetail from './pages/ExpenseDetail'
import CategoryManager from './pages/CategoryManager'
import InsightsPage from './pages/InsightsPage'
import BudgetManager from './pages/BudgetManager'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<ExpenseList />} />
        <Route path="/expenses/new" element={<ExpenseForm />} />
        <Route path="/expenses/:id" element={<ExpenseDetail />} />
        <Route path="/categories" element={<CategoryManager />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/budgets" element={<BudgetManager />} />
      </Route>
    </Routes>
  )
}

export default App
