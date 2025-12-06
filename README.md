## Run Migrations (local)

```sh
DATABASE_URL="postgres://postgres:postgres@localhost:5432/main"
npm run db:generate
```

```sh
DATABASE_URL="postgres://postgres:postgres@localhost:5432/main" npm run db:migrate
npm run db:migrate
```

```sh
psql -h db.localtest.me -U postgres -d main
```
