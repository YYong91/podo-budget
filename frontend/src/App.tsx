import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useSearchParams, useLocation, useNavigationType } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { FEATURES } from './config/features'

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
const LoginPage = lazy(() => import('./pages/LoginPage'))
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
const PaymentMethodManager = lazy(() => import('./pages/PaymentMethodManager'))
const TransactionList = lazy(() => import('./pages/TransactionList'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))

/* /transactions → /home 쿼리 보존 리다이렉트 */
function TransactionsRedirect() {
  const [searchParams] = useSearchParams()
  const query = searchParams.toString()
  return <Navigate to={query ? `/home?${query}` : '/home'} replace />
}

/* 로딩 스피너 */
function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full border-b-2 border-grape-600 w-8 h-8" />
    </div>
  )
}

/** 새 페이지 이동 시 스크롤 최상단, 뒤로가기 시 스크롤 복원 (#476) */
function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  const scrollPositions = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (navType === 'POP') {
      // 뒤로가기: 저장된 위치로 복원
      const saved = scrollPositions.current.get(pathname)
      if (saved != null) {
        requestAnimationFrame(() => window.scrollTo(0, saved))
      }
    } else {
      // 새 이동(PUSH/REPLACE): 최상단
      window.scrollTo(0, 0)
    }

    // 페이지 떠날 때 현재 스크롤 위치 저장
    return () => {
      scrollPositions.current.set(pathname, window.scrollY)
    }
  }, [pathname, navType])

  return null
}

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ScrollToTop />
      <Routes>
        {/* 퍼블릭 랜딩 페이지 — 로그인 상태면 /home으로 자동 리디렉션 (#495) */}
        <Route path="/" element={<LandingPage />} />
        {/* podo-auth SSO 콜백 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        {/* 인증이 필요한 라우트들을 ProtectedRoute로 감싼다 */}
        <Route element={<ProtectedRoute />}>
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="/invitations/accept" element={<AcceptInvitationPage />} />
          <Route element={<Layout />}>
            <Route path="/home" element={<TransactionList />} />
            <Route path="/transactions" element={<TransactionsRedirect />} />
            <Route path="/expenses" element={<Navigate to="/home" replace />} />
            <Route path="/expenses/new" element={<ExpenseForm />} />
            <Route path="/expenses/:id" element={<ExpenseDetail />} />
            <Route path="/income" element={<Navigate to="/home" replace />} />
            <Route path="/income/new" element={<IncomeForm />} />
            <Route path="/income/:id" element={<IncomeDetail />} />
            <Route path="/categories" element={<CategoryManager />} />
            <Route path="/budgets" element={<BudgetManager />} />
            <Route path="/recurring" element={<RecurringList />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/households" element={<HouseholdListPage />} />
            <Route path="/households/:id" element={<HouseholdDetailPage />} />
            <Route path="/invitations" element={<InvitationListPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:section" element={<SettingsPage />} />
            {/* 자산/계좌 라우트: FEATURES.assets 플래그로 조건부 활성화 */}
            {FEATURES.assets && (
              <>
                <Route path="/assets" element={<AssetDashboard />} />
                <Route path="/assets/new" element={<AssetForm />} />
                <Route path="/assets/:id" element={<AssetForm />} />
                <Route path="/accounts" element={<AccountManager />} />
              </>
            )}
            {!FEATURES.assets && (
              <>
                <Route path="/assets/*" element={<Navigate to="/home" replace />} />
                <Route path="/accounts/*" element={<Navigate to="/home" replace />} />
              </>
            )}
            <Route path="/payment-methods" element={<PaymentMethodManager />} />
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
