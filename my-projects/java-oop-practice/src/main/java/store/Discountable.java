package store;

interface Discountable {
    double getDiscountRate();    // e.g. 0.1 means 10%
    double getDiscountedPrice();
}
