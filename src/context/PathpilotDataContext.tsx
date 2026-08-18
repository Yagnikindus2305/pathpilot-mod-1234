import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchColleges, fetchCourses, fetchRoles, type GroupedOptions } from '@/lib/api';
import { getCollegeOptionsGrouped, getRoleOptionsGrouped, getCourseOptionsGrouped, getCourseYears } from '@/lib/pathpilot';

interface PathpilotDataValue {
  collegeGroups: GroupedOptions;
  roleGroups: GroupedOptions;
  courseGroups: GroupedOptions;
  courseYears: string[];
  loading: boolean;
}

const PathpilotDataContext = createContext<PathpilotDataValue | undefined>(undefined);

export function PathpilotDataProvider({ children }: { children: ReactNode }) {
  const [collegeGroups, setCollegeGroups] = useState<GroupedOptions>(() => getCollegeOptionsGrouped());
  const [roleGroups, setRoleGroups] = useState<GroupedOptions>(() => getRoleOptionsGrouped());
  const [courseGroups, setCourseGroups] = useState<GroupedOptions>(() => getCourseOptionsGrouped());
  const [courseYears, setCourseYears] = useState<string[]>(() => getCourseYears());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchColleges().catch(() => null), fetchCourses().catch(() => null), fetchRoles().catch(() => null)]).then(
      ([colleges, courses, roles]) => {
        if (cancelled) return;
        if (colleges) setCollegeGroups(colleges.grouped);
        if (courses) {
          setCourseGroups(courses.grouped);
          if (courses.years.length) setCourseYears(courses.years);
        }
        if (roles) setRoleGroups(roles.grouped);
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PathpilotDataContext.Provider value={{ collegeGroups, roleGroups, courseGroups, courseYears, loading }}>
      {children}
    </PathpilotDataContext.Provider>
  );
}

export function usePathpilotData() {
  const ctx = useContext(PathpilotDataContext);
  if (!ctx) throw new Error('usePathpilotData must be used within PathpilotDataProvider');
  return ctx;
}
