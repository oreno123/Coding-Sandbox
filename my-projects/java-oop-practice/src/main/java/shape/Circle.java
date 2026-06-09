package shape;
class Circle extends Shape {
    private double radius;

    public Circle(double radius) {
        super("Circle");
        // TODO: 保存 radius
        this.radius = radius;
    }

    @Override
    public double getArea() {
        // TODO: Math.PI * radius * radius
        return Math.PI * radius * radius;
    }

    @Override
    public double getPerimeter() {
        // TODO: 2 * Math.PI * radius

        return 2 * Math.PI * radius;
    }
}
