-- ANCIENFX / MetaApi — Migration 002
-- Ajoute le support MetaApi (remplacement du bridge Python) et CopyFactory.
-- Exécutée une seule fois (suivi via schema_migrations).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ── Comptes MT4/MT5 : lien vers MetaApi + état de copie ──────────────────────
ALTER TABLE mt5_accounts
  ADD COLUMN metaapi_account_id VARCHAR(64) NULL AFTER user_id,
  ADD COLUMN platform           VARCHAR(8)  NOT NULL DEFAULT 'mt5' AFTER server,
  ADD COLUMN copy_subscribed    TINYINT(1)  NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE mt5_accounts
  ADD KEY mt5_accounts_metaapi_idx (metaapi_account_id);

-- ── Paramètres globaux de la plateforme (clé/valeur) ─────────────────────────
-- Sert notamment à stocker la configuration du compte maître CopyFactory :
--   master_metaapi_account_id, master_strategy_id, master_login, master_server, etc.
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(80)  NOT NULL,
  setting_value TEXT         NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Droits admin ─────────────────────────────────────────────────────────────
-- Un simple flag sur users pour autoriser l'accès à la page admin.
ALTER TABLE users
  ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
