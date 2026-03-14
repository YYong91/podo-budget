import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { Loader2 } from 'lucide-react'

/* 코드 스플리팅: 페이지별 lazy loading으로 초기 번들 크기 축소 */
const ExpenseForm = lazy(() => import('./pages/ExpenseForm'))
const ExpenseDetail = lazy(() => import('./pages/ExpenseDetail'))
const CategoryManager = lazy(() => import('./pages/CategoryManager'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const BudgetManager = lazy(() => import('./pages/BudgetManager'))
const HouseholdListPage = lazy(() => import('./pages/HouseholdListPage'))
const HouseholdDetailPage = lazy(() => import('./pages/HouseholdDetailPage'))
const InvitationListPage = lazy(() => import('./pages/InvitationListPage'))
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const IncomeForm = lazy(() => import('./pages/IncomeForm'))
const IncomeDetail = lazy(() => import('./pages/IncomeDetail'))
const RecurringList = lazy(() => import('./pages/RecurringList'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const AssetDashboard = lazy(() => import('./pages/AssetDashboard'))
const AssetForm = lazy(() => import('./pages/AssetForm'))
const AccountManager = lazy(() => import('./pages/AccountManager'))
const TransactionList = lazy(() => import('./pages/TransactionList'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

/* /transactions → / 쿼리 보존 리다이렉트 */
function TransactionsRedirect() {
  const [searchParams] = useSearchParams()
  const query = searchParams.toString()
  return <Navigate to={query ? `/?${query}` : '/'} replace />
}

/* 로딩 스피너 */
function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-grape-600 animate-spin" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* podo-auth SSO 콜백 */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        {/* 인증이 필요한 라우트들을 ProtectedRoute로 감싼다 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<TransactionList />} />
            <Route path="/transactions" element={<TransactionsRedirect />} />
            <Route path="/expenses" element={<Navigate to="/?filter=expense" replace />} />
            <Route path="/expenses/new" element={<ExpenseForm />} />
            <Route path="/expenses/:id" element={<ExpenseDetail />} />
            <Route path="/income" element={<Navigate to="/?filter=income" replace />} />
            <Route path="/income/new" element={<IncomeForm />} />
            <Route path="/income/:id" element={<IncomeDetail />} />
            <Route path="/categories" element={<CategoryManager />} />
            <Route path="/budgets" element={<BudgetManager />} />
            <Route path="/recurring" element={<RecurringList />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/households" element={<HouseholdListPage />} />
            <Route path="/households/:id" element={<HouseholdDetailPage />} />
            <Route path="/invitations" element={<InvitationListPage />} />
            <Route path="/invitations/accept" element={<AcceptInvitationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:section" element={<SettingsPage />} />
            <Route path="/assets" element={<AssetDashboard />} />
            <Route path="/assets/new" element={<AssetForm />} />
            <Route path="/assets/:id" element={<AssetForm />} />
            <Route path="/accounts" element={<AccountManager />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default App
