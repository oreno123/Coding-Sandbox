package expression;

import static org.junit.Assert.*;
import org.junit.Test;

public class ExpressionTest {

    @Test
    public void testNumberEvaluate() {
        Expression e = new NumberExpr(42.0);
        assertEquals(42.0, e.evaluate(), 0.001);
    }

    @Test
    public void testNumberToString() {
        Expression e = new NumberExpr(5.0);
        assertEquals("5.0", e.toString());
    }

    @Test
    public void testAdd() {
        Expression e = new AddExpr(new NumberExpr(3.0), new NumberExpr(4.0));
        assertEquals(7.0, e.evaluate(), 0.001);
        assertEquals("(3.0 + 4.0)", e.toString());
    }

    @Test
    public void testSubtract() {
        Expression e = new SubtractExpr(new NumberExpr(10.0), new NumberExpr(3.0));
        assertEquals(7.0, e.evaluate(), 0.001);
        assertEquals("(10.0 - 3.0)", e.toString());
    }

    @Test
    public void testMultiply() {
        Expression e = new MultiplyExpr(new NumberExpr(3.0), new NumberExpr(5.0));
        assertEquals(15.0, e.evaluate(), 0.001);
        assertEquals("(3.0 * 5.0)", e.toString());
    }

    @Test
    public void testNestedExpression() {
        // (3 + 4) * 5 = 35
        Expression add = new AddExpr(new NumberExpr(3.0), new NumberExpr(4.0));
        Expression e = new MultiplyExpr(add, new NumberExpr(5.0));
        assertEquals(35.0, e.evaluate(), 0.001);
        assertEquals("((3.0 + 4.0) * 5.0)", e.toString());
    }

    @Test
    public void testComplexExpression() {
        // ((10 - 3) * (2 + 1)) = 7 * 3 = 21
        Expression left = new SubtractExpr(new NumberExpr(10.0), new NumberExpr(3.0));
        Expression right = new AddExpr(new NumberExpr(2.0), new NumberExpr(1.0));
        Expression e = new MultiplyExpr(left, right);
        assertEquals(21.0, e.evaluate(), 0.001);
        assertEquals("((10.0 - 3.0) * (2.0 + 1.0))", e.toString());
    }

    @Test
    public void testPolymorphism() {
        Expression[] exprs = {
            new NumberExpr(5.0),
            new AddExpr(new NumberExpr(1.0), new NumberExpr(2.0)),
            new MultiplyExpr(new NumberExpr(3.0), new NumberExpr(4.0))
        };
        assertEquals(5.0, exprs[0].evaluate(), 0.001);
        assertEquals(3.0, exprs[1].evaluate(), 0.001);
        assertEquals(12.0, exprs[2].evaluate(), 0.001);
    }
}
