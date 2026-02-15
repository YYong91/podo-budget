/**
 * @file PrivacyPolicyPage.tsx
 * @description 개인정보처리방침 페이지
 * 사용자의 개인정보 수집, 이용, 보관, 제3자 제공, 파기에 대한 내용을 안내한다.
 */

import { Link } from 'react-router-dom'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/login" className="text-xl font-bold text-amber-600">
            HomeNRich
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-6">
            개인정보처리방침
          </h1>

          <div className="prose prose-sm sm:prose max-w-none space-y-6 text-stone-700">
            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">1. 개인정보의 수집 항목 및 방법</h2>
              <p className="mb-2">
                HomeNRich(이하 "서비스")는 다음과 같은 개인정보를 수집합니다:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>필수 항목</strong>: 사용자명, 비밀번호(암호화 저장), 지출 내역(금액, 설명, 카테고리, 날짜)</li>
                <li><strong>선택 항목</strong>: 이메일(공유 가계부 초대 기능 이용 시 권장)</li>
              </ul>
              <p className="mt-2">
                개인정보는 회원가입 시 사용자가 직접 입력하거나, 서비스 이용 과정에서 자동으로 수집됩니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">2. 개인정보의 수집 및 이용 목적</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>회원 가입 및 본인 인증</li>
                <li>가계부 서비스 제공(지출 기록, 분류, 조회, 통계)</li>
                <li>AI 기반 자동 카테고리 분류 및 인사이트 생성</li>
                <li>공유 가계부 기능(초대, 멤버 관리)</li>
                <li>서비스 개선 및 신규 기능 개발</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">3. 개인정보의 제3자 제공</h2>
              <p className="mb-2">
                서비스는 AI 기반 자동 분류 및 인사이트 생성을 위해 다음과 같이 제3자에게 개인정보를 제공합니다:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>제공받는 자</strong>: Anthropic, OpenAI 등 AI 서비스 제공자</li>
                <li><strong>제공 항목</strong>: 사용자가 입력한 자연어 지출 텍스트(예: "오늘 점심에 김치찌개 8000원 먹었어")</li>
                <li><strong>제공 목적</strong>: 지출 내역 자동 파싱(금액, 카테고리, 날짜 추출) 및 월별 지출 인사이트 생성</li>
                <li><strong>보유 기간</strong>: 각 제3자의 개인정보처리방침에 따름</li>
              </ul>
              <p className="mt-2">
                위 제3자 제공 이외에 법령에 따른 경우를 제외하고는 사용자의 개인정보를 외부에 제공하지 않습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">4. 개인정보의 보유 및 이용 기간</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>회원 정보</strong>: 서비스 이용 기간 동안 보유</li>
                <li><strong>지출 내역</strong>: 서비스 이용 기간 동안 보유</li>
                <li><strong>탈퇴 후</strong>: 회원 탈퇴 시 모든 개인정보는 30일 이내에 파기됩니다(단, 관련 법령에 따라 보존이 필요한 경우 예외)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">5. 개인정보의 파기 절차 및 방법</h2>
              <p className="mb-2">
                사용자의 개인정보는 수집 및 이용 목적이 달성된 후 지체 없이 파기됩니다:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>파기 절차</strong>: 회원 탈퇴 요청 후 30일 이내에 데이터베이스에서 영구 삭제</li>
                <li><strong>파기 방법</strong>: 전자적 파일 형태의 정보는 복구 불가능한 방법으로 영구 삭제</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">6. 사용자 및 법정대리인의 권리</h2>
              <p className="mb-2">
                사용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>개인정보 조회 및 수정</li>
                <li>회원 탈퇴 및 개인정보 삭제 요청(서비스 내 설정 페이지 또는 이메일 문의)</li>
                <li>개인정보 처리 정지 요청</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">7. 개인정보 보호책임자</h2>
              <p>
                서비스의 개인정보 보호책임자는 다음과 같습니다:
              </p>
              <ul className="list-none ml-4 mt-2 space-y-1">
                <li><strong>책임자</strong>: HomeNRich 운영팀</li>
                <li><strong>이메일</strong>: privacy@homenrich.example.com</li>
              </ul>
              <p className="mt-2">
                개인정보 관련 문의, 불만 처리, 피해 구제 등이 필요하신 경우 위 연락처로 문의해주시기 바랍니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">8. 개인정보처리방침의 변경</h2>
              <p>
                본 개인정보처리방침은 법령 및 서비스 정책 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지사항을 통해 안내합니다.
              </p>
              <p className="mt-2">
                <strong>시행일자</strong>: 2026년 2월 13일
              </p>
            </section>
          </div>

          {/* 하단 버튼 */}
          <div className="mt-8 pt-6 border-t border-stone-200 flex justify-center">
            <Link
              to="/login"
              className="px-6 py-2.5 text-sm font-medium text-amber-600 border border-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
            >
              ← 로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
