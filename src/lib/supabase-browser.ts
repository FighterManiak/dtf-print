import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://fqjsdnmxaytuaanoqpfq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxanNkbm14YXl0dWFhbm9xcGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjE0ODIsImV4cCI6MjA5NzgzNzQ4Mn0.RvHpnjb0thBujtUHzRUC4Yzpn6eS2hzRdmgaekNJLAw'

export function isSupabaseConfigured() {
  return true
}

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
