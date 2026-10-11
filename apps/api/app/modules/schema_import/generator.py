"""Bounded, seeded generation with tuple-level relational integrity."""
import json
import math
import operator
import random
import struct
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from faker import Faker

from app.modules.data_factory.custom_generator import Context
from app.modules.data_factory.custom_schemas import CustomField
from app.modules.data_factory.field_registry import REGISTRY, INTEGER, NUMERIC, SEQUENCES
from .models import DatabaseSchema, Dataset

INTEGERS = {"smallint", "integer", "bigint", "serial", "bigserial"}
NUMBERS = INTEGERS | {"numeric", "decimal", "real", "double precision"}
COMPARISONS = {">": operator.gt, ">=": operator.ge, "<": operator.lt, "<=": operator.le, "=": operator.eq, "<>": operator.ne}


def compatible(a, b):
    if a.database_type == "enum" or b.database_type == "enum":
        return a.database_type == b.database_type and a.enum_name == b.enum_name and a.enum_values == b.enum_values
    return a.database_type == b.database_type or {a.database_type, b.database_type} <= NUMBERS or {a.database_type, b.database_type} <= {"char", "varchar", "text"}


def dependency_order(schema):
    tables = {t.key: t for t in schema.tables}
    selected = {k: t for k, t in tables.items() if t.selected}
    if not selected:
        raise ValueError("Select at least one table")
    if sum(t.row_count for t in selected.values()) > 5000:
        raise ValueError("Maximum 5,000 total records")
    for table in tables.values():
        columns = {c.name: c for c in table.columns}
        for check in table.checks:
            if columns[check.column].database_type not in NUMBERS:
                raise ValueError(f"{table.key}: CHECK comparisons require a numeric column")
        used = set()
        for fk in table.foreign_keys:
            parent = tables.get(fk.target_table)
            if parent is None:
                raise ValueError(f"{table.key}: foreign key references missing table {fk.target_table}")
            if len(fk.source_columns) != len(fk.target_columns) or len(set(fk.target_columns)) != len(fk.target_columns):
                raise ValueError("Foreign-key groups must have equal lengths and distinct columns")
            targets = {c.name: c for c in parent.columns}
            if not set(fk.target_columns) <= targets.keys():
                raise ValueError("Foreign key references an unknown column")
            if fk.target_columns not in ([parent.primary_key] if parent.primary_key else []) + parent.unique_constraints:
                raise ValueError("Foreign keys must reference a declared primary or unique key in its declared order")
            if any(not compatible(columns[s], targets[t]) for s, t in zip(fk.source_columns, fk.target_columns)):
                raise ValueError("Foreign-key column types are incompatible")
            if used.intersection(fk.source_columns):
                raise ValueError("Overlapping foreign keys are unsupported; split or remove the overlapping relationship")
            used.update(fk.source_columns)
            if table.key in selected and fk.target_table not in selected:
                raise ValueError(f"Select parent table {fk.target_table} required by {table.key}")
            if table.key in selected and table.row_count and not parent.row_count:
                raise ValueError(f"Parent {parent.key} needs at least one record")
    ordered, visiting, done = [], set(), set()

    def visit(key):
        if key in visiting:
            raise ValueError(f"Cyclic or self-referencing relationship at {key}; remove the cycle or deselect its tables")
        if key in done:
            return
        visiting.add(key)
        for fk in selected[key].foreign_keys:
            visit(fk.target_table)
        visiting.remove(key)
        done.add(key)
        ordered.append(key)

    for key in selected:
        visit(key)
    return ordered


def sql_value(column, value):
    """Validate actual output against SQL domains even after FK assignment/overrides."""
    kind = column.database_type
    if value is None:
        return column.nullable
    if kind in NUMBERS:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            return False
        if kind in INTEGERS:
            bounds = (-32768, 32767) if kind == "smallint" else (-2147483648, 2147483647) if kind in {"integer", "serial"} else (-9223372036854775808, 9223372036854775807)
            return int(value) == value and bounds[0] <= value <= bounds[1]
        if kind in {"numeric", "decimal"} and column.type_arguments:
            precision = column.type_arguments[0]
            scale = column.type_arguments[1] if len(column.type_arguments) == 2 else 0
            decimal = Decimal(str(value)).normalize()
            return max(0, -decimal.as_tuple().exponent) <= scale and abs(decimal) < Decimal(10) ** (precision - scale)
        return True
    if kind == "boolean":
        return isinstance(value, bool)
    if not isinstance(value, str) or len(value) > 1024 or "\x00" in value:
        return False
    if kind in {"char", "varchar"}:
        maximum = column.type_arguments[0] if column.type_arguments else 1 if kind == "char" else None
        return maximum is None or len(value) <= maximum
    if kind == "enum":
        return value in column.enum_values
    try:
        if kind == "uuid":
            UUID(value)
        elif kind == "date":
            date.fromisoformat(value)
        elif kind in {"timestamp", "timestamptz"}:
            datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return False
    return True


def key_tuple(table, row, group):
    columns = {c.name: c for c in table.columns}
    values = []
    for name in group:
        value, column = row[name], columns[name]
        if value is not None:
            if column.database_type == "char":
                value = value.rstrip(" ")
            elif column.database_type == "uuid":
                value = str(UUID(value))
            elif column.database_type == "date":
                value = date.fromisoformat(value).isoformat()
            elif column.database_type in {"timestamp", "timestamptz"}:
                parsed = datetime.fromisoformat(value)
                if column.database_type == "timestamptz":
                    parsed = parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
                else:
                    parsed = parsed.replace(tzinfo=None)
                value = parsed.isoformat()
            elif column.database_type == "real":
                value = struct.unpack("f", struct.pack("f", value))[0]
        values.append(value)
    return tuple(values)


def generate(schema):
    if not isinstance(schema, DatabaseSchema):
        schema = DatabaseSchema.model_validate(schema)
    order = dependency_order(schema)
    by_key = {t.key: t for t in schema.tables}
    rng = random.Random(schema.seed)
    faker = Faker("en_US")
    faker.seed_instance(schema.seed)
    ctx = Context(rng, faker, faker)
    result, fields, attempts, output_bytes, cell_attempts = {}, {}, 0, 0, 0
    for key in order:
        table = by_key[key]
        fields[key] = [c.name for c in table.columns]
        constraints = ([table.primary_key] if table.primary_key else []) + table.unique_constraints
        seen = [set() for _ in constraints]
        mapped = {c.name: CustomField(name="value", type=c.synthetic_generator, options=c.generator_options) for c in table.columns}
        fk_columns = {c for fk in table.foreign_keys for c in fk.source_columns}
        pools = []
        for fk in table.foreign_keys:
            pool = [tuple(row[c] for c in fk.target_columns) for row in result[fk.target_table] if all(row[c] is not None for c in fk.target_columns)]
            if not pool and table.row_count:
                raise ValueError(f"{key}: no non-null parent keys available")
            if any(set(group) <= set(fk.source_columns) for group in constraints) and table.row_count > len(set(pool)):
                raise ValueError(f"{key}: requested rows exceed unique foreign-key capacity ({len(set(pool))})")
            rng.shuffle(pool)
            pools.append(pool)
        for group in constraints:
            capacity = 1
            for name in group:
                if name in fk_columns:
                    capacity = None
                    break
                domain = REGISTRY[mapped[name].type].domain(mapped[name])
                if domain is None:
                    capacity = None
                    break
                capacity *= domain
            if capacity is not None and table.row_count > capacity:
                raise ValueError(f"{key}: requested rows exceed unique domain capacity ({capacity})")
        rows = []
        for index in range(table.row_count):
            for retry in range(2000):
                attempts += 1
                cell_attempts += len(table.columns)
                if cell_attempts > 500000:
                    raise ValueError("Generation exceeded the 500,000 field attempt budget; adjust mappings or constraints")
                if attempts > 150000:
                    raise ValueError("Generation exceeded the 150,000 row attempt budget; adjust mappings or constraints")
                row = {}
                for column in table.columns:
                    field = mapped[column.name]
                    if column.name in fk_columns:
                        continue
                    value = REGISTRY[field.type].generate(ctx, field, index)
                    if column.database_type in NUMBERS and field.type in SEQUENCES:
                        if field.options.prefix or field.options.suffix:
                            raise ValueError(f"{key}.{column.name}: numeric sequences cannot have prefixes or suffixes")
                        value = int(value)
                    if column.database_type == "timestamptz" and field.type == "datetime":
                        value += "+00:00"
                    row[column.name] = value
                for fk, pool in zip(table.foreign_keys, pools):
                    # Cycling shuffled keys handles one-to-one capacity without coupon-collector failures.
                    values = pool[index % len(pool)] if retry == 0 else rng.choice(pool)
                    row.update(zip(fk.source_columns, values))
                if any(not sql_value(c, row[c.name]) for c in table.columns):
                    if retry == 1999:
                        raise ValueError(f"{key}: mapping cannot satisfy SQL type, length, enum or nullability constraints")
                    continue
                if any(row[c.column] is not None and not COMPARISONS[c.operator](row[c.column], c.value) for c in table.checks):
                    continue
                tuples = [key_tuple(table, row, group) for group in constraints]
                if any(None not in values and values in used for values, used in zip(tuples, seen)):
                    continue
                for values, used in zip(tuples, seen):
                    if None not in values:
                        used.add(values)
                row = {c: row[c] for c in fields[key]}
                output_bytes += len(json.dumps(row, ensure_ascii=False).encode("utf-8"))
                if output_bytes > 10_000_000:
                    raise ValueError("Dataset exceeds 10 MB output limit")
                rows.append(row)
                break
            else:
                raise ValueError(f"{key}: cannot satisfy unique keys or CHECK constraints within 2,000 attempts per row; adjust mappings or row counts")
        result[key] = rows
    return Dataset(name=schema.name, seed=schema.seed, total_records=sum(len(rows) for rows in result.values()), order=order, tables=result, fields=fields,
                   relationships=[dict(source_table=t.key, **fk.model_dump()) for t in schema.tables if t.selected for fk in t.foreign_keys])
