import { useCallback, useMemo } from "react";
import { useCoursesData, useCoursesActions } from "./CoursesContext";
import { useTasksData, useTasksActions, type Task } from "./TasksContext";
import { useCategoriesData, useCategoriesActions, topLevel } from "./TaskCategoriesContext";
import {
  SEMESTER_COURSES, FIRST_WEEK, courseByKey, courseRef, taskDueDate, taskTitle,
  trackerTableId, weekRowId,
  type CourseKey, type TrackerItemKey,
} from "./semester";

export type Progress = { done: number; total: number };

/** Subcategories created by "Make a task" this session, keyed by course — so a
 *  second click before the categories state has caught up doesn't mint a twin. */
const createdCategory = new Map<CourseKey, string>();

/**
 * The semester tracker's one source of truth for "is this done?".
 *
 * A cell counts as done when it is ticked OR when the task made from it has
 * been completed — so finishing "Structural week 4 flashcards" on the Tasks
 * screen fills the ring without a second tick. This is a derivation at read
 * time, not a write: nothing stamps the courses table when a task completes,
 * which keeps the clock-and-other-rows class of sync bug (CLAUDE.md, 08-15)
 * out of it entirely.
 */
export function useSemesterTracker() {
  const { tables } = useCoursesData();
  const { setTrackerCell } = useCoursesActions();
  const { tasks } = useTasksData();
  const { addTask, updateTask, toggleTask } = useTasksActions();
  const { categories } = useCategoriesData();
  const { addCategory } = useCategoriesActions();

  const cellsByCourse = useMemo(() => {
    const out = new Map<string, Map<string, Record<string, string | boolean>>>();
    for (const c of SEMESTER_COURSES) {
      const table = tables.find(t => t.id === trackerTableId(c.key));
      out.set(c.key, new Map((table?.rows ?? []).map(r => [r.id, r.cells])));
    }
    return out;
  }, [tables]);

  // Newest task per ref wins; archived tasks still count (a done task gets
  // auto-archived after a week and must not un-tick the tracker when it does).
  const taskByRef = useMemo(() => {
    const out = new Map<string, Task>();
    for (const t of tasks) {
      if (!t.course_ref) continue;
      const prev = out.get(t.course_ref);
      if (!prev || t.created_at > prev.created_at) out.set(t.course_ref, t);
    }
    return out;
  }, [tasks]);

  const isTicked = useCallback((course: CourseKey, week: number, item: TrackerItemKey) =>
    cellsByCourse.get(course)?.get(weekRowId(week))?.[item] === true,
  [cellsByCourse]);

  const linkedTask = useCallback((course: CourseKey, week: number, item: TrackerItemKey) =>
    taskByRef.get(courseRef(course, week, item)),
  [taskByRef]);

  const isDone = useCallback((course: CourseKey, week: number, item: TrackerItemKey) =>
    isTicked(course, week, item) || linkedTask(course, week, item)?.done === true,
  [isTicked, linkedTask]);

  /** Flip a cell. Its linked task follows, so the two never disagree. */
  const toggle = useCallback((course: CourseKey, week: number, item: TrackerItemKey) => {
    const next = !isDone(course, week, item);
    setTrackerCell(course, week, item, next);
    const task = linkedTask(course, week, item);
    if (task && task.done !== next) toggleTask(task.id);
  }, [isDone, setTrackerCell, linkedTask, toggleTask]);

  /** The course's subcategory under Uni — found by name, else created. */
  const resolveCategory = useCallback((course: CourseKey): string | undefined => {
    const def = courseByKey(course);
    const uni = topLevel(categories).find(c => c.id === "uni" || /^uni/i.test(c.name));
    if (!uni) return undefined;
    const subs = categories.filter(c => c.parent_id === uni.id && !c.archived);
    for (const frag of def.categoryMatch) {
      const hit = subs.find(c => c.name.toLowerCase().includes(frag));
      if (hit) return hit.id;
    }
    const pending = createdCategory.get(course);
    if (pending) return pending;
    const id = addCategory(def.name, def.accent, uni.id);
    createdCategory.set(course, id);
    return id;
  }, [categories, addCategory]);

  /** "Structural week 4 flashcards", due that Sunday, filed under the course. */
  const makeTask = useCallback((course: CourseKey, week: number, item: TrackerItemKey): string => {
    const id = addTask(taskTitle(course, week, item), taskDueDate(week));
    const category = resolveCategory(course);
    updateTask(id, { course_ref: courseRef(course, week, item), ...(category ? { category } : {}) });
    return id;
  }, [addTask, updateTask, resolveCategory]);

  const progress = useCallback((opts: { from?: number; to: number; course?: CourseKey }): Progress => {
    let done = 0, total = 0;
    const from = opts.from ?? opts.to;
    for (const c of SEMESTER_COURSES) {
      if (opts.course && c.key !== opts.course) continue;
      for (let w = from; w <= opts.to; w++) {
        for (const item of c.items) {
          total++;
          if (isDone(c.key, w, item)) done++;
        }
      }
    }
    return { done, total };
  }, [isDone]);

  /** Everything in one week. */
  const weekProgress = useCallback((week: number, course?: CourseKey) =>
    progress({ to: week, course }), [progress]);

  /** Everything from week 0 up to and including `week`. */
  const toDateProgress = useCallback((week: number, course?: CourseKey) =>
    progress({ from: FIRST_WEEK, to: week, course }), [progress]);

  return { isDone, isTicked, linkedTask, toggle, makeTask, weekProgress, toDateProgress };
}

export function pct(p: Progress): number {
  return p.total > 0 ? p.done / p.total : 0;
}
