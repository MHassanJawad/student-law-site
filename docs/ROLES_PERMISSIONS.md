# Roles and permissions

| Action | Anonymous | Student account | Content operator | Ingestion worker |
| --- | --- | --- | --- | --- |
| Search/read published legal and editorial records | Yes | Yes | Yes | Internal read |
| Save/read/edit/delete own citations | No | Own rows only | Own rows only | No |
| Read another user's saved citations | No | No | No | No |
| Draft/review/publish editorial records | No | No | Yes | No |
| Review quarantined imports and view run history | No | No | Yes | Write run history |
| Fetch, stage, and propose source records | No | No | No | Yes |
| Override source rights status or bulk-publication gate | No | No | Owner decision recorded by operator | No |

Supabase Auth supplies identity; `profiles.role` is server-managed and defaults to `student`. Do not accept role values from client input. Row-level security restricts saved citations to `auth.uid() = owner_id`; route handlers repeat ownership checks. Service-role credentials stay in the worker/server environment and never enter a browser bundle. Operator actions record actor, target, timestamp, and reason.
