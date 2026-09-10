-- 메일 발송 히스토리 강화
-- Supabase → SQL Editor → New query 에 붙여넣고 Run

-- 로그 테이블이 없다면 생성
create table if not exists email_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  type        text,
  subject     text,
  scope       text,
  sent_count  integer default 0,
  sent_by     text
);

-- 히스토리 조회용 컬럼 추가
alter table email_logs add column if not exists recipient  text;   -- 단건 발송 수신자
alter table email_logs add column if not exists body       text;   -- 본문(회원 발송만 저장)
alter table email_logs add column if not exists order_no   text;   -- 관련 주문번호
alter table email_logs add column if not exists ok         boolean default true;

-- 조회 성능
create index if not exists idx_email_logs_created on email_logs (created_at desc);
create index if not exists idx_email_logs_type    on email_logs (type);
