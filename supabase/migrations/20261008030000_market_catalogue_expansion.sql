-- Forward-only catalogue expansion. No Fund schema or engine changes.
-- Evidence: https://www.sp-funds.com/SPUS/ holdings dated 2026-10-07,
-- reviewed 2026-10-08. Membership is dated screening evidence, not permanent certification.
insert into public.market_symbols (symbol, name, kind, halal_source, halal_checked_on, active)
select symbol, name, 'stock', symbol || ' included in SPUS holdings dated 7 October 2026; holdings can change; https://www.sp-funds.com/SPUS/', date '2026-10-07', true
from (values
 ('AVGO', 'Broadcom Inc.'), ('MU', 'Micron Technology Inc.'),
 ('AMD', 'Advanced Micro Devices Inc.'), ('LLY', 'Eli Lilly and Company'),
 ('XOM', 'Exxon Mobil Corporation'), ('JNJ', 'Johnson & Johnson'),
 ('ABBV', 'AbbVie Inc.'), ('CSCO', 'Cisco Systems Inc.'),
 ('AMAT', 'Applied Materials Inc.'), ('LRCX', 'Lam Research Corporation'),
 ('MRK', 'Merck & Co. Inc.'), ('PG', 'Procter & Gamble Company'),
 ('PANW', 'Palo Alto Networks Inc.'), ('HD', 'The Home Depot Inc.'),
 ('CRWD', 'CrowdStrike Holdings Inc.')
) as additions(symbol, name)
on conflict (symbol) do update set name = excluded.name, kind = excluded.kind,
 halal_source = excluded.halal_source, halal_checked_on = excluded.halal_checked_on,
 active = excluded.active;
