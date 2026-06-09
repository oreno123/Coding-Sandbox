package grade;

import static org.junit.Assert.*;
import org.junit.Test;
import java.util.List;

public class GradeTest {

    @Test
    public void testGradeFromScore() {
        assertEquals(Grade.A, Grade.fromScore(95));
        assertEquals(Grade.A, Grade.fromScore(90));
        assertEquals(Grade.B, Grade.fromScore(85));
        assertEquals(Grade.C, Grade.fromScore(72));
        assertEquals(Grade.D, Grade.fromScore(60));
        assertEquals(Grade.F, Grade.fromScore(59));
        assertEquals(Grade.F, Grade.fromScore(30));
    }

    @Test
    public void testCourseGrade() {
        CourseGrade cg = new CourseGrade("Java", 85, 3);
        assertEquals("Java", cg.getCourseName());
        assertEquals(85, cg.getScore(), 0.01);
        assertEquals(3, cg.getCredits());
        assertEquals(Grade.B, cg.getGrade());
        assertEquals(9.0, cg.getWeightedPoints(), 0.01); // 3.0 * 3
    }

    @Test
    public void testCourseGradeToString() {
        CourseGrade cg = new CourseGrade("Java", 92, 4);
        assertEquals("Java: 92 -> A (4学分)", cg.toString());
    }

    @Test
    public void testStudentRecordGPA() {
        StudentRecord record = new StudentRecord("Alice", "S001");
        record.addGrade(new CourseGrade("Math", 90, 4));    // A=4.0, weighted=16
        record.addGrade(new CourseGrade("English", 80, 3)); // B=3.0, weighted=9
        record.addGrade(new CourseGrade("Physics", 70, 3)); // C=2.0, weighted=6
        // GPA = (16 + 9 + 6) / (4 + 3 + 3) = 31 / 10 = 3.1
        assertEquals(3.1, record.getGPA(), 0.01);
    }

    @Test
    public void testStudentRecordAverageScore() {
        StudentRecord record = new StudentRecord("Bob", "S002");
        record.addGrade(new CourseGrade("Math", 90, 4));
        record.addGrade(new CourseGrade("English", 80, 3));
        // Average = (90*4 + 80*3) / (4+3) = 600/7 ≈ 85.71
        assertEquals(85.71, record.getAverageScore(), 0.01);
    }

    @Test
    public void testStudentRecordFailedCourses() {
        StudentRecord record = new StudentRecord("Charlie", "S003");
        record.addGrade(new CourseGrade("Math", 90, 4));
        record.addGrade(new CourseGrade("English", 55, 3));
        record.addGrade(new CourseGrade("Art", 45, 2));

        List<String> failed = record.getFailedCourses();
        assertEquals(2, failed.size());
        assertTrue(failed.contains("English"));
        assertTrue(failed.contains("Art"));
    }

    @Test
    public void testEmptyRecord() {
        StudentRecord record = new StudentRecord("Nobody", "S000");
        assertEquals(0.0, record.getGPA(), 0.01);
        assertEquals(0.0, record.getAverageScore(), 0.01);
        assertEquals(0, record.getFailedCourses().size());
    }

    @Test
    public void testAddNullGrade() {
        StudentRecord record = new StudentRecord("Test", "T001");
        record.addGrade(null);
        assertEquals(0, record.getGrades().size());
    }
}
