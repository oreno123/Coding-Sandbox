package store;

class Food extends Product {
    private boolean isPerishable;

    public Food(String name, double price, boolean isPerishable) {
        super(name, price, Category.FOOD);
        // TODO: 保存 isPerishable 到成员变量
        this.isPerishable = isPerishable;
        System.out.println("Food: " + name + ", " + price + ", " + isPerishable);
    }

    public boolean isPerishable() {
        return isPerishable;
    }
}
