-- Destek talepleri — ticket + thread mesajları.
--
-- Kullanıcı /tr/destek'ten talep açar, admin WA'dan "/destek <id> mesaj"
-- komutuyla veya adminpanel /tickets sayfasından yanıtlar. Phase 2 admin
-- panel UI'sı aynı tabloları kullanır.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'replied', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id bigserial PRIMARY KEY,
  ticket_id bigint NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'admin')),
  sender_id uuid,
  message text NOT NULL,
  internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON public.support_messages(ticket_id, created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_tickets" ON public.support_tickets;
CREATE POLICY "users_read_own_tickets"
  ON public.support_tickets
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_tickets" ON public.support_tickets;
CREATE POLICY "users_insert_own_tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_read_messages" ON public.support_messages;
CREATE POLICY "users_read_messages"
  ON public.support_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
    AND internal_note = false
  );

DROP POLICY IF EXISTS "users_insert_messages_on_own" ON public.support_messages;
CREATE POLICY "users_insert_messages_on_own"
  ON public.support_messages
  FOR INSERT
  WITH CHECK (
    sender_type = 'user'
    AND internal_note = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_updated_at();
