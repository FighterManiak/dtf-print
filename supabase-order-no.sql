-- ============================================
-- 주문번호(order_no) 부여
-- Supabase SQL Editor에서 실행하세요.
-- 형식: 250826-001 (YYMMDD-일련번호)
-- ============================================

-- 1) 컬럼 추가
alter table orders            add column if not exists order_no text;
alter table quotes            add column if not exists order_no text;
alter table material_orders   add column if not exists order_no text;

-- 2) 주문번호 생성 함수 (KST 날짜 기준 일별 순번)
create or replace function gen_order_no(prefix text, tbl text)
returns text as $$
declare
  d text := to_char((now() at time zone 'Asia/Seoul'), 'YYMMDD');
  cnt integer;
  sql text;
begin
  sql := format('select count(*) from %I where order_no like %L', tbl, d || '-%');
  execute sql into cnt;
  return d || '-' || lpad((cnt + 1)::text, 3, '0');
end;
$$ language plpgsql;

-- 3) 신규 행에 자동 부여하는 트리거
create or replace function set_order_no()
returns trigger as $$
declare
  d text := to_char((now() at time zone 'Asia/Seoul'), 'YYMMDD');
  cnt integer;
begin
  if new.order_no is null then
    execute format('select count(*) from %I where order_no like %L', tg_table_name, d || '-%') into cnt;
    new.order_no := d || '-' || lpad((cnt + 1)::text, 3, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_order_no on orders;
create trigger trg_order_no before insert on orders
  for each row execute function set_order_no();

drop trigger if exists trg_order_no on quotes;
create trigger trg_order_no before insert on quotes
  for each row execute function set_order_no();

drop trigger if exists trg_order_no on material_orders;
create trigger trg_order_no before insert on material_orders
  for each row execute function set_order_no();

-- 4) 기존 데이터에 주문번호 소급 부여 (생성일 순)
with numbered as (
  select id,
         to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD') as d,
         row_number() over (
           partition by to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD')
           order by created_at
         ) as rn
  from orders where order_no is null
)
update orders o set order_no = n.d || '-' || lpad(n.rn::text, 3, '0')
from numbered n where o.id = n.id;

with numbered as (
  select id,
         to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD') as d,
         row_number() over (
           partition by to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD')
           order by created_at
         ) as rn
  from quotes where order_no is null
)
update quotes q set order_no = n.d || '-' || lpad(n.rn::text, 3, '0')
from numbered n where q.id = n.id;

with numbered as (
  select id,
         to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD') as d,
         row_number() over (
           partition by to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD')
           order by created_at
         ) as rn
  from material_orders where order_no is null
)
update material_orders m set order_no = n.d || '-' || lpad(n.rn::text, 3, '0')
from numbered n where m.id = n.id;

create index if not exists idx_orders_order_no on orders(order_no);
create index if not exists idx_quotes_order_no on quotes(order_no);
create index if not exists idx_material_orders_order_no on material_orders(order_no);
