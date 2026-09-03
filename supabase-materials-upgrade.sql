-- 자재 상품 상세페이지 고도화
-- Supabase → SQL Editor → New query 에 붙여넣고 Run

-- 상세페이지 이미지 (세로로 길게 나열되는 상세컷)
alter table materials add column if not exists detail_images text[] default '{}';

-- 판매 옵션 (예: [{"name":"사이즈","values":[{"label":"30cm","addPrice":0},{"label":"60cm","addPrice":5000}]}])
alter table materials add column if not exists options jsonb default '[]';

-- 배송/교환/반품 안내
alter table materials add column if not exists shipping_info text;

-- 상품 요약 정보 (브랜드, 제조사, 규격 등 표 형태로 노출)
alter table materials add column if not exists spec jsonb default '[]';
