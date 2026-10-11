from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.modules.data_factory.custom_schemas import StrictModel, Options, CustomField


def identity(schema: str, name: str) -> str:
    # Always quote both components; a dot inside an identifier is unambiguous.
    return '.'.join('"' + part.replace('"', '""') + '"' for part in (schema, name))


class Check(StrictModel):
    column: str = Field(min_length=1, max_length=63)
    operator: Literal[">", ">=", "<", "<=", "=", "<>"]
    value: float = Field(ge=-1e9, le=1e9)


class Column(StrictModel):
    name: str = Field(min_length=1, max_length=63)
    database_type: Literal["integer", "bigint", "smallint", "varchar", "char", "text", "boolean", "date", "timestamp", "timestamptz", "uuid", "numeric", "decimal", "real", "double precision", "serial", "bigserial", "enum"]
    type_arguments: list[int] = Field(default_factory=list, max_length=2)
    enum_values: list[str] = Field(default_factory=list, max_length=500)
    enum_name: str | None = Field(default=None, max_length=260)
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    default: str | None = Field(default=None, max_length=4096)
    synthetic_generator: str = Field(default="string", max_length=40)
    generator_options: Options = Field(default_factory=Options)

    @model_validator(mode="after")
    def validate_column(self):
        if len(self.name.encode("utf-8")) > 63 or "\x00" in self.name:
            raise ValueError("Column identifiers must be at most 63 UTF-8 bytes without NUL")
        CustomField(name="value", type=self.synthetic_generator, options=self.generator_options)
        args = self.type_arguments
        if args and self.database_type not in {"varchar", "char", "numeric", "decimal", "timestamp", "timestamptz"}:
            raise ValueError("Type does not accept parameters")
        if self.database_type in {"varchar", "char"} and (len(args) > 1 or (args and not 1 <= args[0] <= 10485760)):
            raise ValueError("Invalid character length")
        if self.database_type in {"numeric", "decimal"} and args and (not 1 <= args[0] <= 1000 or (len(args) == 2 and not 0 <= args[1] <= args[0])):
            raise ValueError("Supported numeric precision is 1..1000, scale 0..precision")
        if self.database_type in {"timestamp", "timestamptz"} and (len(args) > 1 or (args and not 0 <= args[0] <= 6)):
            raise ValueError("Timestamp precision must be 0..6")
        if self.database_type == "enum" and (not self.enum_name or not self.enum_values or len(set(self.enum_values)) != len(self.enum_values) or any(len(v) > 256 or "\x00" in v for v in self.enum_values)):
            raise ValueError("Invalid enum domain")
        return self


class ForeignKey(StrictModel):
    source_columns: list[str] = Field(min_length=1, max_length=50)
    target_table: str = Field(min_length=1, max_length=260)
    target_columns: list[str] = Field(min_length=1, max_length=50)
    on_delete: Literal["NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"] = "NO ACTION"
    on_update: Literal["NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"] = "NO ACTION"


class Table(StrictModel):
    name: str = Field(min_length=1, max_length=63)
    schema_name: str = Field(default="public", min_length=1, max_length=63)
    columns: list[Column] = Field(min_length=1, max_length=50)
    primary_key: list[str] = Field(default_factory=list, max_length=50)
    unique_constraints: list[list[str]] = Field(default_factory=list, max_length=50)
    foreign_keys: list[ForeignKey] = Field(default_factory=list, max_length=50)
    checks: list[Check] = Field(default_factory=list, max_length=50)
    selected: bool = True
    row_count: int = Field(default=100, ge=0, le=1000, strict=True)

    @property
    def key(self):
        return identity(self.schema_name, self.name)

    @model_validator(mode="after")
    def structure(self):
        if any(len(part.encode("utf-8")) > 63 or "\x00" in part for part in (self.name, self.schema_name)):
            raise ValueError("Table identifiers must be at most 63 UTF-8 bytes without NUL")
        names = [c.name for c in self.columns]
        if len(set(names)) != len(names):
            raise ValueError("Duplicate column names")
        for group in ([self.primary_key] if self.primary_key else []) + self.unique_constraints + [f.source_columns for f in self.foreign_keys]:
            if not group or len(group) > 50 or len(set(group)) != len(group) or not set(group) <= set(names):
                raise ValueError("Invalid key column group")
        if any(check.column not in names for check in self.checks):
            raise ValueError("Unknown CHECK column")
        for column in self.columns:
            column.primary_key = column.name in self.primary_key
            column.unique = [column.name] in self.unique_constraints
            if column.primary_key:
                column.nullable = False
        return self


class DatabaseSchema(StrictModel):
    id: UUID | None = None
    name: str = Field(default="Imported database", min_length=1, max_length=100)
    version: Literal[1] = 1
    dialect: Literal["postgresql"] = "postgresql"
    tables: list[Table] = Field(min_length=1, max_length=20)
    warnings: list[str] = Field(default_factory=list, max_length=2000)
    seed: int = Field(default=42, ge=0, le=9007199254740991, strict=True)

    @model_validator(mode="after")
    def structure(self):
        if not self.name.strip():
            raise ValueError("Schema name cannot be blank")
        if len({t.key for t in self.tables}) != len(self.tables):
            raise ValueError("Duplicate table identity")
        if any(len(w) > 4096 for w in self.warnings):
            raise ValueError("Warning exceeds length limit")
        return self


class ParseRequest(StrictModel):
    sql: str = Field(min_length=1, max_length=262144)
    name: str = Field(default="Imported database", min_length=1, max_length=100)


class Dataset(StrictModel):
    name: str
    seed: int
    total_records: int
    order: list[str]
    tables: dict[str, list[dict[str, str | int | float | bool | None]]]
    fields: dict[str, list[str]]
    relationships: list[dict]


class ValidationResult(StrictModel):
    valid: bool = True
    message: str = "Schema and generation constraints are valid."
    order: list[str]
