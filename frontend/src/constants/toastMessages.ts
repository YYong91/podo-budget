export const TOAST = {
  // 공통
  SAVED: '저장했어요',
  DELETED: '삭제했어요',
  COPIED: '복사했어요',
  SAVE_FAILED: '저장에 실패했어요',
  DELETE_FAILED: '삭제에 실패했어요',
  LOAD_FAILED: '불러오지 못했어요',
  PROCESS_FAILED: '처리에 실패했어요',
  NO_PERMISSION: '권한이 없어요',
  SEARCH_FAILED: '검색에 실패했어요',
  CATEGORY_CHANGE_FAILED: '카테고리 변경에 실패했어요',
  ORDER_CHANGE_FAILED: '순서 변경에 실패했어요',
  ROLE_CHANGED: '역할을 변경했어요',
  STATUS_CHANGED: '상태를 변경했어요',
  PASSWORD_CHANGED: '비밀번호를 변경했어요',
  ACCOUNT_DELETED: '계정이 삭제되었어요',

  // 카테고리
  CATEGORY_ADDED: '카테고리를 추가했어요',
  CATEGORY_UPDATED: '카테고리를 수정했어요',
  CATEGORY_DELETED: '카테고리를 삭제했어요',

  // 결제수단
  PAYMENT_DEFAULT_SET: (name: string) =>
    `${name}을(를) 주 결제수단으로 설정했어요`,
  PAYMENT_DEFAULT_UNSET: '주 결제수단을 해제했어요',
  PAYMENT_ADDED: '결제수단을 추가했어요',
  PAYMENT_DELETED: '결제수단을 삭제했어요',
  PAYMENT_UPDATED: '결제수단을 수정했어요',
  PAYMENT_CHANGE_FAILED: '결제수단 변경에 실패했어요',

  // 예산
  BUDGET_SAVED: '예산을 저장했어요',
  BUDGET_DELETED: '예산을 삭제했어요',

  // AI
  AI_COMPLETE: 'AI 분석 완료',
  AI_FAILED: 'AI 분석에 실패했어요',
  AI_NO_DATA: '분석할 데이터가 없어요',
  PARSE_FAILED: '분석에 실패했어요',

  // 가구
  HOUSEHOLD_CREATED: '가구를 만들었어요',
  HOUSEHOLD_UPDATED: '가구 정보를 수정했어요',
  HOUSEHOLD_DELETED: '가구를 삭제했어요',
  HOUSEHOLD_LEFT: '가구를 나갔어요',
  HOUSEHOLD_JOINED: (name: string) => `${name}에 참여했어요`,
  MEMBER_REMOVED: '멤버를 내보냈어요',
  INVITE_SENT: '초대를 보냈어요',
  INVITE_CANCELLED: '초대를 취소했어요',
  INVITE_ACCEPTED: '초대를 수락했어요',
  INVITE_REJECTED: '초대를 거절했어요',
  INVITE_LINK_COPIED: '초대 링크를 복사했어요',

  // 계정
  ACCOUNT_SAVED: '계정을 저장했어요',
  BANK_ACCOUNT_SAVED: '계좌를 등록했어요',
  BANK_ACCOUNT_DELETED: '계좌를 삭제했어요',
  LOGOUT: '로그아웃했어요',

  // 피드백
  FEEDBACK_SENT: '피드백을 보냈어요',

  // 봇 연동
  BOT_LINKED: '연동했어요',
  BOT_UNLINKED: (name: string) => `${name} 연동을 해제했어요`,
  LINK_CODE_COPIED: '연동 코드를 복사했어요',

  // 정기거래
  RECURRING_ADDED: '정기 거래를 등록했어요',
  RECURRING_UPDATED: '정기 거래를 수정했어요',
  RECURRING_DELETED: '정기 거래를 삭제했어요',
  RECURRING_EXECUTED: '정기 거래를 실행했어요',
  RECURRING_SKIPPED: '정기 거래를 건너뛰었어요',

  // 자산
  ASSET_SAVED: '자산을 저장했어요',
  ASSET_DELETED: '자산을 삭제했어요',
  GOAL_SAVED: '목표를 설정했어요',
  GOAL_DELETED: '목표를 삭제했어요',

  // 온보딩
  ONBOARDING_CREATED: '가계부를 만들었어요',

  // 사용자 관리
  USER_ACTIVATED: '사용자를 활성화했어요',
  USER_DEACTIVATED: '사용자를 비활성화했어요',
  USER_LOAD_FAILED: '사용자 목록을 불러오지 못했어요',
  USER_DETAIL_FAILED: '사용자 정보를 불러오지 못했어요',

  // 피드백 (관리자)
  FEEDBACK_LOAD_FAILED: '피드백을 불러오지 못했어요',
  FEEDBACK_STATUS_CHANGED: '상태를 변경했어요',
  FEEDBACK_STATUS_FAILED: '상태 변경에 실패했어요',
  FEEDBACK_SUBMIT_FAILED: '제출에 실패했어요',

  // 초대 수락/거절
  INVITE_ACCEPT_FAILED: '초대 수락에 실패했어요',
  INVITE_REJECT_FAILED: '초대 거절에 실패했어요',
  INVITE_LOAD_FAILED: '초대 목록을 불러오지 못했어요',
  INVITE_LINK_INVALID: '유효하지 않은 초대 링크예요',

  // 가구
  HOUSEHOLD_CREATE_FAILED: '가구 생성에 실패했어요',

  // 계좌
  BANK_ACCOUNT_ADDED: '계좌를 등록했어요',

  // 정기거래 (추가 메시지)
  RECURRING_EXECUTE_FAILED: '정기거래 등록에 실패했어요',
  RECURRING_SKIP_FAILED: '건너뛰기에 실패했어요',
  RECURRING_TOGGLE_FAILED: '변경에 실패했어요',

  // 복사
  COPY_FAILED: '복사에 실패했어요',
  LINK_CODE_COPY_FAILED: '연동 코드 복사에 실패했어요',

  // 인사이트
  AI_ANALYSIS_COMPLETE: 'AI 분석이 완료됐어요',
  AI_ANALYSIS_FAILED: 'AI 분석에 실패했어요',

  // 자산 (추가 메시지)
  ASSET_LOAD_FAILED: '자산 정보를 불러오지 못했어요',
  ASSET_UPDATED: '자산을 수정했어요',
  ASSET_PARSE_FAILED: '분석에 실패했어요',

  // 온보딩
  ONBOARDING_FAILED: '가계부 생성에 실패했어요',
} as const
