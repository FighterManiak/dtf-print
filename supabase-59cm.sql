-- 상품명·설명의 57cm / 58cm 표기를 59cm 로 변경
-- Supabase → SQL Editor → New query 에 붙여넣고 Run
-- ※ 상품 ID(roll_58 등)는 건드리지 않습니다 — 기존 주문 내역이 그대로 유지됩니다.

-- 변경 전 확인
select id, name, description from products
 where name ilike '%57cm%' or name ilike '%58cm%'
    or description ilike '%57cm%' or description ilike '%58cm%';

-- 상품명 변경
update products
   set name = replace(replace(name, '57cm', '59cm'), '58cm', '59cm')
 where name like '%57cm%' or name like '%58cm%';

-- 상품 설명 변경
update products
   set description = replace(replace(description, '57cm', '59cm'), '58cm', '59cm')
 where description like '%57cm%' or description like '%58cm%';

-- 변경 결과 확인
select id, name, description from products order by sort_order;
