package ordersystem;

import org.junit.Test;
import static org.junit.Assert.*;

public class OrderTest {

    @Test
    public void testAddItem() {
        Product p1 = new Product("P01", "键盘", 299.0, 10);
        Order order = new Order("ORD001");
        assertTrue(order.addItem(p1, 2));
        assertEquals(8, p1.getStock());
        assertEquals(598.0, order.getTotal(), 0.01);
    }

    @Test
    public void testAddSameProductTwice() {
        Product p1 = new Product("P01", "键盘", 299.0, 10);
        Order order = new Order("ORD001");
        assertTrue(order.addItem(p1, 2));
        assertTrue(order.addItem(p1, 1)); // 累加为3
        assertEquals(7, p1.getStock());
        assertEquals(897.0, order.getTotal(), 0.01);
    }

    @Test
    public void testAddItemInsufficientStock() {
        Product p1 = new Product("P01", "键盘", 299.0, 2);
        Order order = new Order("ORD001");
        assertTrue(order.addItem(p1, 2));
        assertFalse(order.addItem(p1, 1)); // 库存不够
        assertEquals(0, p1.getStock());
    }

    @Test
    public void testRemoveItem() {
        Product p2 = new Product("P02", "鼠标", 99.0, 5);
        Order order = new Order("ORD001");
        order.addItem(p2, 3);
        assertTrue(order.removeItem("P02"));
        assertEquals(5, p2.getStock()); // 库存归还
        assertEquals(0, order.getTotal(), 0.01);
    }

    @Test
    public void testRemoveItemNotFound() {
        Order order = new Order("ORD001");
        assertFalse(order.removeItem("P99"));
    }

    @Test
    public void testOrderTotal() {
        Product p1 = new Product("P01", "键盘", 299.0, 10);
        Product p2 = new Product("P02", "鼠标", 99.0, 5);
        Order order = new Order("ORD001");
        order.addItem(p1, 2);
        order.addItem(p2, 3);
        // 299*2 + 99*3 = 598 + 297 = 895
        assertEquals(895.0, order.getTotal(), 0.01);
    }

    @Test
    public void testStatusFlow() {
        Order order = new Order("ORD001");
        assertEquals("待支付", order.getStatus());

        assertFalse(order.ship());    // 还没支付
        assertTrue(order.pay());
        assertEquals("已支付", order.getStatus());

        assertFalse(order.pay());     // 重复支付
        assertTrue(order.ship());
        assertEquals("已发货", order.getStatus());

        assertTrue(order.complete());
        assertEquals("已完成", order.getStatus());
    }

    @Test
    public void testProductStock() {
        Product p = new Product("P01", "键盘", 299.0, 5);
        assertFalse(p.reduceStock(10));
        assertTrue(p.reduceStock(3));
        assertEquals(2, p.getStock());
        p.addStock(10);
        assertEquals(12, p.getStock());
    }

    @Test
    public void testOrderItemSubtotal() {
        Product p = new Product("P01", "键盘", 299.0, 10);
        OrderItem item = new OrderItem(p, 3);
        assertEquals(897.0, item.getSubtotal(), 0.01);
    }
}
