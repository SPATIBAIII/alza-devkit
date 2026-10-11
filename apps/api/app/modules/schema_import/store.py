"""Versioned configurations in a separate table within the existing SQLite store."""
from contextlib import contextmanager
from uuid import uuid4

from app.modules.data_factory.template_store import TemplateStore
from .models import DatabaseSchema


class SchemaStore(TemplateStore):
    @contextmanager
    def connection(self):
        with super().connection() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS imported_schemas (id TEXT PRIMARY KEY, definition TEXT NOT NULL)")
            yield conn

    def list(self):
        with self.connection() as conn:
            return [DatabaseSchema.model_validate_json(row[0]) for row in conn.execute("SELECT definition FROM imported_schemas ORDER BY rowid DESC")]

    def get(self, id):
        with self.connection() as conn:
            row = conn.execute("SELECT definition FROM imported_schemas WHERE id = ?", (str(id),)).fetchone()
        if row is None:
            raise KeyError(id)
        return DatabaseSchema.model_validate_json(row[0])

    def create(self, schema):
        saved = schema.model_copy(update={"id": uuid4()})
        with self.connection() as conn:
            conn.execute("INSERT INTO imported_schemas VALUES (?, ?)", (str(saved.id), saved.model_dump_json()))
        return saved

    def update(self, id, schema):
        saved = schema.model_copy(update={"id": id})
        with self.connection() as conn:
            if not conn.execute("UPDATE imported_schemas SET definition = ? WHERE id = ?", (saved.model_dump_json(), str(id))).rowcount:
                raise KeyError(id)
        return saved

    def delete(self, id):
        with self.connection() as conn:
            if not conn.execute("DELETE FROM imported_schemas WHERE id = ?", (str(id),)).rowcount:
                raise KeyError(id)
