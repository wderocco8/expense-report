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

Start MinIO
docker compose -d # -d is used to run in "detached" mode without taking over the terminal

If successfuly, you’ll see a message that looks like the following:

~ docker compose up -d
[+] Running 2/2
✔ Network zap_default Created 0.0s
✔ Container minio Started

Add MinIO server to mc
This command only needs to be run once when using MinIO for the WhyPhi.

mc alias set local http://localhost:9000 minio minio123

Create Bucket and Add Permissions
Run these commands to create the bucket and allow public access to the bucket

mc mb local/expense-report-files # create bucket
mc anonymous set download local/expense-report-files # set permissions

View MinIO Data
To view your locally emulated data, MinIO offers a dashboard that can be found here:

http://localhost:9001

Use the MINIO_ROOT_USER and MINIO_ROOT_PASSWORD found in zap/docker-compose.yml to login.
