package expression;

class NumberExpr extends Expression {
    private double value;

    public NumberExpr(double value) {
        this.value = value;
    }

    // TODO: 返回 value
    @Override
    public double evaluate() {
        return value;
    }

    // TODO: 返回 String.valueOf(value)
    @Override
    public String toString() {
        return String.valueOf(value);
    }
}
