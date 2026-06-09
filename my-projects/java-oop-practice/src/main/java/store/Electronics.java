package store;

class Electronics extends Product implements Discountable {

    public Electronics(String name, double price) {
        super(name, price, Category.ELECTRONICS);
    }

    // TODO: 实现 getDiscountRate，返回 0.1（10% 折扣）
    @Override
    public double getDiscountRate() {
        return 0.1;
    }

    // TODO: 实现 getDiscountedPrice，返回 price * (1 - getDiscountRate())
    @Override
    public double getDiscountedPrice() {
        return price * (1 - getDiscountRate());
    }
}
