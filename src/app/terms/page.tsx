export const metadata = { title: '이용약관 · SUPER HARD' }

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-8 sm:px-10 sm:py-10 text-gray-800">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">이용약관</h1>
      <p className="text-sm text-gray-500 mb-8">시행일: 2026년 7월 3일</p>

      <div className="space-y-8 text-sm leading-relaxed text-gray-800">
        <section>
          <h2 className="font-bold text-gray-900 mb-2">제1조 (목적)</h2>
          <p>본 약관은 아유디스터디(이하 &quot;회사&quot;)가 운영하는 SUPER HARD DTF 출력 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제2조 (정의)</h2>
          <p>① &quot;서비스&quot;란 회사가 제공하는 DTF 전사 필름 출력 및 관련 인쇄 서비스를 말합니다.<br />
          ② &quot;이용자&quot;란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제3조 (서비스의 제공 및 변경)</h2>
          <p>① 회사는 이용자에게 DTF 출력물의 견적, 주문, 결제, 배송 서비스를 제공합니다.<br />
          ② 회사는 서비스의 내용, 품질, 가격 등을 변경할 수 있으며, 변경 시 사전에 공지합니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제4조 (주문 및 결제)</h2>
          <p>① 이용자는 회사가 정한 절차에 따라 견적 또는 바로주문을 통해 상품을 주문합니다.<br />
          ② 결제는 신용카드, 무통장입금 등 회사가 제공하는 수단으로 이루어집니다.<br />
          ③ 시안 파일에 따른 제작 특성상 작업이 개시된 이후에는 주문 취소가 제한될 수 있습니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제5조 (배송)</h2>
          <p>① 배송비는 주문 금액 및 배송 지역에 따라 부과됩니다.<br />
          ② 기본 배송비는 3,000원이며, 9,900원 이상 구매 시 기본 배송비는 무료입니다. 제주 지역은 3,000원, 그 외 도서산간 지역은 5,000원의 추가 배송비가 부과됩니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제6조 (취소 및 환불)</h2>
          <p>① 제작 개시 전에는 전액 환불이 가능합니다.<br />
          ② 주문 제작 상품의 특성상 제작이 개시된 이후 또는 이용자의 시안·요청에 따라 제작된 상품은 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 청약철회가 제한될 수 있습니다.<br />
          ③ 제품 하자 또는 오배송의 경우 회사 부담으로 재제작 또는 환불 처리합니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제7조 (이용자의 의무)</h2>
          <p>이용자는 타인의 저작권·상표권 등 지식재산권을 침해하는 시안을 주문해서는 안 되며, 이로 인해 발생하는 법적 책임은 이용자에게 있습니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">제8조 (면책조항)</h2>
          <p>회사는 천재지변, 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.</p>
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
