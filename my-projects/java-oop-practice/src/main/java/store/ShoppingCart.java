package store;

import java.util.ArrayList;

class ShoppingCart {
    private ArrayList<Product> products = new ArrayList<>();

    // TODO: 添加商品，null 忽略
    public void addProduct(Product p) {
        if(p != null){
            products.add(p);
        }
    }

    // TODO: 移除第一个 name 匹配的商品，返回是否成功
    public boolean removeProduct(String name) {
        for(Product p:products){
            if(p.getName().equals(name)){
                products.remove(p);
                return true;
            }
        }
        return false;
    }

    // TODO: 原价总和
    public double getTotal() {
        double total = 0;
        for(Product p:products){
            total += p.getPrice();
        }
        return total;
    }

    // TODO: 折扣价总和 - 如果商品实现了 Discountable 接口，用 getDiscountedPrice()
    //       否则用 getPrice()
    //       提示: 用 instanceof 判断，如 if (p instanceof Discountable)
    public double getTotalWithDiscount() {
        double total = 0;
        for(Product p:products){
            if(p instanceof Discountable){
                total += ((Discountable) p).getDiscountedPrice();
            } else {
                total += p.getPrice();
            }
        }
        return total;
    }

    public int getItemCount() {
        return products.size();
    }
}
