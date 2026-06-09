package ordersystem;

public class OrderItem {
    private Product product;
    private int quantity;

    public OrderItem(Product product, int quantity) {
        // TODO
        this.product = product;
        this.quantity = quantity;
    }

    public double getSubtotal() {
        // TODO: product.price × quantity
        return product.getPrice() * quantity;
    }

    public Product getProduct() { return product; }
    public int getQuantity() { return quantity; }

    public void addQuantity(int qty) {
        // TODO: 累加数量
        quantity += qty;
    }

    @Override
    public String toString() {
        // 格式: product.name × quantity = ¥subtotal
        // TODO
        return product.getName() + " × " + quantity + " = ¥" + getSubtotal();
    }
}
