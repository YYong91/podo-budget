/**
 * @file TermsOfServicePage.tsx
 * @description 이용약관 페이지
 * 서비스 이용 조건, 사용자 의무, 서비스 제공자 책임 등을 안내한다.
 */

import { Link } from 'react-router-dom'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/login" className="text-xl font-bold text-primary-600">
            HomeNRich
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
            이용약관
          </h1>

          <div className="prose prose-sm sm:prose max-w-none space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
              <p>
                본 약관은 HomeNRich(이하 "서비스")가 제공하는 AI 기반 가계부 서비스의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (서비스의 내용)</h2>
              <p className="mb-2">
                서비스는 다음과 같은 기능을 제공합니다:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>자연어 입력을 통한 지출 기록 및 자동 분류</li>
                <li>카테고리별 지출 관리 및 통계</li>
                <li>월별 지출 인사이트 생성(AI 기반)</li>
                <li>예산 설정 및 알림</li>
                <li>공유 가계부 기능(가족, 친구 등과 함께 사용)</li>
                <li>텔레그램 봇 연동(선택)</li>
              </ul>
              <p className="mt-2">
                서비스는 사전 통지 없이 기능을 추가, 변경, 중단할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (회원가입 및 계정 관리)</h2>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>
                  <strong>가입 조건</strong>: 본 약관과 개인정보처리방침에 동의한 사용자는 회원가입을 통해 서비스를 이용할 수 있습니다.
                </li>
                <li>
                  <strong>계정 책임</strong>: 회원은 자신의 계정 정보(사용자명, 비밀번호)를 안전하게 관리할 책임이 있으며, 계정 공유 또는 타인의 무단 사용으로 인한 피해는 회원 본인의 책임입니다.
                </li>
                <li>
                  <strong>정보의 정확성</strong>: 회원은 회원가입 시 정확하고 최신의 정보를 제공해야 하며, 변경 시 즉시 수정해야 합니다.
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (이용자의 의무)</h2>
              <p className="mb-2">
                회원은 다음 행위를 해서는 안 됩니다:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>타인의 개인정보를 도용하거나 부정하게 사용하는 행위</li>
                <li>서비스의 정상적인 운영을 방해하는 행위(해킹, DDoS 공격 등)</li>
                <li>허위 정보를 입력하거나 서비스를 악용하는 행위</li>
                <li>관련 법령을 위반하는 행위</li>
              </ul>
              <p className="mt-2">
                위 의무를 위반한 경우 서비스 이용이 제한되거나 계정이 삭제될 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제5조 (서비스 제공자의 의무 및 책임 제한)</h2>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>
                  <strong>서비스 안정성</strong>: 서비스 제공자는 안정적인 서비스 제공을 위해 노력하지만, 시스템 점검, 장애, 천재지변 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다.
                </li>
                <li>
                  <strong>데이터 백업</strong>: 서비스 제공자는 회원의 데이터를 보호하기 위해 노력하지만, 회원은 중요한 데이터를 별도로 백업할 책임이 있습니다.
                </li>
                <li>
                  <strong>AI 기능 정확성</strong>: AI 기반 자동 분류 및 인사이트는 참고용이며, 정확성을 보장하지 않습니다. 회원은 AI 결과를 검토하고 수정할 책임이 있습니다.
                </li>
                <li>
                  <strong>제3자 서비스</strong>: 텔레그램 봇 등 제3자 플랫폼을 통한 서비스 이용 시 발생하는 문제는 해당 플랫폼의 책임이며, 서비스 제공자는 이에 대해 책임지지 않습니다.
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제6조 (서비스의 변경 및 중단)</h2>
              <p>
                서비스 제공자는 운영상, 기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다. 중요한 변경 사항은 사전에 공지하며, 서비스 중단 시 회원의 데이터는 최대 30일간 보관 후 파기됩니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제7조 (지적재산권)</h2>
              <p>
                서비스 내 모든 콘텐츠(UI, 디자인, 로고, 소스코드 등)에 대한 지적재산권은 서비스 제공자에게 있습니다. 회원은 서비스를 통해 생성한 자신의 지출 데이터에 대한 소유권을 가지며, 서비스 제공자는 이를 서비스 제공 목적 이외에 무단으로 사용하지 않습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제8조 (면책 조항)</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>서비스 제공자는 회원 간 또는 회원과 제3자 간 발생한 분쟁에 대해 개입하거나 책임지지 않습니다.</li>
                <li>서비스 이용으로 인한 손해(금전적 손실, 데이터 손실 등)는 회원 본인의 책임입니다.</li>
                <li>무료로 제공되는 서비스의 경우, 서비스 제공자는 서비스 품질에 대한 보증 책임을 지지 않습니다.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제9조 (회원 탈퇴 및 계정 삭제)</h2>
              <p>
                회원은 언제든지 서비스 내 설정 페이지에서 계정을 삭제할 수 있습니다. 계정 삭제 시 모든 개인정보 및 지출 데이터는 30일 이내에 영구 삭제되며, 이는 되돌릴 수 없습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제10조 (약관의 변경)</h2>
              <p>
                본 약관은 법령 및 서비스 정책 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지사항을 통해 최소 7일 전에 안내합니다. 변경된 약관에 동의하지 않을 경우 회원은 서비스 이용을 중단하고 계정을 삭제할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제11조 (준거법 및 관할)</h2>
              <p>
                본 약관의 해석 및 적용은 대한민국 법률을 따르며, 서비스 이용과 관련한 분쟁은 서비스 제공자의 소재지를 관할하는 법원을 전속 관할로 합니다.
              </p>
            </section>

            <section className="pt-4">
              <p>
                <strong>시행일자</strong>: 2026년 2월 13일
              </p>
            </section>
          </div>

          {/* 하단 버튼 */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
            <Link
              to="/login"
              className="px-6 py-2.5 text-sm font-medium text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
            >
              ← 로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
