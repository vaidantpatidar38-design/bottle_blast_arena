/*
# Create leaderboard table

Single-tenant (no auth) leaderboard for PitchPop game.

1. New Tables
- `leaderboard`
  - `id` (uuid, primary key)
  - `name` (text, player name, max 30 chars)
  - `score` (integer, game score)
  - `created_at` (timestamp)

2. Security
- Enable RLS on `leaderboard`.
- anon + authenticated can SELECT and INSERT (public leaderboard, no auth required).
- No UPDATE or DELETE allowed (scores are immutable once submitted).
*/

CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  score integer NOT NULL CHECK (score >= 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_leaderboard" ON leaderboard;
CREATE POLICY "anon_select_leaderboard" ON leaderboard FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_leaderboard" ON leaderboard;
CREATE POLICY "anon_insert_leaderboard" ON leaderboard FOR INSERT
  TO anon, authenticated WITH CHECK (true);
