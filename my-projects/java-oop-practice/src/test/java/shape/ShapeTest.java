package shape;
import static org.junit.Assert.*;
import org.junit.Test;
import java.util.Arrays;

public class ShapeTest {

    @Test
    public void testCircleArea() {
        Circle c = new Circle(5.0);
        assertEquals(78.54, c.getArea(), 0.01);
    }

    @Test
    public void testCirclePerimeter() {
        Circle c = new Circle(5.0);
        assertEquals(31.42, c.getPerimeter(), 0.01);
    }

    @Test
    public void testRectangleArea() {
        Rectangle r = new Rectangle(4.0, 5.0);
        assertEquals(20.0, r.getArea(), 0.01);
    }

    @Test
    public void testRectanglePerimeter() {
        Rectangle r = new Rectangle(4.0, 5.0);
        assertEquals(18.0, r.getPerimeter(), 0.01);
    }

    @Test
    public void testToString() {
        Shape s = new Circle(1.0);
        assertEquals("Shape: Circle, Area: 3.14", s.toString());
    }

    @Test
    public void testComparableSort() {
        Shape[] shapes = {new Rectangle(3, 3), new Circle(1), new Rectangle(1, 2)};
        Arrays.sort(shapes);
        // 排序后按面积升序: 2.0, 3.14, 9.0
        assertTrue(shapes[0] instanceof Rectangle);
        assertEquals(2.0, shapes[0].getArea(), 0.01);
        assertTrue(shapes[1] instanceof Circle);
        assertEquals(3.14, shapes[1].getArea(), 0.01);
        assertTrue(shapes[2] instanceof Rectangle);
        assertEquals(9.0, shapes[2].getArea(), 0.01);
    }

    @Test
    public void testPolymorphism() {
        Shape s = new Rectangle(2, 3);
        assertEquals(6.0, s.getArea(), 0.01);
        assertEquals("Shape: Rectangle, Area: 6.00", s.toString());
    }
}
