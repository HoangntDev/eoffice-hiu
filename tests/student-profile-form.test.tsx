// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudentProfileForm } from "@/components/student-profile-form";

const catalog = [
  {
    class_id: "class-a-2025",
    class_code: "A25",
    class_name: "A25",
    cohort_id: "cohort-2025",
    cohort_code: "DHCQK2025",
    cohort_name: "DHCQK2025",
    program_id: "program-a",
    program_name: "Ngành A",
    faculty_id: "faculty-a",
    faculty_name: "Khoa A",
  },
  {
    class_id: "class-a-2026",
    class_code: "A26",
    class_name: "A26",
    cohort_id: "cohort-2026",
    cohort_code: "DHCQK2026",
    cohort_name: "DHCQK2026",
    program_id: "program-a",
    program_name: "Ngành A",
    faculty_id: "faculty-a",
    faculty_name: "Khoa A",
  },
  {
    class_id: "class-b-2026",
    class_code: "B26",
    class_name: "B26",
    cohort_id: "cohort-2026",
    cohort_code: "DHCQK2026",
    cohort_name: "DHCQK2026",
    program_id: "program-b",
    program_name: "Ngành B",
    faculty_id: "faculty-b",
    faculty_name: "Khoa B",
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StudentProfileForm academic catalog cascade", () => {
  it("filters Khoa → Ngành → Khóa → Lớp and clears child selections", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/catalog")) {
        return Promise.resolve({ status: 200, ok: true, json: async () => ({ catalog }) });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: async () => ({
          profile: null,
          account: { student_code: "0123456789" },
          email: { email: "student@gmail.com", verified_at: "2026-10-02T00:00:00Z" },
        }),
      });
    }));

    render(<StudentProfileForm />);
    const faculty = await screen.findByLabelText("Khoa") as HTMLSelectElement;
    const program = screen.getByLabelText("Ngành") as HTMLSelectElement;
    const cohort = screen.getByLabelText("Khóa") as HTMLSelectElement;
    const studentClass = screen.getByLabelText("Lớp") as HTMLSelectElement;

    fireEvent.change(faculty, { target: { value: "faculty-a" } });
    expect([...program.options].map((option) => option.text)).toContain("Ngành A");
    expect([...program.options].map((option) => option.text)).not.toContain("Ngành B");

    fireEvent.change(program, { target: { value: "program-a" } });
    expect([...cohort.options].map((option) => option.text)).toEqual([
      "Chọn Khóa",
      "DHCQK2025",
      "DHCQK2026",
    ]);
    fireEvent.change(cohort, { target: { value: "cohort-2025" } });
    expect([...studentClass.options].map((option) => option.text)).toEqual([
      "Chọn Lớp",
      "A25 — A25",
    ]);

    fireEvent.change(faculty, { target: { value: "faculty-b" } });
    await waitFor(() => expect(program.value).toBe(""));
    expect(cohort.value).toBe("");
    expect(studentClass.value).toBe("");
    expect([...program.options].map((option) => option.text)).toContain("Ngành B");
    expect([...program.options].map((option) => option.text)).not.toContain("Ngành A");
  });
});
