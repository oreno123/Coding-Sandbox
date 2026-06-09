package store;

class Clothing extends Product implements Discountable {
    private double discountRate;

    public Clothing(String name, double price, double discountRate) {
        super(name, price, Category.CLOTHING);
        // TODO: 保存 discountRate 到成员变量
        this.discountRate = discountRate;
        System.out.println("Clothing: " + name + ", " + price + ", " + discountRate);
    }

    // TODO: 实现 getDiscountRate，返回 discountRate
    @Override
    public double getDiscountRate() {
        return discountRate;
    }

    // TODO: 实现 getDiscountedPrice，返回 price * (1 - discountRate)
    @Override
    public double getDiscountedPrice() {
        return price * (1 - getDiscountRate());
    }
}
