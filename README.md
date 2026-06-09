# darandha-eidgah-committee
islamic

## Push notifications

Browser push notifications require VAPID keys on the backend:

```bash
npx web-push generate-vapid-keys
```

Set these environment variables on the API host:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (optional, for example `mailto:info@darandhaeidgah.org`)
