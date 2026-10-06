# Sample source manifest

These are **review candidates linked at their official pages**, not downloaded files or approved reusable fixtures. After a rights decision, choose a small varied set and record exact source IDs, observed metadata, parser results, and permission evidence before placing fixtures in `tests/fixtures/`.

| Candidate | Source reference | What to inspect |
| --- | --- | --- |
| FCCP judgment/order | [FCCP judgments listing](https://www.fccp.gov.pk/judgements) — e.g. `C.P.L.A. No.1285-K of 2023` (listed 2026-09-25) | Item type, stable identifier, decision versus upload date, author judge, citation in file, text layer/OCR need, download URL stability. |
| Federal law | [Pakistan Code: National Security Council Act, 2004](https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Npa5tqbg%3D%3D-sg-jjjjjjjjjjjjj) | Embedded file format, act number/date, source status, section structure, Gazette link. |
| Punjab law | [Code of Civil Procedure (Punjab Amendment) Act 2018](https://punjablaws.gov.pk/laws/2706.html) | HTML structure, act number, sections, amendment cross-references, version status. |
| Sindh law | [Sindh Safe Blood Transfusion (Amendment) Act, 2026 PDF](https://www.sindhlaws.gov.pk/Setup/Publications_SindhCode/PUB-NEW-26-000107.pdf) | PDF text layer, publication versus enactment date, act number, section anchors, language variants. |
| KP law | [KP Code law listing](https://kpcode.kp.gov.pk/homepage/list_all_law) — select one act after access/rights review | Stable item URL, dates, title, department, PDF/HTML format, version indicators. |
| Balochistan law | [Balochistan Code example PDF](https://balochistancode.gob.pk/lawdir/c759b758-c471-4644-9f65-9ddf598eff8d.pdf) | PDF text quality, original/adapted law status, act/ordinance number, source publication date. |

For every selected sample, store an audit row with URL, retrieval time, HTTP/content type, hash, source terms decision, observed title and date fields, parser version, extraction confidence, and reviewer verdict. Keep uncertain records out of published search.
