-- ANCIENFX / FXMIRROR — Schéma initial (MySQL 8+)
-- Exécuté par scripts/migrate.mjs (lecture de backend/migrations/*.sql).
-- Toutes les tables utilisent InnoDB + utf8mb4.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ── Utilisateurs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name            VARCHAR(120)    NOT NULL,
  email                VARCHAR(190)    NOT NULL,
  password_hash        VARCHAR(255)    NOT NULL,
  referral_code        VARCHAR(32)     NOT NULL,
  referred_by_user_id  BIGINT UNSIGNED NULL,
  status               ENUM('active','pending','blocked') NOT NULL DEFAULT 'active',
  trial_ends_at        DATETIME        NULL,
  trial_used           TINYINT(1)      NOT NULL DEFAULT 0,
  last_login_at        DATETIME        NULL,
  created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  UNIQUE KEY users_referral_code_unique (referral_code),
  KEY users_referred_by_idx (referred_by_user_id),
  KEY users_status_idx (status),
  CONSTRAINT users_referred_by_fk FOREIGN KEY (referred_by_user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Comptes MT4/MT5 connectés ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mt5_accounts (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  login          VARCHAR(32)     NOT NULL,
  server         VARCHAR(120)    NOT NULL,
  broker         VARCHAR(120)    NULL,
  account_type   VARCHAR(32)     NULL,
  leverage       INT             NULL,
  is_demo        TINYINT(1)      NOT NULL DEFAULT 0,
  status         ENUM('connected','disconnected','expired') NOT NULL DEFAULT 'connected',
  balance        DECIMAL(18,2)   NOT NULL DEFAULT 0,
  equity         DECIMAL(18,2)   NOT NULL DEFAULT 0,
  free_margin    DECIMAL(18,2)   NOT NULL DEFAULT 0,
  daily_profit   DECIMAL(18,2)   NOT NULL DEFAULT 0,
  currency       VARCHAR(10)     NOT NULL DEFAULT 'USD',
  connected_at   DATETIME        NULL,
  last_sync_at   DATETIME        NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY mt5_accounts_user_idx (user_id),
  KEY mt5_accounts_status_idx (status),
  CONSTRAINT mt5_accounts_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sessions du bot (cycles de 24h) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_sessions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  mt5_account_id  BIGINT UNSIGNED NOT NULL,
  status          ENUM('idle','running','payment_due','paid','cancelled') NOT NULL DEFAULT 'idle',
  start_balance   DECIMAL(18,2)   NULL,
  end_balance     DECIMAL(18,2)   NULL,
  profit          DECIMAL(18,2)   NULL,
  platform_share  DECIMAL(18,2)   NULL,
  amount_due      DECIMAL(18,2)   NULL,
  started_at      DATETIME        NULL,
  cycle_ends_at   DATETIME        NULL,
  resolved_at     DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY bot_sessions_user_idx (user_id),
  KEY bot_sessions_account_idx (mt5_account_id),
  KEY bot_sessions_status_idx (status),
  KEY bot_sessions_cycle_idx (cycle_ends_at),
  CONSTRAINT bot_sessions_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT bot_sessions_account_fk FOREIGN KEY (mt5_account_id)
    REFERENCES mt5_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Paiements (part plateforme) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  bot_session_id  BIGINT UNSIGNED NULL,
  amount          DECIMAL(18,2)   NOT NULL DEFAULT 0,
  platform_share  DECIMAL(18,2)   NOT NULL DEFAULT 0,
  currency        VARCHAR(10)     NOT NULL DEFAULT 'USD',
  status          ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  payment_method  VARCHAR(40)     NULL,
  paid_at         DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY payments_user_idx (user_id),
  KEY payments_session_idx (bot_session_id),
  KEY payments_status_idx (status),
  CONSTRAINT payments_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT payments_session_fk FOREIGN KEY (bot_session_id)
    REFERENCES bot_sessions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Parrainage : liens de parrainage ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_referrals (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  referrer_user_id   BIGINT UNSIGNED NOT NULL,
  referred_user_id   BIGINT UNSIGNED NOT NULL,
  referral_code      VARCHAR(32)     NOT NULL,
  status             ENUM('pending','active','cancelled') NOT NULL DEFAULT 'pending',
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_referrals_referred_unique (referred_user_id),
  KEY user_referrals_referrer_idx (referrer_user_id),
  KEY user_referrals_status_idx (status),
  CONSTRAINT user_referrals_referrer_fk FOREIGN KEY (referrer_user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_referrals_referred_fk FOREIGN KEY (referred_user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Parrainage : commissions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_commissions (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  referrer_user_id   BIGINT UNSIGNED NOT NULL,
  referred_user_id   BIGINT UNSIGNED NOT NULL,
  payment_id         BIGINT UNSIGNED NULL,
  amount             DECIMAL(18,2)   NOT NULL DEFAULT 0,
  status             ENUM('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
  paid_at            DATETIME        NULL,
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY referral_commissions_referrer_idx (referrer_user_id),
  KEY referral_commissions_referred_idx (referred_user_id),
  KEY referral_commissions_payment_idx (payment_id),
  KEY referral_commissions_status_idx (status),
  CONSTRAINT referral_commissions_referrer_fk FOREIGN KEY (referrer_user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT referral_commissions_referred_fk FOREIGN KEY (referred_user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT referral_commissions_payment_fk FOREIGN KEY (payment_id)
    REFERENCES payments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Historique des trades copiés ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mt5_trades (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  mt5_account_id BIGINT UNSIGNED NULL,
  ticket         BIGINT          NOT NULL,
  symbol         VARCHAR(40)     NOT NULL,
  trade_type     VARCHAR(10)     NOT NULL,
  volume         DECIMAL(12,2)   NOT NULL DEFAULT 0,
  open_price     DECIMAL(18,5)   NULL,
  close_price    DECIMAL(18,5)   NULL,
  profit         DECIMAL(18,2)   NOT NULL DEFAULT 0,
  commission     DECIMAL(18,2)   NOT NULL DEFAULT 0,
  swap           DECIMAL(18,2)   NOT NULL DEFAULT 0,
  open_time      DATETIME        NULL,
  close_time     DATETIME        NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mt5_trades_user_ticket_unique (user_id, ticket),
  KEY mt5_trades_user_idx (user_id),
  KEY mt5_trades_account_idx (mt5_account_id),
  KEY mt5_trades_close_time_idx (close_time),
  CONSTRAINT mt5_trades_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Journal des e-mails ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  email_type     VARCHAR(60)     NOT NULL,
  status         VARCHAR(20)     NOT NULL,
  error_message  TEXT            NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY email_logs_user_idx (user_id),
  KEY email_logs_type_idx (email_type),
  CONSTRAINT email_logs_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
