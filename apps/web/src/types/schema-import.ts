import type { CustomField } from "./custom-dataset";

export type SchemaColumn = {
  name: string; database_type: string; type_arguments: number[]; enum_values: string[];
  enum_name: string | null;
  nullable: boolean; primary_key: boolean; unique: boolean; default: string | null;
  synthetic_generator: string; generator_options: CustomField["options"];
};
export type ForeignKey = {
  source_columns: string[]; target_table: string; target_columns: string[];
  on_delete: string; on_update: string;
};
export type SchemaTable = {
  name: string; schema_name: string; columns: SchemaColumn[]; primary_key: string[];
  unique_constraints: string[][]; foreign_keys: ForeignKey[];
  checks: { column: string; operator: string; value: number }[];
  selected: boolean; row_count: number;
};
export type DatabaseSchema = {
  id: string | null; name: string; version: 1; dialect: "postgresql";
  tables: SchemaTable[]; warnings: string[]; seed: number;
};
export type SchemaDataset = {
  name: string; seed: number; total_records: number; order: string[];
  tables: Record<string, Record<string, string | number | boolean | null>[]>;
  fields: Record<string, string[]>;
  relationships: (ForeignKey & { source_table: string })[];
};
export function tableKey(table: SchemaTable) {
  return [table.schema_name, table.name].map(s => `"${s.replaceAll('"', '""')}"`).join(".");
}

export const exampleSQL = `CREATE TABLE public.students (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  birth_date DATE
);

CREATE TABLE public.enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id),
  school_year VARCHAR(9) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1)
);`;
