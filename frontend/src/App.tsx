import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { Loader2 } from 'lucide-react'

/* 코드 스플리팅: 페이지별 lazy loading으로 초기 번들 크기 축소 */
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ExpenseList = lazy(() => import('./pages/ExpenseList'))
const ExpenseForm = lazy(() => import('./pages/ExpenseForm'))
const ExpenseDetail = lazy(() => import('./pages/ExpenseDetail'))
const CategoryManager = lazy(() => import('./pages/CategoryManager'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const BudgetManager = lazy(() => import('./pages/BudgetManager'))
const HouseholdListPage = lazy(() => import('./pages/HouseholdListPage'))
const HouseholdDetailPage = lazy(() => import('./pages/HouseholdDetailPage'))
const InvitationListPage = lazy(() => import('./pages/InvitationListPage'))
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

/* 로딩 스피너 */
function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        {/* 인증이 필요한 라우트들을 ProtectedRoute로 감싼다 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/expenses" element={<ExpenseList />} />
            <Route path="/expenses/new" element={<ExpenseForm />} />
            <Route path="/expenses/:id" element={<ExpenseDetail />} />
            <Route path="/categories" element={<CategoryManager />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/budgets" element={<BudgetManager />} />
            <Route path="/households" element={<HouseholdListPage />} />
            <Route path="/households/:id" element={<HouseholdDetailPage />} />
            <Route path="/invitations" element={<InvitationListPage />} />
            <Route path="/invitations/accept" element={<AcceptInvitationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
