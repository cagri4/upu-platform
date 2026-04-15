-- Customer tracking: pipeline stage + last contact + follow-up reminders
ALTER TABLE emlak_customers ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'yeni';
ALTER TABLE emlak_customers ADD COLUMN IF NOT EXISTS last_contact_date timestamptz;
ALTER TABLE emlak_customers ADD COLUMN IF NOT EXISTS next_followup_date timestamptz;
ALTER TABLE emlak_customers ADD COLUMN IF NOT EXISTS contact_count integer DEFAULT 0;

-- Contact history log
CREATE TABLE IF NOT EXISTS emlak_customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES emlak_customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  contact_type text NOT NULL, -- arama, mesaj, gosterim, sunum, teklif
  note text,
  result text, -- ilgili, ilgisiz, gorusme_planlandi, teklif_verildi, satis_kapandi
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON emlak_customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_user ON emlak_customer_contacts(user_id);
