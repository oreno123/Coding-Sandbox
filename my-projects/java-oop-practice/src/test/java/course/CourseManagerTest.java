package course;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

public class CourseManagerTest {

    @Test
    public void testStudentGpaValidation() {
        Student s = new Student("Tom", "S001", 3.5);
        assertEquals(3.5, s.getGpa(), 0.001);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        System.setOut(new PrintStream(out));
        s.setGpa(5.0);
        System.setOut(System.out);

        assertEquals(3.5, s.getGpa(), 0.001); // GPA should not change
        assertTrue(out.toString().contains("Invalid GPA"));
    }

    @Test
    public void testEnrollSuccess() {
        CourseManager manager = new CourseManager();
        manager.createCourse("Java 101", 2);
        assertTrue(manager.enroll("Java 101", new Student("Alice", "S001", 3.8)));
    }

    @Test
    public void testEnrollFull() {
        CourseManager manager = new CourseManager();
        manager.createCourse("Java 101", 1);
        manager.enroll("Java 101", new Student("Alice", "S001", 3.8));
        assertFalse(manager.enroll("Java 101", new Student("Bob", "S002", 3.5)));
    }

    @Test
    public void testEnrollNull() {
        CourseManager manager = new CourseManager();
        manager.createCourse("Java 101", 5);
        assertFalse(manager.enroll("Java 101", null));
    }

    @Test
    public void testFindCourseNotFound() {
        CourseManager manager = new CourseManager();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        System.setOut(new PrintStream(out));
        manager.findCourse("NonExist");
        System.setOut(System.out);
        assertTrue(out.toString().contains("Course NonExist not found."));
    }

    @Test
    public void testDisplayStudentInfo() {
        Student s = new Student("Alice", "S001", 3.8);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        System.setOut(new PrintStream(out));
        s.displayInfo();
        System.setOut(System.out);
        assertEquals("Student: Alice, ID: S001, GPA: 3.8" + System.lineSeparator(), out.toString());
    }
}
