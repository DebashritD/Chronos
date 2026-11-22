CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    timezone      VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE habit (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name          VARCHAR(80)  NOT NULL,
    min_text      VARCHAR(200) NOT NULL,
    target_text   VARCHAR(200) NOT NULL,
    frequency     VARCHAR(16)  NOT NULL CHECK (frequency IN ('DAILY', 'EVERY_N_DAYS', 'WEEKLY')),
    interval_days INT,
    start_date    DATE         NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT habit_interval_ck CHECK (
        (frequency = 'EVERY_N_DAYS' AND interval_days BETWEEN 2 AND 365)
        OR (frequency <> 'EVERY_N_DAYS' AND interval_days IS NULL))
);
CREATE INDEX habit_user_ix ON habit (user_id);

-- Inclusive date range; to_date NULL means the pause is still open (at most one open pause per habit).
CREATE TABLE habit_pause (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    habit_id  BIGINT NOT NULL REFERENCES habit (id) ON DELETE CASCADE,
    from_date DATE   NOT NULL,
    to_date   DATE,
    CONSTRAINT habit_pause_range_ck CHECK (to_date IS NULL OR to_date >= from_date)
);
CREATE UNIQUE INDEX habit_pause_open_ux ON habit_pause (habit_id) WHERE to_date IS NULL;

CREATE TABLE check_in (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    habit_id     BIGINT      NOT NULL REFERENCES habit (id) ON DELETE CASCADE,
    period_start DATE        NOT NULL,
    color        VARCHAR(8)  NOT NULL CHECK (color IN ('RED', 'YELLOW', 'GREEN')),
    note         VARCHAR(500),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_in_period_uq UNIQUE (habit_id, period_start)
);

-- Spring Session JDBC (copied from spring-session-jdbc schema-postgresql.sql)
CREATE TABLE spring_session (
    primary_id            CHAR(36) NOT NULL,
    session_id            CHAR(36) NOT NULL,
    creation_time         BIGINT   NOT NULL,
    last_access_time      BIGINT   NOT NULL,
    max_inactive_interval INT      NOT NULL,
    expiry_time           BIGINT   NOT NULL,
    principal_name        VARCHAR(100),
    CONSTRAINT spring_session_pk PRIMARY KEY (primary_id)
);
CREATE UNIQUE INDEX spring_session_ix1 ON spring_session (session_id);
CREATE INDEX spring_session_ix2 ON spring_session (expiry_time);
CREATE INDEX spring_session_ix3 ON spring_session (principal_name);

CREATE TABLE spring_session_attributes (
    session_primary_id CHAR(36)     NOT NULL,
    attribute_name     VARCHAR(200) NOT NULL,
    attribute_bytes    BYTEA        NOT NULL,
    CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id)
        REFERENCES spring_session (primary_id) ON DELETE CASCADE
);
