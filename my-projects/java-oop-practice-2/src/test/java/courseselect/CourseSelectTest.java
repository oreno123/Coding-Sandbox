package courseselect;

import org.junit.Test;
import static org.junit.Assert.*;

public class CourseSelectTest {

    private CourseSystem createSystem() {
        CourseSystem sys = new CourseSystem();
        sys.addStudent(new Student("S01", "小明"));
        sys.addStudent(new Student("S02", "小红"));
        sys.addStudent(new Student("S03", "小刚"));
        sys.addCourse(new Course("C01", "Java", 2));
        sys.addCourse(new Course("C02", "数据结构", 3));
        return sys;
    }

    @Test
    public void testEnroll() {
        CourseSystem sys = createSystem();
        assertTrue(sys.enroll("S01", "C01"));
        assertTrue(sys.enroll("S02", "C01"));
    }

    @Test
    public void testEnrollDuplicate() {
        CourseSystem sys = createSystem();
        sys.enroll("S01", "C01");
        assertFalse(sys.enroll("S01", "C01")); // 重复选
    }

    @Test
    public void testEnrollFull() {
        CourseSystem sys = createSystem();
        sys.enroll("S01", "C01");
        sys.enroll("S02", "C01");
        assertFalse(sys.enroll("S03", "C01")); // 满员
    }

    @Test
    public void testEnrollNotExist() {
        CourseSystem sys = createSystem();
        assertFalse(sys.enroll("S99", "C01")); // 学生不存在
        assertFalse(sys.enroll("S01", "C99")); // 课程不存在
    }

    @Test
    public void testDrop() {
        CourseSystem sys = createSystem();
        sys.enroll("S01", "C01");
        assertTrue(sys.drop("S01", "C01"));
        assertFalse(sys.drop("S01", "C01")); // 已退
    }

    @Test
    public void testDropFreesCapacity() {
        CourseSystem sys = createSystem();
        sys.enroll("S01", "C01");
        sys.enroll("S02", "C01");
        sys.drop("S01", "C01");
        assertTrue(sys.enroll("S03", "C01")); // 空出位置了
    }

    @Test
    public void testDropNotExist() {
        CourseSystem sys = createSystem();
        assertFalse(sys.drop("S99", "C01"));
        assertFalse(sys.drop("S01", "C99"));
    }

    @Test
    public void testStudentToString() {
        Student s = new Student("S01", "小明");
        s.enroll("C01");
        assertEquals("S01 小明 (已选1门)", s.toString());
    }

    @Test
    public void testCourseToString() {
        Course c = new Course("C01", "Java", 30);
        assertEquals("C01 Java (0/30)", c.toString());
    }

    @Test
    public void testCourseCapacity() {
        Course c = new Course("C01", "Java", 2);
        assertFalse(c.isFull());
        assertEquals(2, c.getAvailable());
        c.addStudent();
        assertFalse(c.isFull());
        assertEquals(1, c.getAvailable());
        c.addStudent();
        assertTrue(c.isFull());
        assertEquals(0, c.getAvailable());
    }

    @Test
    public void testAddDuplicateStudent() {
        CourseSystem sys = new CourseSystem();
        sys.addStudent(new Student("S01", "小明"));
        sys.addStudent(new Student("S01", "小明二号")); // 同 id，忽略
        sys.addCourse(new Course("C01", "Java", 10));
        assertTrue(sys.enroll("S01", "C01"));
    }

    @Test
    public void testAddDuplicateCourse() {
        CourseSystem sys = new CourseSystem();
        sys.addStudent(new Student("S01", "小明"));
        sys.addCourse(new Course("C01", "Java", 10));
        sys.addCourse(new Course("C01", "Java进阶", 10)); // 同 id，忽略
        sys.enroll("S01", "C01");
        // 应该选的是第一个 Java
    }
}
