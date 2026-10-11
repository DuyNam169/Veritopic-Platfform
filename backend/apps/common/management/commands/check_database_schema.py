from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Check application tables, column types/nullability, and declared constraints against Django models."

    def handle(self, *args, **options):
        issues = []
        models = [model for app in ("academics", "accounts", "topics", "progress") for model in apps.get_app_config(app).get_models(include_auto_created=True)]
        aliases = {"varchar": "character varying", "timestamp with time zone": "timestamp with time zone"}

        def canonical(value):
            for old, new in aliases.items():
                value = value.replace(old, new)
            return value

        with connection.cursor() as cursor:
            tables = set(connection.introspection.table_names(cursor))
            for model in models:
                table = model._meta.db_table
                if table not in tables:
                    issues.append(f"Missing table: {table}")
                    continue
                cursor.execute("SELECT a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull FROM pg_attribute a WHERE a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped", [table])
                columns = {name: (data_type, not_null) for name, data_type, not_null in cursor.fetchall()}
                for field in model._meta.local_fields:
                    actual = columns.get(field.column)
                    if not actual:
                        issues.append(f"Missing column: {table}.{field.column}")
                        continue
                    expected_type = field.db_type(connection)
                    if expected_type and canonical(actual[0]) != canonical(expected_type):
                        issues.append(f"Type mismatch: {table}.{field.column}: {actual[0]} != {expected_type}")
                    if actual[1] != (not field.null):
                        issues.append(f"Nullability mismatch: {table}.{field.column}")
                constraints = connection.introspection.get_constraints(cursor, table)
                for constraint in model._meta.constraints:
                    if constraint.name not in constraints:
                        issues.append(f"Missing constraint: {table}.{constraint.name}")
                for field in model._meta.local_fields:
                    if field.many_to_one and field.db_constraint:
                        expected = (field.remote_field.model._meta.db_table, field.target_field.column)
                        if not any(c.get("foreign_key") == expected and c.get("columns") == [field.column] for c in constraints.values()):
                            issues.append(f"Missing foreign key: {table}.{field.column}")
        if issues:
            raise CommandError("\n".join(issues))
        self.stdout.write(self.style.SUCCESS(f"Schema matches Django models: {len(models)} application tables checked."))
