-- マッチモードを入れるための DB 変更。
-- 学習の記録の「どの形式で学んだか」（method）に、match（マッチ）も書けるようにする。
-- 記録を保存する関数（record_study_session）は、受け取った形式をそのまま書くだけなので、変えなくてよい。
-- 何度実行しても壊れないように、いったん決まりを外してから付け直す。

alter table public.study_sessions drop constraint if exists study_sessions_method_check;
alter table public.study_sessions
  add constraint study_sessions_method_check check (method in ('typing', 'choice', 'match'));
