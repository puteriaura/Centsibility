-- New forward migration; adds only selected catalogue rows, no money or Fund changes.
-- Evidence: SPUS official holdings dated 2026-10-09, https://www.sp-funds.com/spus/.
-- All eight symbols were present in Twelve Data's public US stock reference list on 2026-10-09.
-- Reference coverage does not establish quote entitlement or permanent screening status.
insert into public.market_symbols (symbol, name, kind, halal_source, halal_checked_on, active)
select symbol, name, 'stock', symbol || ' included in SPUS holdings dated 9 October 2026; holdings can change; https://www.sp-funds.com/spus/', date '2026-10-09', true
from (values
 ('SNDK', 'Sandisk Corp.'), ('IBM', 'International Business Machines Corporation'),
 ('ORCL', 'Oracle Corporation'), ('LIN', 'Linde plc'),
 ('QCOM', 'QUALCOMM Incorporated'), ('ADBE', 'Adobe Inc.'),
 ('TXN', 'Texas Instruments Inc.'), ('ISRG', 'Intuitive Surgical Inc.')
) as additions(symbol, name)
on conflict (symbol) do update set name = excluded.name, kind = excluded.kind,
 halal_source = excluded.halal_source, halal_checked_on = excluded.halal_checked_on,
 active = excluded.active;
