package store;

abstract class Product {
    protected String name;
    protected double price;
    protected Category category;

    public Product(String name, double price, Category category) {
        this.name = name;
        this.price = price;
        this.category = category;
    }

    public String getName() {
        return name;
    }

    public double getPrice() {
        return price;
    }

    public Category getCategory() {
        return category;
    }

    // TODO: 返回 "[name] ([category]) - ¥[price保留2位小数]"
    // 提示: String.format("%s (%s) - ¥%.2f", name, category, price)
    @Override
    public String toString() {
        return String.format("%s (%s) - ¥%.2f", name, category, price);
    }
}
