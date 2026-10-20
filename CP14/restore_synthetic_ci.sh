#!/usr/bin/env bash
set -euo pipefail
# CP14 synthetic-only restoration regression. Never accesses owner backup.
PG="jmcc-cp14-synth-$$"
cleanup(){ docker rm -f "$PG" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm --detach --network none --name "$PG" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:18 >/dev/null
for i in $(seq 1 60); do if docker exec --user postgres "$PG" pg_isready -q; then break; fi; sleep 1; done
docker exec --user postgres "$PG" pg_isready -q
docker exec --user postgres "$PG" psql -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE jmcc_donor;'
docker exec --user postgres "$PG" psql -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE jmcc_disposable_restore;'
docker exec --user postgres "$PG" psql -v ON_ERROR_STOP=1 -d jmcc_donor -c "CREATE TABLE contacts (id integer PRIMARY KEY, carrier text NOT NULL); INSERT INTO contacts VALUES (1,'GITHUB'),(2,'GMAIL'),(3,'CLOUD');"
docker exec --user postgres "$PG" pg_dump -Fd -f /tmp/jmcc_synth_dump jmcc_donor
docker exec --user postgres "$PG" tar -czf /tmp/jmcc_synthetic.dir.tar.gz -C /tmp jmcc_synth_dump
docker exec --user postgres "$PG" mkdir -p /tmp/jmcc_synth_restore
docker exec --user postgres "$PG" tar -xzf /tmp/jmcc_synthetic.dir.tar.gz -C /tmp/jmcc_synth_restore
docker exec --user postgres "$PG" pg_restore --list /tmp/jmcc_synth_restore/jmcc_synth_dump >/dev/null
docker exec --user postgres "$PG" pg_restore --format=directory --exit-on-error --no-owner --no-privileges -d jmcc_disposable_restore /tmp/jmcc_synth_restore/jmcc_synth_dump
n=$(docker exec --user postgres "$PG" psql -At -d jmcc_disposable_restore -c 'SELECT count(*) FROM contacts;')
test "$n" = "3"
got=$(docker exec --user postgres "$PG" psql -At -d jmcc_disposable_restore -c "SELECT string_agg(carrier, ',' ORDER BY id) FROM contacts;")
test "$got" = 'GITHUB,GMAIL,CLOUD'
echo "CP14 synthetic PostgreSQL 18 .dir.tar.gz restore: PASS — 3/3 sample rows recovered, isolated no-network container"
