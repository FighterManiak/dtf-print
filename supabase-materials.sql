-- ============================================
-- 자재 구매(쇼핑몰) 기능용 테이블
-- Supabase SQL Editor에서 실행하세요.
-- ============================================

-- 1) 자재 상품
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  description text,                  -- 짧은 설명(목록용)
  detail text,                       -- 상세 설명(상세페이지, 줄바꿈 허용)
  price integer not null default 0,  -- 판매가
  origin_price integer,              -- 정가(할인 표시용, 선택)
  unit text default '개',            -- 단위
  stock integer default 0,           -- 재고 (null이면 무제한)
  category text,                     -- 분류 (필름/파우더/잉크 등)
  images jsonb default '[]'::jsonb,  -- 이미지 경로 배열 (storage: material-images)
  is_active boolean default true,    -- 판매중 여부
  sort_order integer default 0       -- 노출 순서
);

-- 2) 자재 주문
create table if not exists material_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid,
  user_name text,
  user_email text,
  user_phone text,
  user_address text,
  order_name text,                   -- 주문 요약 (예: DTF 필름 외 2건)
  items jsonb default '[]'::jsonb,   -- [{materialId,name,price,qty}]
  product_amount integer default 0,  -- 상품 합계
  shipping_fee integer default 0,    -- 배송비
  used_points integer default 0,
  total_amount integer default 0,    -- 실제 결제 금액
  status text default 'pending',     -- pending/paid/in_progress/shipped/delivered/cancelled
  is_paid boolean default true,
  payment_method text,               -- bank_transfer / CARD
  payment_key text,
  carrier text,
  tracking_number text,
  memo text
);

-- 3) 자재 리뷰
create table if not exists material_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  material_id uuid not null,
  order_id uuid,
  user_id uuid,
  user_name text,
  rating integer default 5,
  content text,
  images jsonb default '[]'::jsonb,
  is_hidden boolean default false
);

create index if not exists idx_materials_active on materials(is_active, sort_order);
create index if not exists idx_material_orders_user on material_orders(user_id, created_at desc);
create index if not exists idx_material_reviews_material on material_reviews(material_id, created_at desc);

-- 4) 상품 이미지 버킷 (공개)
insert into storage.buckets (id, name, public)
values ('material-images', 'material-images', true)
on conflict (id) do nothing;
