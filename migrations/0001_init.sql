CREATE TABLE requests (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     TEXT NOT NULL DEFAULT (datetime('now')),
  tool   TEXT NOT NULL,
  status TEXT NOT NULL,
  meta   TEXT
);
