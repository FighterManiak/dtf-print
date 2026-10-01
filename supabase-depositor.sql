-- 무통장 입금자명 + 증빙 발행 기록 (그룹웨어 MCP 연동)
-- Supabase → SQL Editor → New query 에 전체 붙여넣고 Run (여러 번 실행해도 안전)

-- ── 출력 주문 (orders) ─────────────────────────────────────
-- 입금자명 (주문자와 다를 수 있음: 회사명·가족 명의 등)
alter table orders add column if not exists depositor_name    text;
-- 증빙(세금계산서·현금영수증) 발행 완료 기록
alter table orders add column if not exists receipt_issued_at timestamptz;
alter table orders add column if not exists receipt_doc_no    text;

-- 과거 견적 무통장 주문은 결제수단이 비어 있어 채워줌
update orders
   set payment_method = 'bank_transfer'
 where payment_method is null
   and memo like '무통장입금%';

-- 기존 무통장 주문은 주문자명을 입금자명으로 채움
update orders
   set depositor_name = user_name
 where depositor_name is null
   and payment_method = 'bank_transfer'
   and user_name is not null;

create index if not exists idx_orders_receipt_pending
  on orders (receipt_type, receipt_issued_at)
  where receipt_type is not null;

-- ── 자재 주문 (material_orders) ────────────────────────────
alter table material_orders add column if not exists depositor_name    text;
alter table material_orders add column if not exists receipt_type      text;
alter table material_orders add column if not exists receipt_info      jsonb;
alter table material_orders add column if not exists receipt_issued_at timestamptz;
alter table material_orders add column if not exists receipt_doc_no    text;

update material_orders
   set depositor_name = user_name
 where depositor_name is null
   and payment_method = 'bank_transfer'
   and user_name is not null;

create index if not exists idx_material_orders_receipt_pending
  on material_orders (receipt_type, receipt_issued_at)
  where receipt_type is not null;
