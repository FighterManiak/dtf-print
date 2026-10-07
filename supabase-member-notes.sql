-- 영업일지 (업체별 미팅·통화·방문 기록)
-- Supabase → SQL Editor → New query 에 붙여넣고 Run (여러 번 실행해도 안전)

create table if not exists member_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,                 -- 기록을 남긴 회원
  company_key  text,                 -- 같은 업체 회원끼리 기록을 함께 보기 위한 키
  company_name text,                 -- 기록 당시 업체명
  note_date    date not null default ((now() at time zone 'Asia/Seoul')::date),
  kind         text not null default 'meeting',   -- meeting / call / visit / etc
  content      text not null,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_by   text,
  updated_at   timestamptz
);

create index if not exists idx_member_notes_user    on member_notes (user_id, note_date desc);
create index if not exists idx_member_notes_company on member_notes (company_key, note_date desc);

-- 관리자 API(서비스 키)로만 읽고 쓰도록 일반 접근은 막아둠
alter table member_notes enable row level security;
