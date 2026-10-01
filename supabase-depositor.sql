-- 무통장 입금자명 + 증빙 발행 기록 (그룹웨어 MCP 연동 준비)
-- Supabase → SQL Editor → New query 에 붙여넣고 Run

-- 입금자명 (주문자와 다를 수 있음: 회사명·가족 명의 등)
alter table orders add column if not exists depositor_name text;

-- 증빙(세금계산서·현금영수증) 발행 완료 기록 — 그룹웨어에서 발행 후 표시
alter table orders add column if not exists receipt_issued_at timestamptz;
alter table orders add column if not exists receipt_doc_no    text;

-- 기존 무통장 주문은 주문자명을 입금자명으로 채움
update orders
   set depositor_name = user_name
 where depositor_name is null
   and payment_method = 'bank_transfer'
   and user_name is not null;

-- 발행 대상 조회 성능
create index if not exists idx_orders_receipt_pending
  on orders (receipt_type, receipt_issued_at)
  where receipt_type is not null;
