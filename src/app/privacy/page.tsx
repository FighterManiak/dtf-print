export const metadata = { title: '개인정보처리방침 · SUPER HARD' }

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-8 sm:px-10 sm:py-10 text-gray-800">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-gray-500 mb-8">시행일: 2026년 7월 3일</p>

      <div className="space-y-8 text-sm leading-relaxed text-gray-800">
        <section>
          <p>아유디스터디(이하 &quot;회사&quot;)는 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같은 처리방침을 두고 있습니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제1조 (수집하는 개인정보 항목)</h2>
          <p>회사는 회원가입, 주문·배송, 고객상담을 위해 아래 정보를 수집합니다.<br />
          · 필수: 이름, 이메일, 연락처, 배송지 주소(우편번호 포함)<br />
          · 결제 시: 결제 승인 정보(결제수단, 결제키) — 카드번호 등 민감정보는 결제대행사(토스페이먼츠)가 처리하며 회사는 보관하지 않습니다.<br />
          · 선택: 회사명</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제2조 (개인정보의 수집 및 이용목적)</h2>
          <p>① 서비스 제공: 주문 접수, 견적 발송, 결제, 상품 제작 및 배송<br />
          ② 회원 관리: 본인 확인, 문의 대응, 공지 전달<br />
          ③ 서비스 개선 및 통계 분석</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제3조 (개인정보의 보유 및 이용기간)</h2>
          <p>회사는 원칙적으로 개인정보 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만 관련 법령에 따라 아래와 같이 보존합니다.<br />
          · 계약 또는 청약철회 등에 관한 기록: 5년<br />
          · 대금결제 및 재화 등의 공급에 관한 기록: 5년<br />
          · 소비자의 불만 또는 분쟁처리에 관한 기록: 3년</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제4조 (개인정보의 제3자 제공)</h2>
          <p>회사는 이용자의 개인정보를 본 방침에 명시한 범위를 넘어 제공하지 않습니다. 다만 배송을 위해 택배사에 수령인 정보(이름, 연락처, 주소)를, 결제를 위해 결제대행사에 필요한 정보를 제공합니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제5조 (개인정보 처리의 위탁)</h2>
          <p>· 결제 처리: 토스페이먼츠(주)<br />
          · 상품 배송: 계약 택배사<br />
          · 이메일 발송: 이메일 발송 대행 서비스</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제6조 (이용자의 권리)</h2>
          <p>이용자는 언제든지 자신의 개인정보를 조회·수정하거나 회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다. 회원정보 변경은 마이페이지에서 가능합니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제7조 (개인정보 보호책임자)</h2>
          <p>· 개인정보 보호책임자: 조봉준<br />
          · 연락처: 010-2803-8603 / superhard.int@gmail.com</p>
        </section>

        <section className="border-t border-gray-200 pt-6">
          <h2 className="font-bold text-gray-900 mb-3">사업자 정보</h2>
          <ul className="space-y-1 text-gray-700">
            <li><span className="inline-block w-32 text-gray-500">상호</span>아유디스터디</li>
            <li><span className="inline-block w-32 text-gray-500">대표자</span>조봉준</li>
            <li><span className="inline-block w-32 text-gray-500">사업자등록번호</span>617-27-96956</li>
            <li><span className="inline-block w-32 text-gray-500">통신판매업신고번호</span>2010-부산해운-0173</li>
            <li><span className="inline-block w-32 text-gray-500">사업장 소재지</span>부산광역시 기장군 장안읍 명례산단6로 14 1층 (46028)</li>
            <li><span className="inline-block w-32 text-gray-500">고객센터</span>010-2803-8603</li>
            <li><span className="inline-block w-32 text-gray-500">이메일</span>superhard.int@gmail.com</li>
          </ul>
        </section>
      </div>
      </div>
    </div>
  )
}
