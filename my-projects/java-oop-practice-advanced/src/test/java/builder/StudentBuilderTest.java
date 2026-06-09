package builder;

import static org.junit.Assert.*;
import org.junit.Test;

import java.util.List;

public class StudentBuilderTest {

    @Test
    public void testBasicBuild() {
        Student s = new Student.Builder("Alice", "S001").build();
        assertEquals("Alice", s.getName());
        assertEquals("S001", s.getId());
        assertEquals(0, s.getAge());
        assertNull(s.getMajor());
        assertEquals(0.0, s.getGpa(), 0.01);
        assertEquals(0, s.getCourses().size());
    }

    @Test
    public void testFullBuild() {
        Student s = new Student.Builder("Bob", "S002")
                .age(20)
                .major("Computer Science")
                .gpa(3.75)
                .addCourse("OOP")
                .addCourse("Data Structures")
                .build();

        assertEquals("Bob", s.getName());
        assertEquals("S002", s.getId());
        assertEquals(20, s.getAge());
        assertEquals("Computer Science", s.getMajor());
        assertEquals(3.75, s.getGpa(), 0.01);
        assertEquals(List.of("OOP", "Data Structures"), s.getCourses());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderNameNull() {
        new Student.Builder(null, "S001");
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderNameEmpty() {
        new Student.Builder("", "S001");
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderNameWhitespace() {
        new Student.Builder("   ", "S001");
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderIdNull() {
        new Student.Builder("Alice", null);
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderIdEmpty() {
        new Student.Builder("Alice", "");
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderNegativeAge() {
        new Student.Builder("Alice", "S001").age(-1);
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderGpaTooHigh() {
        new Student.Builder("Alice", "S001").gpa(4.5);
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderGpaNegative() {
        new Student.Builder("Alice", "S001").gpa(-0.1);
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBuilderNullCourse() {
        new Student.Builder("Alice", "S001").addCourse(null);
    }

    @Test
    public void testZeroGpaAllowed() {
        Student s = new Student.Builder("Alice", "S001").gpa(0.0).build();
        assertEquals(0.0, s.getGpa(), 0.01);
    }

    @Test
    public void testMaxGpaAllowed() {
        Student s = new Student.Builder("Alice", "S001").gpa(4.0).build();
        assertEquals(4.0, s.getGpa(), 0.01);
    }

    @Test
    public void testImmutability() {
        Student s = new Student.Builder("Charlie", "S003")
                .addCourse("Math")
                .addCourse("Physics")
                .build();

        // 修改返回的 courses 不应影响原对象
        s.getCourses().add("Chemistry");
        assertEquals(2, s.getCourses().size());
    }

    @Test
    public void testMethodChaining() {
        Student.Builder builder = new Student.Builder("Test", "T001");
        Student.Builder returned = builder.age(18);
        assertSame(builder, returned);

        Student.Builder returned2 = builder.gpa(3.0);
        assertSame(builder, returned2);

        Student.Builder returned3 = builder.major("CS");
        assertSame(builder, returned3);

        Student.Builder returned4 = builder.addCourse("OOP");
        assertSame(builder, returned4);
    }

    @Test
    public void testToStringBasic() {
        Student s = new Student.Builder("Alice", "S001").build();
        String str = s.toString();
        assertTrue(str.contains("S001"));
        assertTrue(str.contains("Alice"));
        // age=0 和 major=null 不应出现
        assertFalse(str.contains("age="));
        assertFalse(str.contains("major="));
    }

    @Test
    public void testToStringFull() {
        Student s = new Student.Builder("Bob", "S002")
                .age(21)
                .major("CS")
                .gpa(3.5)
                .addCourse("OOP")
                .build();
        String str = s.toString();
        assertTrue(str.contains("S002"));
        assertTrue(str.contains("Bob"));
        assertTrue(str.contains("age=21"));
        assertTrue(str.contains("major=CS"));
        assertTrue(str.contains("3.50"));
        assertTrue(str.contains("OOP"));
    }
}
