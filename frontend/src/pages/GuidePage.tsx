/**
 * @file GuidePage.tsx
 * @description 사용 가이드 페이지 - 앱 기능별 상세 사용법 안내
 */

import { useGoBack } from '../hooks/useGoBack'
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
  MessageCircle,
  Lightbulb,
} from 'lucide-react'

const sections = [
  { id: 'natural-input', icon: MessageSquare, label: '간편 입력 (자연어 AI 파싱)' },
  { id: 'transactions', icon: Receipt, label: '가계부 (지출/수입 관리)' },
  { id: 'recurring', icon: Repeat, label: '정기 거래' },
  { id: 'budgets', icon: PiggyBank, label: '예산 관리' },
  { id: 'categories', icon: Tags, label: '카테고리 관리' },
  { id: 'insights', icon: BarChart3, label: '리포트 (이달의 리포트)' },
  { id: 'assets', icon: Landmark, label: '자산 관리' },
  { id: 'household', icon: Users, label: '공유 가계부' },
  { id: 'telegram', icon: Send, label: '텔레그램 봇 연동' },
  { id: 'kakao', icon: MessageCircle, label: '카카오톡 봇 연동' },
  { id: 'tips', icon: Lightbulb, label: '팁과 단축키' },
] as const

function ExampleBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-[var(--surface-elevated)] rounded-lg p-3 text-sm text-[var(--text-secondary)] space-y-1">{children}</div>
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
    <section id={id} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6 scroll-mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-grape-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-grape-600" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </section>
  )
}

export default function GuidePage() {
  const goBack = useGoBack('/settings')

  return (
    <div className="space-y-6">
      <button
        onClick={() => goBack()}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--border-default)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>

      {/* 목차 */}
      <div className="bg-grape-50 rounded-2xl border border-grape-100 p-5">
        <h2 className="text-sm font-semibold text-grape-600 mb-3">목차</h2>
        <ol className="space-y-1.5">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-grape-600 transition-colors"
              >
                <span className="w-5 text-right text-[var(--text-muted)] text-xs">{i + 1}.</span>
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
          화면 우측 하단의 <strong>+ 버튼</strong>을 누르면 자연어로 지출/수입을 입력할 수 있습니다. AI가 자동으로
          금액, 카테고리, 날짜를 분류합니다.
        </p>
        <ExampleBox>
          <p>
            <strong>예시:</strong>
          </p>
          <p>
            <code className="bg-[var(--surface-hover)] px-1.5 rounded">"오늘 점심 김치찌개 8000원"</code> → 식비 8,000원 자동 분류
          </p>
          <p>
            <code className="bg-[var(--surface-hover)] px-1.5 rounded">"어제 교통비 3회 각 1500원"</code> → 교통비 4,500원 (3건)
          </p>
          <p>
            <code className="bg-[var(--surface-hover)] px-1.5 rounded">"월급 320만원 받았어"</code> → 수입 3,200,000원 자동 등록
          </p>
        </ExampleBox>
        <p className="text-[var(--text-tertiary)] text-xs">
          AI가 분류한 결과를 프리뷰로 보여주므로, 확인 후 저장하면 됩니다. 카테고리나 금액이 다르면 수정할 수 있어요.
        </p>
      </SectionCard>

      {/* 2. 가계부 */}
      <SectionCard id="transactions" icon={Receipt} title="가계부 (지출/수입 관리)">
        <p>
          하단 탭 바의 <strong>가계부</strong> 메뉴에서 월별 캘린더와 함께 지출/수입 내역을 한눈에 조회합니다.
        </p>
        <ExampleBox>
          <p>
            <strong>월 이동:</strong> 상단 좌우 화살표로 이전/다음 달 전환
          </p>
          <p>
            <strong>필터:</strong> 상단의 지출/수입 금액을 탭하면 해당 유형만 필터링 (다시 탭하면 전체)
          </p>
          <p>
            <strong>날짜 이동:</strong> 캘린더에서 날짜를 탭하면 해당 날짜의 거래로 자동 스크롤
          </p>
          <p>
            <strong>카테고리 변경:</strong> 거래 항목의 카테고리 뱃지를 탭하면 바텀시트에서 바로 변경
          </p>
          <p>
            <strong>상세/수정:</strong> 거래 항목을 탭하면 상세 페이지에서 수정/삭제
          </p>
        </ExampleBox>
        <p>캘린더 각 날짜에 그날의 지출/수입 금액이 간략히 표시되어 한 달의 소비 패턴을 파악할 수 있습니다.</p>
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
            <strong>관리:</strong> 실행 예정인 거래를 가계부 상단에서 확인하고 건너뛰기 가능
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
      <SectionCard id="insights" icon={BarChart3} title="리포트 (이달의 리포트)">
        <p>
          사이드바의 <strong>리포트</strong>에서 이달의 리포트를 확인합니다.
        </p>
        <ExampleBox>
          <p>
            <strong>종합 요약:</strong> 총 수입, 총 지출, 순수익, 저축률 + 순자산(자산 연동 시)
          </p>
          <p>
            <strong>지출 카테고리 TOP:</strong> 상위 5개 카테고리 비율 바 표시
          </p>
          <p>
            <strong>예산 vs 실제:</strong> 카테고리별 예산 대비 지출 비교
          </p>
          <p>
            <strong>자산 변화:</strong> 순자산 지난달 대비 증감 + 종류별 변화
          </p>
          <p>
            <strong>가계 건강 점수:</strong> 저축·지출·부채 기반 종합 등급 (A+~F)
          </p>
          <p>
            <strong>AI 상세 분석:</strong> 수입/지출/예산/자산을 분석하여 맞춤 인사이트 제공
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            자산 정보를 연동하면 더 풍부한 분석을 받을 수 있어요.
          </p>
        </ExampleBox>
      </SectionCard>

      {/* 7. 자산 관리 */}
      <SectionCard id="assets" icon={Landmark} title="자산 관리">
        <p>주식, 코인, 예적금, 부동산, 대출 등 다양한 자산을 한 곳에서 순자산 중심으로 관리합니다.</p>
        <ExampleBox>
          <p>
            <strong>지원 자산:</strong> 주식, 암호화폐, 예적금, 부동산, 대출 등
          </p>
          <p>
            <strong>처음 등록:</strong> 자산 탭 → 자산 유형 선택 → 정보 입력
          </p>
          <p>
            <strong>순자산 히어로:</strong> 현재 순자산, 총 자산, 총 부채를 상단에서 한눈에 확인
          </p>
          <p>
            <strong>이번 달 성과:</strong> 지난 스냅샷 대비 순자산 변화량과 유형별 원인 분해, 저축 연속 달성 스트릭 표시
          </p>
          <p>
            <strong>목표 설정:</strong> 순자산 목표 금액과 날짜를 설정하면 다음 마일스톤까지 진행률과 달성 페이스 추적
          </p>
          <p>
            <strong>추이 차트:</strong> 3M/6M/12M 기간별 순자산 변화를 영역 차트로 확인
          </p>
          <p>
            <strong>종류별 보기:</strong> 투자, 예적금, 부동산/기타, 부채 그룹으로 자산 목록 확인. 대출은 원래 대출금 입력 시 상환 진척도 표시
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
            <strong>전환:</strong> 상단 헤더의 드롭다운에서 개인/가구 전환
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
            <code className="bg-[var(--surface-hover)] px-1 rounded">/link 코드</code> 입력
          </p>
          <p>
            <strong>입력:</strong> 봇에게 <code className="bg-[var(--surface-hover)] px-1 rounded">"커피 4500원"</code> 같이 메시지
            전송
          </p>
          <p>
            <strong>조회:</strong> <code className="bg-[var(--surface-hover)] px-1 rounded">"이번 달 얼마 썼어?"</code>로 현황 확인
          </p>
        </ExampleBox>
        <p className="text-[var(--text-tertiary)] text-xs">
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

      {/* 10. 카카오톡 봇 */}
      <SectionCard id="kakao" icon={MessageCircle} title="카카오톡 봇 연동">
        <p>카카오톡 채널 봇을 연동하면 채팅으로 간편하게 지출/수입을 기록할 수 있습니다.</p>
        <ExampleBox>
          <p>
            <strong>연동:</strong> 설정 → 내 계정 → 카카오톡 연동 코드 발급 → 채널 채팅에{' '}
            <code className="bg-[var(--surface-hover)] px-1 rounded">/link 코드</code> 입력
          </p>
          <p>
            <strong>입력:</strong> 채널에 <code className="bg-[var(--surface-hover)] px-1 rounded">"커피 4500원"</code> 같이 메시지
            전송
          </p>
          <p>
            <strong>취소:</strong> <code className="bg-[var(--surface-hover)] px-1 rounded">/undo</code> 또는 저장 후 "방금 거 취소"
            버튼으로 마지막 지출 삭제
          </p>
          <p>
            <strong>카테고리 변경:</strong> 저장 후 "카테고리 변경" 버튼 또는{' '}
            <code className="bg-[var(--surface-hover)] px-1 rounded">/change 외식비</code>로 직접 변경
          </p>
          <p>
            <strong>조회:</strong> <code className="bg-[var(--surface-hover)] px-1 rounded">/report</code> 이번 달 지출 요약,{' '}
            <code className="bg-[var(--surface-hover)] px-1 rounded">/budget</code> 예산 상황
          </p>
        </ExampleBox>
        <p className="text-[var(--text-tertiary)] text-xs">
          카카오톡에서 <span className="font-mono">포도가계부</span> 채널을 검색하거나{' '}
          <a
            href="http://pf.kakao.com/_JsxnxhX/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="text-grape-600 underline"
          >
            채팅 바로가기
          </a>
          를 눌러 시작하세요.
        </p>
      </SectionCard>

      {/* 11. 팁과 단축키 */}
      <SectionCard id="tips" icon={Lightbulb} title="팁과 단축키">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-[var(--text-primary)] mb-1">홈 화면에 추가하기 (PWA)</p>
            <p>
              Safari(iOS) 또는 Chrome(Android)에서 <strong>"홈 화면에 추가"</strong>를 누르면 앱처럼 사용할 수
              있습니다.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)] mb-1">가계부가 첫 화면</p>
            <p>앱을 열면 바로 이번 달 거래 내역이 표시됩니다. 캘린더와 함께 소비 패턴을 한눈에 파악하세요.</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)] mb-1">새소식 (업데이트 알림)</p>
            <p>
              새로운 기능이 추가되면 사이드바의 <strong>설정</strong> 아이콘에 빨간 점이 표시됩니다.
              설정 → <strong>새소식</strong>에서 전체 업데이트 내역을 확인할 수 있어요.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)] mb-1">자연어 입력 팁</p>
            <ExampleBox>
              <p>
                여러 건 한 번에: <code className="bg-[var(--surface-hover)] px-1 rounded">"택시 2만원, 점심 9천원"</code>
              </p>
              <p>
                날짜 지정: <code className="bg-[var(--surface-hover)] px-1 rounded">"어제 마트에서 3만원"</code>
              </p>
              <p>
                수입도 가능: <code className="bg-[var(--surface-hover)] px-1 rounded">"프리랜서 수입 50만원"</code>
              </p>
            </ExampleBox>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
