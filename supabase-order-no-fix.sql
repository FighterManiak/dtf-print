-- 주문번호 중복 해결 (일반주문 / 견적주문 / 자재주문 구분)
-- Supabase → SQL Editor → New query 에 전체 붙여넣고 Run
--
-- 변경 후 형식
--   일반주문 : 250901-001
--   견적주문 : Q250901-001   (견적이 주문으로 전환되면 같은 번호를 그대로 사용)
--   자재주문 : M250901-001

-- 1) 번호 발급용 카운터 테이블 (주문 삭제와 무관하게 번호가 겹치지 않도록)
create table if not exists order_seq (
  seq_key  text primary key,
  last_no  integer not null default 0
);

-- 2) 번호 발급 함수 (동시 주문에도 안전)
create or replace function next_order_no(p_prefix text)
returns text as $$
declare
  d   text := to_char((now() at time zone 'Asia/Seoul'), 'YYMMDD');
  k   text := p_prefix || d;
  n   integer;
begin
  insert into order_seq (seq_key, last_no) values (k, 1)
  on conflict (seq_key) do update set last_no = order_seq.last_no + 1
  returning last_no into n;

  return p_prefix || d || '-' || lpad(n::text, 3, '0');
end;
$$ language plpgsql;

-- 3) 테이블별 트리거 함수
create or replace function set_order_no_orders()
returns trigger as $$
begin
  -- 견적에서 전환된 주문은 견적번호를 그대로 사용하도록 미리 넣어줌
  if new.order_no is null then
    new.order_no := next_order_no('');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function set_order_no_quotes()
returns trigger as $$
begin
  if new.order_no is null then
    new.order_no := next_order_no('Q');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function set_order_no_materials()
returns trigger as $$
begin
  if new.order_no is null then
    new.order_no := next_order_no('M');
  end if;
  return new;
end;
$$ language plpgsql;

-- 4) 트리거 재설정
drop trigger if exists trg_order_no on orders;
create trigger trg_order_no before insert on orders
  for each row execute function set_order_no_orders();

drop trigger if exists trg_order_no on quotes;
create trigger trg_order_no before insert on quotes
  for each row execute function set_order_no_quotes();

drop trigger if exists trg_order_no on material_orders;
create trigger trg_order_no before insert on material_orders
  for each row execute function set_order_no_materials();

-- 5) 기존 데이터 정리 --------------------------------------------------

-- 5-1) 견적: Q 접두어로 다시 부여
with numbered as (
  select id,
         to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD') as d,
         row_number() over (
           partition by to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD')
           order by created_at, id
         ) as rn
  from quotes
)
update quotes q
   set order_no = 'Q' || n.d || '-' || lpad(n.rn::text, 3, '0')
  from numbered n
 where q.id = n.id;

-- 5-2) 견적에서 전환된 주문은 견적번호를 그대로 승계
update orders o
   set order_no = q.order_no
  from quotes q
 where q.order_id = o.id
   and q.order_no is not null;

-- 5-3) 나머지(직접) 주문은 접두어 없이 다시 부여
with direct as (
  select o.id,
         to_char((o.created_at at time zone 'Asia/Seoul'), 'YYMMDD') as d,
         row_number() over (
           partition by to_char((o.created_at at time zone 'Asia/Seoul'), 'YYMMDD')
           order by o.created_at, o.id
         ) as rn
  from orders o
  where not exists (select 1 from quotes q where q.order_id = o.id)
)
update orders o
   set order_no = d.d || '-' || lpad(d.rn::text, 3, '0')
  from direct d
 where o.id = d.id;

-- 5-4) 자재주문: M 접두어로 다시 부여
with numbered as (
  select id,
         to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD') as d,
         row_number() over (
           partition by to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD')
           order by created_at, id
         ) as rn
  from material_orders
)
update material_orders m
   set order_no = 'M' || n.d || '-' || lpad(n.rn::text, 3, '0')
  from numbered n
 where m.id = n.id;

-- 6) 카운터를 기존 최대번호에 맞춰 초기화 (이후 주문이 겹치지 않도록)
insert into order_seq (seq_key, last_no)
select 'Q' || to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD'),
       count(*)
  from quotes
 group by 1
on conflict (seq_key) do update set last_no = greatest(order_seq.last_no, excluded.last_no);

insert into order_seq (seq_key, last_no)
select to_char((o.created_at at time zone 'Asia/Seoul'), 'YYMMDD'),
       count(*)
  from orders o
 where not exists (select 1 from quotes q where q.order_id = o.id)
 group by 1
on conflict (seq_key) do update set last_no = greatest(order_seq.last_no, excluded.last_no);

insert into order_seq (seq_key, last_no)
select 'M' || to_char((created_at at time zone 'Asia/Seoul'), 'YYMMDD'),
       count(*)
  from material_orders
 group by 1
on conflict (seq_key) do update set last_no = greatest(order_seq.last_no, excluded.last_no);
