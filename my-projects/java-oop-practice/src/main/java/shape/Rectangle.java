package shape;
class Rectangle extends Shape {
    private double width;
    private double height;

    public Rectangle(double width, double height) {
        super("Rectangle");
        this.width = width;
            this.height = height;
        // TODO: 保存 width 和 height
    }

    @Override
    public double getArea() {
        // TODO: width * height
        return width * height;
    }

    @Override
    public double getPerimeter() {
        // TODO: 2 * (width + height)
        return 2 * (width + height);
    }
}
