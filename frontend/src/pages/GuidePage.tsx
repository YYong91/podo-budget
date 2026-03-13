/**
 * @file GuidePage.tsx
 * @description 사용 가이드 페이지 - 앱 기능별 상세 사용법 안내
 */

import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquare,
  Receipt,
  Repeat,
  PiggyBank,
  Tags,
  BarChart3,
  Landmark,
  Users,
  Send,
  Lightbulb,
} from 'lucide-react'

const sections = [
  { id: 'natural-input', icon: MessageSquare, label: '간편 입력 (자연어 AI 파싱)' },
  { id: 'transactions', icon: Receipt, label: '가계부 (지출/수입 관리)' },
  { id: 'recurring', icon: Repeat, label: '정기 거래' },
  { id: 'budgets', icon: PiggyBank, label: '예산 관리' },
  { id: 'categories', icon: Tags, label: '카테고리 관리' },
  { id: 'insights', icon: BarChart3, label: '리포트 (종합 재무 리포트)' },
  { id: 'assets', icon: Landmark, label: '자산 관리' },
  { id: 'household', icon: Users, label: '공유 가계부' },
  { id: 'telegram', icon: Send, label: '텔레그램 봇 연동' },
  { id: 'tips', icon: Lightbulb, label: '팁과 단축키' },
] as const

function ExampleBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-warm-50 rounded-lg p-3 text-sm text-warm-700 space-y-1">{children}</div>
}

function SectionCard({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6 scroll-mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-grape-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-grape-600" />
        </div>
        <h2 className="text-lg font-semibold text-warm-900">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-warm-700 leading-relaxed">{children}</div>
    </section>
  )
}

export default function GuidePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/settings')}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-warm-200 hover:bg-warm-50 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-warm-600" />
      </button>

      {/* 목차 */}
      <div className="bg-grape-50 rounded-2xl border border-grape-100 p-5">
        <h2 className="text-sm font-semibold text-grape-700 mb-3">목차</h2>
        <ol className="space-y-1.5">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2 text-sm text-warm-700 hover:text-grape-600 transition-colors"
              >
                <span className="w-5 text-right text-warm-400 text-xs">{i + 1}.</span>
                <s.icon className="w-4 h-4 text-grape-400" />
                <span>{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      {/* 1. 간편 입력 */}
      <SectionCard id="natural-input" icon={MessageSquare} title="간편 입력 (자연어 AI 파싱)">
        <p>
          대시보드 하단의 <strong>+ 버튼</strong>을 누르면 자연어로 지출/수입을 입력할 수 있습니다. AI가 자동으로
          금액, 카테고리, 날짜를 분류합니다.
        </p>
        <ExampleBox>
          <p>
            <strong>예시:</strong>
          </p>
          <p>
            <code className="bg-warm-100 px-1.5 rounded">"오늘 점심 김치찌개 8000원"</code> → 식비 8,000원 자동 분류
          </p>
          <p>
            <code className="bg-warm-100 px-1.5 rounded">"어제 교통비 3회 각 1500원"</code> → 교통비 4,500원 (3건)
          </p>
          <p>
            <code className="bg-warm-100 px-1.5 rounded">"월급 320만원 받았어"</code> → 수입 3,200,000원 자동 등록
          </p>
        </ExampleBox>
        <p className="text-warm-500 text-xs">
          AI가 분류한 결과를 프리뷰로 보여주므로, 확인 후 저장하면 됩니다. 카테고리나 금액이 다르면 수정할 수 있어요.
        </p>
      </SectionCard>

      {/* 2. 가계부 */}
      <SectionCard id="transactions" icon={Receipt} title="가계부 (지출/수입 관리)">
        <p>
          사이드바의 <strong>내역</strong> 메뉴에서 지출과 수입 내역을 탭으로 전환하여 조회합니다.
        </p>
        <ExampleBox>
          <p>
            <strong>지출 입력:</strong> + 버튼 → 자연어 입력 또는 직접 입력 폼
          </p>
          <p>
            <strong>수입 입력:</strong> + 버튼 → "수입" 탭 선택 후 입력
          </p>
          <p>
            <strong>상세/수정:</strong> 목록에서 항목 탭 → 상세 페이지에서 수정/삭제
          </p>
        </ExampleBox>
        <p>월별로 자동 그룹핑되며, 대시보드에서 이번 달 요약(총 지출, 총 수입, 순수익)을 확인할 수 있습니다.</p>
      </SectionCard>

      {/* 3. 정기 거래 */}
      <SectionCard id="recurring" icon={Repeat} title="정기 거래">
        <p>
          매달 반복되는 지출/수입(월세, 구독료, 월급 등)을 <strong>정기 거래</strong>로 등록하면 자동으로 기록됩니다.
        </p>
        <ExampleBox>
          <p>
            <strong>등록:</strong> 설정 → 반복 거래 → 새 정기 거래 추가
          </p>
          <p>
            <strong>주기:</strong> 매일 / 매주 / 매월 / 매년 선택 가능
          </p>
          <p>
            <strong>관리:</strong> 실행 예정인 거래를 대시보드에서 확인하고 건너뛰기 가능
          </p>
        </ExampleBox>
      </SectionCard>

      {/* 4. 예산 관리 */}
      <SectionCard id="budgets" icon={PiggyBank} title="예산 관리">
        <p>카테고리별로 월 예산을 설정하면 지출 대비 잔여 예산을 실시간으로 추적합니다.</p>
        <ExampleBox>
          <p>
            <strong>설정:</strong> 설정 → 예산 관리 → 카테고리별 월 예산 금액 입력
          </p>
          <p>
            <strong>추적:</strong> 리포트에서 예산 대비 실제 지출 비교 차트 확인
          </p>
          <p>
            <strong>알림:</strong> 예산 80% 이상 사용 시 리포트에서 경고 표시
          </p>
        </ExampleBox>
      </SectionCard>

      {/* 5. 카테고리 관리 */}
      <SectionCard id="categories" icon={Tags} title="카테고리 관리">
        <p>지출과 수입 카테고리를 자유롭게 추가/수정/삭제할 수 있습니다.</p>
        <ExampleBox>
          <p>
            <strong>기본 지출 카테고리:</strong> 식비, 교통비, 쇼핑, 문화/여가, 의료, 교육 등
          </p>
          <p>
            <strong>기본 수입 카테고리:</strong> 급여, 부수입, 투자수익 등
          </p>
          <p>
            <strong>커스텀:</strong> 나만의 카테고리를 자유롭게 추가 가능
          </p>
        </ExampleBox>
        <p>AI 자연어 입력 시에도 커스텀 카테고리를 자동으로 인식합니다.</p>
      </SectionCard>

      {/* 6. 리포트 */}
      <SectionCard id="insights" icon={BarChart3} title="리포트 (종합 재무 리포트)">
        <p>
          사이드바의 <strong>리포트</strong>에서 월별 종합 재무 현황을 확인합니다.
        </p>
        <ExampleBox>
          <p>
            <strong>요약 카드:</strong> 총 지출, 총 수입, 순수익, 일평균 지출
          </p>
          <p>
            <strong>추이 차트:</strong> 지출/수입 월별 추이 그래프
          </p>
          <p>
            <strong>예산 vs 실제:</strong> 카테고리별 예산 대비 지출 비교
          </p>
          <p>
            <strong>AI 하이라이트:</strong> 이번 달 주요 소비 패턴 자동 분석
          </p>
        </ExampleBox>
      </SectionCard>

      {/* 7. 자산 관리 */}
      <SectionCard id="assets" icon={Landmark} title="자산 관리">
        <p>주식, 코인, 예적금, 부동산, 대출 등 다양한 자산을 한 곳에서 관리합니다.</p>
        <ExampleBox>
          <p>
            <strong>지원 자산:</strong> 주식, 암호화폐, 예적금, 부동산, 대출 등
          </p>
          <p>
            <strong>등록:</strong> 자산 → + 버튼 → 자산 유형 선택 후 정보 입력
          </p>
          <p>
            <strong>현황:</strong> 총 자산, 순자산(자산-부채) 한눈에 확인
          </p>
        </ExampleBox>
      </SectionCard>

      {/* 8. 공유 가계부 */}
      <SectionCard id="household" icon={Users} title="공유 가계부 (가구/초대)">
        <p>가족이나 동거인과 함께 가계부를 공유할 수 있습니다.</p>
        <ExampleBox>
          <p>
            <strong>가구 생성:</strong> 설정 → 공유 가계부 → 새 가구 만들기
          </p>
          <p>
            <strong>초대:</strong> 이메일로 가구 구성원 초대
          </p>
          <p>
            <strong>전환:</strong> 대시보드 상단 드롭다운에서 개인/가구 전환
          </p>
          <p>
            <strong>필터:</strong> 가구 모드에서 멤버별 지출 필터링 가능
          </p>
        </ExampleBox>
      </SectionCard>

      {/* 9. 텔레그램 봇 */}
      <SectionCard id="telegram" icon={Send} title="텔레그램 봇 연동">
        <p>텔레그램 봇을 연동하면 채팅으로 간편하게 지출/수입을 기록할 수 있습니다.</p>
        <ExampleBox>
          <p>
            <strong>연동:</strong> 설정 → 내 계정 → 텔레그램 연동 코드 발급 → 봇에{' '}
            <code className="bg-warm-100 px-1 rounded">/link 코드</code> 입력
          </p>
          <p>
            <strong>입력:</strong> 봇에게 <code className="bg-warm-100 px-1 rounded">"커피 4500원"</code> 같이 메시지
            전송
          </p>
          <p>
            <strong>조회:</strong> <code className="bg-warm-100 px-1 rounded">"이번 달 얼마 썼어?"</code>로 현황 확인
          </p>
        </ExampleBox>
        <p className="text-warm-500 text-xs">
          봇 주소: <span className="font-mono">@homenrich_bot</span> (
          <a
            href="https://t.me/homenrich_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-grape-600 underline"
          >
            t.me/homenrich_bot
          </a>
          )
        </p>
      </SectionCard>

      {/* 10. 팁과 단축키 */}
      <SectionCard id="tips" icon={Lightbulb} title="팁과 단축키">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-warm-800 mb-1">홈 화면에 추가하기 (PWA)</p>
            <p>
              Safari(iOS) 또는 Chrome(Android)에서 <strong>"홈 화면에 추가"</strong>를 누르면 앱처럼 사용할 수
              있습니다.
            </p>
          </div>
          <div>
            <p className="font-semibold text-warm-800 mb-1">포도알 성장</p>
            <p>거래를 기록할수록 포도알이 자라납니다. 대시보드에서 이번 달 성장 현황을 확인하세요.</p>
          </div>
          <div>
            <p className="font-semibold text-warm-800 mb-1">새소식 (업데이트 알림)</p>
            <p>
              새로운 기능이 추가되면 사이드바의 <strong>설정</strong> 아이콘에 빨간 점이 표시됩니다.
              설정 → <strong>새소식</strong>에서 전체 업데이트 내역을 확인할 수 있어요.
            </p>
          </div>
          <div>
            <p className="font-semibold text-warm-800 mb-1">자연어 입력 팁</p>
            <ExampleBox>
              <p>
                여러 건 한 번에: <code className="bg-warm-100 px-1 rounded">"택시 2만원, 점심 9천원"</code>
              </p>
              <p>
                날짜 지정: <code className="bg-warm-100 px-1 rounded">"어제 마트에서 3만원"</code>
              </p>
              <p>
                수입도 가능: <code className="bg-warm-100 px-1 rounded">"프리랜서 수입 50만원"</code>
              </p>
            </ExampleBox>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
