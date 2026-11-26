CREATE TABLE task (
  id           UUID PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  text         VARCHAR(200) NOT NULL,
  scheduled_on DATE,
  done_on      DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX task_user_idx ON task (user_id);
