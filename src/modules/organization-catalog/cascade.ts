export type AcademicCatalogRow = {
  class_id: string;
  class_code: string;
  class_name: string;
  cohort_id: string;
  cohort_code: string;
  cohort_name: string;
  program_id: string;
  program_name: string;
  faculty_id: string;
  faculty_name: string;
};

function uniqueBy<T>(items: T[], keyOf: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [keyOf(item), item])).values());
}

export function getFacultyOptions(catalog: AcademicCatalogRow[]) {
  return uniqueBy(catalog, (row) => row.faculty_id);
}

export function getProgramOptions(catalog: AcademicCatalogRow[], facultyId: string) {
  return uniqueBy(
    catalog.filter((row) => row.faculty_id === facultyId),
    (row) => row.program_id,
  );
}

export function getCohortOptions(
  catalog: AcademicCatalogRow[],
  facultyId: string,
  programId: string,
) {
  return uniqueBy(
    catalog.filter((row) => row.faculty_id === facultyId && row.program_id === programId),
    (row) => row.cohort_id,
  );
}

export function getClassOptions(
  catalog: AcademicCatalogRow[],
  facultyId: string,
  programId: string,
  cohortId: string,
) {
  return catalog.filter((row) => (
    row.faculty_id === facultyId
    && row.program_id === programId
    && row.cohort_id === cohortId
  ));
}
