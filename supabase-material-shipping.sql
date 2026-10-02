-- 자재 상품별 택배비 설정
-- Supabase → SQL Editor → New query 에 붙여넣고 Run (여러 번 실행해도 안전)
-- 값이 비어 있는 상품은 기본 정책(3만원 이상 무료, 미만 3,000원)으로 계산됩니다.

alter table materials add column if not exists shipping jsonb;
