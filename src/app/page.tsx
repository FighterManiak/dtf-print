import Link from 'next/link'
import { PRODUCTS, VERIFIED_PRODUCTS } from '@/types'
import { ArrowRight, Upload, Zap, Truck, ShieldCheck, Star, Clock, CheckCircle2, Printer } from 'lucide-react'
import ProductsSection from '@/components/ui/ProductsSection'

export default function Home() {
  return (
    <div className="bg-white">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#0f0f0f] text-white">
        {/* 배경 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-purple-600/10 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-28 flex flex-col items-center text-center gap-6 md:gap-8">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs md:text-sm font-medium text-white/80 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            국내 최고 품질의 DTF 출력 서비스
          </div>

          <h1 className="text-4xl md:text-7xl font-extrabold leading-tight tracking-tight">
            당신의 디자인을<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              현실로 만드세요
            </span>
          </h1>

          <p className="text-base md:text-xl text-white/60 max-w-xl leading-relaxed">
            시안 파일 업로드부터 출력·발송까지.<br />
            빠르고 선명한 DTF 출력을 경험하세요.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-1">
            <Link
              href="/order"
              className="inline-flex items-center justify-center gap-2 bg-white text-black font-bold px-8 py-4 rounded-2xl hover:bg-gray-100 transition-all text-base shadow-lg shadow-white/10"
            >
              지금 주문하기 <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/#products"
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-8 py-4 rounded-2xl hover:bg-white/20 transition-all text-base backdrop-blur-sm"
            >
              상품 보기
            </Link>
          </div>

          {/* 신뢰 지표 */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-6 md:gap-8 mt-4 pt-6 md:pt-8 border-t border-white/10 w-full">
            {[
              { value: '10,000+', label: '누적 주문' },
              { value: '99.8%', label: '고객 만족도' },
              { value: '1-3일', label: '평균 출력·발송' },
              { value: '24시간', label: '고객 지원' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-xl md:text-2xl font-bold text-white">{value}</div>
                <div className="text-xs md:text-sm text-white/50 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 특징 3가지 ── */}
      <section className="bg-[#f8f8f8] py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Upload,
                color: 'bg-blue-50 text-blue-600',
                title: '간편한 파일 업로드',
                desc: 'PNG, AI, PSD, PDF 등 다양한 포맷을 지원합니다. 파일을 올리기만 하면 끝.',
              },
              {
                icon: Zap,
                color: 'bg-yellow-50 text-yellow-600',
                title: '빠른 출력 & 발송',
                desc: '접수 후 1~3일 내 출력 완료. 전국 당일·익일 배송으로 빠르게 받아보세요.',
              },
              {
                icon: ShieldCheck,
                color: 'bg-green-50 text-green-600',
                title: 'DTF 장비 보유 특가',
                desc: '장비 보유 인증 시 전용 특가 상품 제공. 인증 절차도 간단합니다.',
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 주문 프로세스 ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-extrabold text-gray-900">4단계로 완성되는 주문</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: CheckCircle2, step: '01', title: '상품 선택', desc: '출력 사이즈와 수량을 선택하세요', color: 'bg-blue-600' },
              { icon: Upload, step: '02', title: '시안 업로드', desc: '디자인 파일과 요청사항을 입력하세요', color: 'bg-purple-600' },
              { icon: Clock, step: '03', title: '결제 완료', desc: '토스페이먼츠로 안전하게 결제하세요', color: 'bg-pink-600' },
              { icon: Truck, step: '04', title: '출력 & 배송', desc: '빠른 출력 후 바로 발송됩니다', color: 'bg-orange-500' },
            ].map(({ icon: Icon, step, title, desc, color }, idx) => (
              <div key={step} className="relative">
                {idx < 3 && (
                  <div className="hidden md:block absolute top-8 left-[calc(100%-8px)] w-1/2 h-px border-t-2 border-dashed border-gray-200 z-0" />
                )}
                <div className="relative z-10 flex flex-col items-center text-center gap-3">
                  <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-400">STEP {step}</span>
                  <h3 className="font-bold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-14">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 bg-black text-white font-bold px-10 py-4 rounded-2xl hover:bg-gray-900 transition-colors text-base"
            >
              지금 바로 주문하기 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 상품 목록 ── */}
      <div id="products">
        <ProductsSection products={PRODUCTS} verifiedProducts={VERIFIED_PRODUCTS} />
      </div>

      {/* ── 고객 후기 ── */}
      <section className="bg-[#f8f8f8] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Reviews</p>
            <h2 className="text-4xl font-extrabold text-gray-900">고객들의 이야기</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: '김○○', role: '의류 브랜드 운영', rating: 5, text: '색상 표현이 정말 선명하고 납기도 빨랐어요. 재주문은 무조건 여기서 합니다.' },
              { name: '이○○', role: 'DTF 장비 보유 업체', rating: 5, text: '인증 후 단가가 확 낮아져서 수익이 많이 개선됐어요. 꼭 인증받으세요!' },
              { name: '박○○', role: '개인 셀러', rating: 5, text: '처음 주문인데도 시안 검토부터 발송까지 꼼꼼하게 챙겨주셔서 감사했습니다.' },
            ].map(({ name, role, rating, text }) => (
              <div key={name} className="bg-white rounded-3xl p-7 shadow-sm flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">"{text}"</p>
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="font-bold text-gray-900 text-sm">{name}</div>
                  <div className="text-xs text-gray-400">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section className="bg-[#0f0f0f] py-24 px-6 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Printer className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            지금 바로 시작해보세요
          </h2>
          <p className="text-white/50 text-lg mb-10">
            파일만 있으면 됩니다. 나머지는 저희가 처리합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/order"
              className="inline-flex items-center justify-center gap-2 bg-white text-black font-bold px-10 py-4 rounded-2xl hover:bg-gray-100 transition-all text-base"
            >
              주문하기 <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-10 py-4 rounded-2xl hover:bg-white/20 transition-all text-base"
            >
              무료 회원가입
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
