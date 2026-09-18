# Drop the server dump here

Put the production dump in this folder as a `.sql` file, then start the
database. Anything here is imported on the **first** start of the container,
in filename order.

```bash
docker compose -f infra/docker-compose.yml up -d
```

Already started once and need to reimport?

```bash
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d
```

`down -v` deletes the database volume — that is the point, but it is not
recoverable.

## Where the dump comes from

`servidor/start.sh` already writes one on every server restart:

```
mysqldump -u root -p<pass> poke > backups/$(date '+%Y-%m-%d_%H-%M').sql
```

Note that script dumps a database named `poke`, while `servidor/config.lua`
points at `poke2`. Check which one the live server actually uses before
copying, and rename on import if they differ.

## Why a generic TFS schema will not work

This is a fork. Beyond the standard tables, the C++ and Lua layers query
fork-specific ones that no upstream `schema.sql` contains — see
`docs/database-tables.md` for the full inventory.
