package shape;
abstract class Shape implements Comparable<Shape> {
    protected String name;

    public Shape(String name) {
        this.name = name;
    }

    public abstract double getArea();

    public abstract double getPerimeter();

    @Override
    public String toString() {
        
        // TODO: 用 String.format 返回 "Shape: [name], Area: [area保留2位小数]"
        // 提示: String.format("Shape: %s, Area: %.2f", name, getArea())
        return String.format("Shape: %s, Area: %.2f", name, getArea());
    }

    @Override
    public int compareTo(Shape other) {
        // TODO: 按面积升序比较，返回 Double.compare(this.getArea(), other.getArea())
        return Double.compare(this.getArea(), other.getArea());
    }
}
