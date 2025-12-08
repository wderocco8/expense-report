## Run Migrations (local)

```sh
npm run db:generate
```

```sh
DATABASE_URL="postgres://postgres:postgres@localhost:5432/main"
npm run db:migrate
```

```sh
docker exec -it expense-report-postgres-1 psql -U postgres -d postgres
# OR
psql -h db.localtest.me -U postgres -d main
```
