/**
 * @file schema-sync-check.ts
 * @description BE OpenAPI 스키마와 FE 수동 타입 정의의 구조적 호환성을 검증한다.
 *
 * 원리: BE 생성 타입의 필수(non-optional) 필드가 FE 수동 타입에도 존재하는지
 * TypeScript 컴파일러가 검사한다. 필드 누락 시 tsc 에러 발생.
 *
 * 허용하는 차이:
 * - BE `string` ↔ FE 리터럴 유니온 (`'expense' | 'income'`) → FE가 더 구체적이므로 OK
 * - BE `field?: T | null` ↔ FE `field: T | null` → optional vs nullable → OK
 * - FE에만 있는 추가 필드 → FE 전용 타입이므로 OK
 *
 * 감지하는 문제:
 * - BE에 새 필수 필드가 추가됐는데 FE 타입에 없음
 * - BE 스키마 이름 변경으로 매핑 깨짐
 *
 * 사용법: npx tsc --noEmit scripts/schema-sync-check.ts
 */

import type { components } from '../src/types/generated-api'

// ── BE 스키마 단축 참조 ──
type S = components['schemas']

// ── 헬퍼 타입 ──

// BE 타입에서 필수(non-optional) 키만 추출
type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]

// BE 필수 필드가 FE 타입에 모두 존재하는지 검증
// 통과하면 true, 실패하면 에러 메시지 타입 반환
type VerifyRequiredFields<
  BEType,
  FEType,
  Label extends string
> = RequiredKeys<BEType> extends keyof FEType
  ? true
  : `❌ ${Label}: FE 타입에 BE 필수 필드 누락`

// ─────────────────────────────────────────────────
// FE 타입 임포트
// ─────────────────────────────────────────────────
import type {
  Account,
  Asset,
  AssetSummary,
  AssetSnapshot,
  AssetGoal,
  Expense,
  Category,
  Income,
  ParsedExpenseItem,
  ChatResponse,
  User,
  Budget,
  BudgetAlert,
  MonthlySpending,
  CategoryBudgetOverview,
  TotalBudgetResponse,
  BudgetMonthlyCategoryStats,
  BudgetMonthlyStatsResponse,
  CategoryStats,
  TrendPoint,
  StatsResponse,
  PeriodTotal,
  CategoryChange,
  RecurringTransaction,
  ExecuteResponse,
  Feedback,
  Finding,
  AssetAnalysisResult,
  ActionItem,
  RecentActivityItem,
  InactiveUserItem,
  AdminUserItem,
  AdminUserListResponse,
  AdminUserDetail,
} from '../src/types/index'
import type {
  Household,
  HouseholdMember,
  HouseholdInvitation,
} from '../src/types/household'

// ─────────────────────────────────────────────────
// BE 응답 → FE 타입 필수 필드 존재 검증
// 각 줄에서 tsc 에러가 나면 해당 타입의 동기화가 깨진 것.
// 에러 메시지에 어떤 타입이 문제인지 표시된다.
// ─────────────────────────────────────────────────

// 계좌/카드
const _Account: VerifyRequiredFields<S['AccountResponse'], Account, 'Account'> = true

// 자산
const _Asset: VerifyRequiredFields<S['AssetWithPrice'], Asset, 'Asset'> = true
const _AssetSummary: VerifyRequiredFields<S['AssetSummary'], AssetSummary, 'AssetSummary'> = true
const _AssetSnapshot: VerifyRequiredFields<S['AssetSnapshotResponse'], AssetSnapshot, 'AssetSnapshot'> = true
const _AssetGoal: VerifyRequiredFields<S['AssetGoalWithInsight'], AssetGoal, 'AssetGoal'> = true

// 지출/수입
const _Expense: VerifyRequiredFields<S['ExpenseResponse'], Expense, 'Expense'> = true
const _Category: VerifyRequiredFields<S['CategoryResponse'], Category, 'Category'> = true
const _Income: VerifyRequiredFields<S['IncomeResponse'], Income, 'Income'> = true

// 채팅/파싱
const _ParsedItem: VerifyRequiredFields<S['ParsedExpenseItem'], ParsedExpenseItem, 'ParsedExpenseItem'> = true
const _ChatResp: VerifyRequiredFields<S['ChatResponse'], ChatResponse, 'ChatResponse'> = true

// 사용자
const _User: VerifyRequiredFields<S['UserResponse'], User, 'User'> = true

// 예산
const _Budget: VerifyRequiredFields<S['BudgetResponse'], Budget, 'Budget'> = true
const _BudgetAlert: VerifyRequiredFields<S['BudgetAlert'], BudgetAlert, 'BudgetAlert'> = true
const _MonthlySpending: VerifyRequiredFields<S['MonthlySpending'], MonthlySpending, 'MonthlySpending'> = true
const _CatBudget: VerifyRequiredFields<S['CategoryBudgetOverview'], CategoryBudgetOverview, 'CategoryBudgetOverview'> = true
const _TotalBudget: VerifyRequiredFields<S['TotalBudgetResponse'], TotalBudgetResponse, 'TotalBudgetResponse'> = true
const _BudgetMonthlyCat: VerifyRequiredFields<S['BudgetMonthlyCategoryStats'], BudgetMonthlyCategoryStats, 'BudgetMonthlyCategoryStats'> = true
const _BudgetMonthlyStats: VerifyRequiredFields<S['BudgetMonthlyStatsResponse'], BudgetMonthlyStatsResponse, 'BudgetMonthlyStatsResponse'> = true

// 통계
const _CategoryStats: VerifyRequiredFields<S['CategoryStats'], CategoryStats, 'CategoryStats'> = true
const _TrendPoint: VerifyRequiredFields<S['TrendPoint'], TrendPoint, 'TrendPoint'> = true
const _StatsResp: VerifyRequiredFields<S['StatsResponse'], StatsResponse, 'StatsResponse'> = true
const _PeriodTotal: VerifyRequiredFields<S['PeriodTotal'], PeriodTotal, 'PeriodTotal'> = true
const _CategoryChange: VerifyRequiredFields<S['CategoryChange'], CategoryChange, 'CategoryChange'> = true

// 정기 거래
const _Recurring: VerifyRequiredFields<S['RecurringTransactionResponse'], RecurringTransaction, 'RecurringTransaction'> = true
const _ExecuteResp: VerifyRequiredFields<S['ExecuteResponse'], ExecuteResponse, 'ExecuteResponse'> = true

// 피드백
const _Feedback: VerifyRequiredFields<S['FeedbackResponse'], Feedback, 'Feedback'> = true

// 인사이트
const _Finding: VerifyRequiredFields<S['Finding'], Finding, 'Finding'> = true
const _AssetAnalysis: VerifyRequiredFields<S['AssetAnalysis'], AssetAnalysisResult, 'AssetAnalysis'> = true
const _ActionItem: VerifyRequiredFields<S['ActionItem'], ActionItem, 'ActionItem'> = true

// Admin
const _RecentActivity: VerifyRequiredFields<S['RecentActivityItem'], RecentActivityItem, 'RecentActivity'> = true
const _InactiveUser: VerifyRequiredFields<S['InactiveUserItem'], InactiveUserItem, 'InactiveUser'> = true
const _AdminUserItem: VerifyRequiredFields<S['AdminUserItem'], AdminUserItem, 'AdminUserItem'> = true
const _AdminUserList: VerifyRequiredFields<S['AdminUserListResponse'], AdminUserListResponse, 'AdminUserList'> = true
const _AdminUserDetail: VerifyRequiredFields<S['AdminUserDetailResponse'], AdminUserDetail, 'AdminUserDetail'> = true

// Household
const _Household: VerifyRequiredFields<S['HouseholdResponse'], Household, 'Household'> = true
const _HouseholdMember: VerifyRequiredFields<S['MemberResponse'], HouseholdMember, 'HouseholdMember'> = true
const _HouseholdInvitation: VerifyRequiredFields<S['InvitationResponse'], HouseholdInvitation, 'HouseholdInvitation'> = true

// 사용하지 않는 변수 경고 방지
export {
  _Account, _Asset, _AssetSummary, _AssetSnapshot, _AssetGoal,
  _Expense, _Category, _Income,
  _ParsedItem, _ChatResp, _User,
  _Budget, _BudgetAlert, _MonthlySpending, _CatBudget, _TotalBudget,
  _BudgetMonthlyCat, _BudgetMonthlyStats,
  _CategoryStats, _TrendPoint, _StatsResp, _PeriodTotal, _CategoryChange,
  _Recurring, _ExecuteResp, _Feedback,
  _Finding, _AssetAnalysis, _ActionItem,
  _RecentActivity, _InactiveUser, _AdminUserItem, _AdminUserList, _AdminUserDetail,
  _Household, _HouseholdMember, _HouseholdInvitation,
}
