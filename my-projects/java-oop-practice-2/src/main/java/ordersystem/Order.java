package ordersystem;

import java.util.ArrayList;

public class Order {
    private String orderId;
    private ArrayList<OrderItem> items = new ArrayList<>();
    private String status = "待支付";

    public Order(String orderId) {
        this.orderId = orderId;
        // TODO
    }

    public boolean addItem(Product product, int quantity) {
        // TODO: 扣减库存成功才加入，库存不足返回 false
        // 同一商品重复添加则累加数量（需再扣库存）
        if(product.reduceStock(quantity)) {
            for(OrderItem item : items) {
                if(item.getProduct().getProductId().equals(product.getProductId())) {
                    item.addQuantity(quantity);
                    return true;
                }
            }
            items.add(new OrderItem(product, quantity));
            return true;
        }
        return false;
    }

    public boolean removeItem(String productId) {
        // TODO: 移除商品项，归还库存。找不到返回 false
        if(items.removeIf(item -> {
            if(item.getProduct().getProductId().equals(productId)) {
                item.getProduct().addStock(item.getQuantity());
                return true;
            }
            return false;
        })) {
            return true;
        }
        return false;
    }

    public double getTotal() {
        // TODO: 累加所有 OrderItem 的 subtotal
        double total = 0;
        for(OrderItem item : items) {
            total += item.getSubtotal();
            
        }
        return total;
    }

    public boolean pay() {
        // 状态从"待支付"→"已支付"，非"待支付"返回 false
        // TODO
        if(status.equals("待支付")) {
            status = "已支付";
            return true;
        }
        return false;
    }

    public boolean ship() {
        // "已支付"→"已发货"
        // TODO
        if(status.equals("已支付")) {
            status = "已发货";
            return true;
        }
        return false;
    }

    public boolean complete() {
        // "已发货"→"已完成"
        // TODO
        if(status.equals("已发货")) {
            status = "已完成";
            return true;
        }
        return false;
    }

    public String getOrderId() { return orderId; }
    public String getStatus() { return status; }

    public void printOrder() {
        // 格式:
        // 订单号: orderId
        // 每个 item 的 toString
        // 总额: ¥total
        // 状态: status
        // TODO
        System.out.println("订单号: " + orderId);
        for(OrderItem item : items) {
            System.out.println(item.toString());
        }
        System.out.println("总额: ¥" + getTotal());
        System.out.println("状态: " + status);
    }
}
