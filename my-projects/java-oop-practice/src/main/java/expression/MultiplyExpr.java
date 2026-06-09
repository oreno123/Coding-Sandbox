package expression;

class MultiplyExpr extends BinaryExpr {
    public MultiplyExpr(Expression left, Expression right) {
        super(left, right);
    }

    // TODO: 返回 left.evaluate() * right.evaluate()
    @Override
    public double evaluate() {
        return left.evaluate() * right.evaluate();
    }

    // TODO: 返回 "(" + left + " * " + right + ")"
    @Override
    public String toString() {
        return "(" + left + " * " + right + ")";
    }
}
