-- 채팅 메시지 직접 접근 차단
-- 공개키(anon)로 chat_messages 전체(고객 상담 내용)를 읽을 수 있던 문제 수정.
-- 고객 채팅은 이제 서버 API(/api/chat/messages)에서 방 권한을 확인한 뒤 읽고 씀.
-- ※ 새 코드가 배포된 뒤에 실행하세요.

alter table public.chat_messages enable row level security;

-- chat_messages 에 걸린 기존 정책을 모두 제거 → 서버(서비스키)만 접근 가능
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'chat_messages' loop
    execute format('drop policy %I on public.chat_messages', p.policyname);
  end loop;
end $$;

-- 확인: 아래 결과가 0 이면 정상
select count(*) as remaining_policies from pg_policies where schemaname = 'public' and tablename = 'chat_messages';
