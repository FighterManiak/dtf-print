-- DTF 출력 서비스 Supabase 스키마

-- 주문 테이블
create table orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_address text not null,
  status text not null default 'pending'
    check (status in ('pending','paid','in_progress','shipped','delivered','cancelled')),
  total_amount integer not null default 0,
  payment_key text,
  payment_method text,
  tracking_number text
);

-- 주문 상품 테이블
create table order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id text not null,
  quantity integer not null default 1,
  cutting boolean not null default false,
  file_url text,
  file_name text,
  request_note text,
  unit_price integer not null
);

-- DTF 인증 요청 테이블
create table dtf_verifications (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  user_name text not null,
  file_urls text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamp with time zone,
  reject_reason text
);

alter table dtf_verifications enable row level security;

-- 본인만 조회/생성 가능
create policy "Users can view own verifications" on dtf_verifications for select
  using (auth.uid() = user_id);
create policy "Users can insert own verifications" on dtf_verifications for insert
  with check (auth.uid() = user_id);

-- 서비스 롤은 전체 접근 (관리자 승인/반려)
create policy "Service role full access verifications" on dtf_verifications
  using (auth.role() = 'service_role');

-- 파일 스토리지 버킷 (Supabase Dashboard에서 생성)
-- 버킷 이름: order-files     (주문 시안 파일)
-- 버킷 이름: verify-files    (인증 첨부 파일)
-- Public: false (비공개, 서명된 URL 사용)

-- RLS 정책
alter table orders enable row level security;
alter table order_items enable row level security;

-- 누구나 주문 생성 가능
create policy "Anyone can insert orders" on orders for insert with check (true);
create policy "Anyone can insert order_items" on order_items for insert with check (true);

-- 본인 이메일로만 조회 가능 (my-orders 페이지)
create policy "Users can view own orders by email" on orders for select
  using (customer_email = current_setting('request.jwt.claims', true)::json->>'email');

-- 서비스 롤은 전체 접근
create policy "Service role full access orders" on orders
  using (auth.role() = 'service_role');
create policy "Service role full access order_items" on order_items
  using (auth.role() = 'service_role');
