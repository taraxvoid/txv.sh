-- Short links, managed with `bun run links`. A script in sh/ wins over a
-- link of the same name, and the CLI refuses to create one.
CREATE TABLE links (
    slug TEXT PRIMARY KEY NOT NULL,
    destination_url TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    click_count INTEGER NOT NULL DEFAULT 0,
    last_clicked_at TEXT
);
