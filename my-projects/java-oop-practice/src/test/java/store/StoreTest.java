package store;

import static org.junit.Assert.*;
import org.junit.Test;

public class StoreTest {

    @Test
    public void testElectronicsDiscount() {
        Electronics e = new Electronics("Phone", 5999.0);
        assertEquals(Category.ELECTRONICS, e.getCategory());
        assertEquals(0.1, e.getDiscountRate(), 0.001);
        assertEquals(5399.1, e.getDiscountedPrice(), 0.01);
    }

    @Test
    public void testClothingCustomDiscount() {
        Clothing c = new Clothing("Jacket", 500.0, 0.2);
        assertEquals(Category.CLOTHING, c.getCategory());
        assertEquals(400.0, c.getDiscountedPrice(), 0.01);
    }

    @Test
    public void testFoodNoDiscount() {
        Food f = new Food("Bread", 15.0, true);
        assertEquals(Category.FOOD, f.getCategory());
        assertTrue(f.isPerishable());
    }

    @Test
    public void testProductToString() {
        Product p = new Electronics("Laptop", 6999.0);
        assertEquals("Laptop (ELECTRONICS) - ¥6999.00", p.toString());
    }

    @Test
    public void testShoppingCartTotal() {
        ShoppingCart cart = new ShoppingCart();
        cart.addProduct(new Electronics("Phone", 5000.0));
        cart.addProduct(new Clothing("Shirt", 200.0, 0.5));
        cart.addProduct(new Food("Apple", 10.0, true));
        assertEquals(5210.0, cart.getTotal(), 0.01);
    }

    @Test
    public void testShoppingCartWithDiscount() {
        ShoppingCart cart = new ShoppingCart();
        cart.addProduct(new Electronics("Phone", 5000.0));   // discounted: 4500
        cart.addProduct(new Clothing("Shirt", 200.0, 0.5));  // discounted: 100
        cart.addProduct(new Food("Apple", 10.0, true));      // no discount: 10
        assertEquals(4610.0, cart.getTotalWithDiscount(), 0.01);
    }

    @Test
    public void testShoppingCartRemove() {
        ShoppingCart cart = new ShoppingCart();
        cart.addProduct(new Electronics("Phone", 5000.0));
        cart.addProduct(new Electronics("Laptop", 3000.0));
        assertTrue(cart.removeProduct("Phone"));
        assertEquals(1, cart.getItemCount());
        assertEquals(3000.0, cart.getTotal(), 0.01);
    }

    @Test
    public void testShoppingCartRemoveNotFound() {
        ShoppingCart cart = new ShoppingCart();
        assertFalse(cart.removeProduct("NotExist"));
    }

    @Test
    public void testAddNull() {
        ShoppingCart cart = new ShoppingCart();
        cart.addProduct(null);
        assertEquals(0, cart.getItemCount());
    }

    @Test
    public void testPolymorphism() {
        Product p = new Clothing("Dress", 800.0, 0.25);
        assertEquals("Dress (CLOTHING) - ¥800.00", p.toString());
        Discountable d = (Discountable) p;
        assertEquals(600.0, d.getDiscountedPrice(), 0.01);
    }
}
