package expression;

abstract class BinaryExpr extends Expression {
    protected Expression left;
    protected Expression right;

    public BinaryExpr(Expression left, Expression right) {
        this.left = left;
        this.right = right;
    }
}
