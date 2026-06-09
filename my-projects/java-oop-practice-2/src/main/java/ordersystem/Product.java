package ordersystem;

public class Product {
    private String productId;
    private String name;
    private double price;
    private int stock;

    public Product(String productId, String name, double price, int stock) {
        // TODO
        this.productId = productId;
        this.name = name;
        this.price = price;
        this.stock = stock;
    }

    public boolean reduceStock(int qty) {
        // TODO: 库存不足返回 false，否则 stock -= qty
        if(qty <= stock) {
            stock -= qty;
            return true;
        }
        return false;
    }

    public void addStock(int qty) {
        // TODO
        stock += qty;

    }

    public String getProductId() { return productId; }
    public String getName() { return name; }
    public double getPrice() { return price; }
    public int getStock() { return stock; }

    @Override
    public String toString() {
        // 格式: productId name ¥price 库存:stock
        // TODO
        return productId + " " + name + " ¥" + price + " 库存:" + stock;
    }
}
