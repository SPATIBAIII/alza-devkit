export interface Household {
  household_id: string;
  household_head: string;
  barangay: string;
  household_size: number;
  monthly_income: number;
  income_category: "Low" | "Middle" | "High";
}

export interface GenerationConfig { count: number; seed: number }
export type ExportFormat = "csv" | "json" | "xlsx";

export interface HouseholdDataset {
  success: true;
  dataset: "households";
  total_records: number;
  seed: number;
  synthetic: true;
  data: Household[];
}
